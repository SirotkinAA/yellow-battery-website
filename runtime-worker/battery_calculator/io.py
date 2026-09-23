"""Strict, versioned JSON boundary for new shared datasets and synthetic examples."""
import hashlib
import json

from .core import (CalculationError, Model, Curve, CurrentLimit, Stage, number,
                   positive, count, normalize_values, runtime, size_profile, select)


def object_fields(obj, required, optional=()):
    if not isinstance(obj, dict):
        raise CalculationError("invalid_document", "Expected a JSON object")
    missing = set(required)-obj.keys()
    extra = obj.keys()-set(required)-set(optional)
    if missing or extra:
        raise CalculationError("invalid_fields", "Missing fields: %s; unsupported fields: %s" % (sorted(missing), sorted(extra)))


def text(value, name):
    if not isinstance(value, str) or not value.strip():
        raise CalculationError("invalid_text", name + " must be nonempty text")
    return value


def sequence(value, name):
    if not isinstance(value, list):
        raise CalculationError("invalid_document", name + " must be an array")
    return value


def read_dataset(raw, demo=False):
    object_fields(raw, ("schema_version", "dataset_id", "revision", "origin", "models"))
    if raw["schema_version"] != "1":
        raise CalculationError("unsupported_schema", "Only dataset schema version 1 is supported")
    for key in ("dataset_id", "revision"):
        text(raw[key], key)
    origin = raw["origin"]
    if origin not in ("new_shared_dataset", "synthetic"):
        raise CalculationError("forbidden_source", "Legacy website, archive and Mathcad catalogs are not accepted")
    if origin == "synthetic" and not demo:
        raise CalculationError("demo_only", "Use --demo for synthetic datasets")
    models, rejected, seen = [], [], set()
    records = sequence(raw["models"], "models")
    if len(records) > 1000:
        raise CalculationError("resource_limit", "At most 1000 model records per request")
    for raw_model in records:
        # Duplicated identifiers are fatal: a partially loaded duplicate is ambiguous.
        if isinstance(raw_model, dict):
            ident = text(raw_model.get("id"), "model.id")
            if ident in seen:
                raise CalculationError("duplicate_model", "Duplicate model id: " + ident)
            seen.add(ident)
        else:
            ident = None
        try:
            object_fields(raw_model, ("id", "series", "nominal_voltage_v", "cells", "nominal_capacity_ah",
                                      "capacity_rating", "source_ref", "revision", "curves"), ("current_limits",))
            for key in ("id", "series", "source_ref", "revision"):
                text(raw_model[key], key)
            rating = raw_model["capacity_rating"]
            object_fields(rating, ("duration_hours", "end_voltage_v_battery", "temperature_c"))
            positive(rating["duration_hours"], "capacity_rating.duration_hours")
            positive(rating["end_voltage_v_battery"], "capacity_rating.end_voltage_v_battery")
            number(rating["temperature_c"], "capacity_rating.temperature_c")
            cells = count(raw_model["cells"], "cells")
            curves = []
            for c in sequence(raw_model["curves"], "curves"):
                object_fields(c, ("mode", "end_voltage", "voltage_unit", "temperature_c", "times",
                                  "time_unit", "values", "value_unit", "source_ref", "revision", "approval"))
                for key in ("mode", "time_unit", "value_unit", "voltage_unit", "source_ref", "revision", "approval"):
                    text(c[key], key)
                if c["time_unit"] not in ("minutes", "hours"):
                    raise CalculationError("invalid_unit", "Explicit minutes/hours required")
                if c["voltage_unit"] not in ("V/cell", "V/battery"):
                    raise CalculationError("invalid_unit", "Explicit V/cell or V/battery required")
                units = {"constant_power": ("W/cell", "W/battery"), "constant_current": ("A",)}
                if c["mode"] not in units or c["value_unit"] not in units[c["mode"]]:
                    raise CalculationError("invalid_unit", "Discharge mode and unit do not match")
                times = sequence(c["times"], "times")
                vals = sequence(c["values"], "values")
                curves.append(Curve(c["mode"], normalize_values([c["end_voltage"]], c["voltage_unit"], cells)[0],
                                    c["temperature_c"], tuple(positive(t, "time")*(60 if c["time_unit"] == "hours" else 1) for t in times),
                                    normalize_values(vals, c["value_unit"], cells), c["source_ref"], c["revision"], c["approval"]))
            limits = []
            for lim in sequence(raw_model.get("current_limits", []), "current_limits"):
                object_fields(lim, ("component", "max_a", "max_duration_minutes", "temperature_c",
                                    "configuration_id", "source_ref", "revision", "approval", "basis"))
                if lim["basis"] != "per_string":
                    raise CalculationError("invalid_limit", "Limits must explicitly apply per string, not to the common DC bus")
                for key in ("component", "configuration_id", "source_ref", "revision", "approval"):
                    text(lim[key], key)
                limits.append(CurrentLimit(**{k:v for k,v in lim.items() if k != "basis"}))
            models.append(Model(raw_model["id"], raw_model["series"], raw_model["nominal_voltage_v"], cells,
                                raw_model["nominal_capacity_ah"], origin, raw_model["source_ref"], raw_model["revision"],
                                tuple(curves), tuple(limits)))
        except CalculationError as exc:
            rejected.append({"model_id": ident, "code": exc.code, "message": str(exc)})
    return models, rejected


def execute(document, demo=False):
    object_fields(document, ("dataset", "request"))
    request = document["request"]
    common = ("operation", "unit", "efficiency_percent", "series_batteries", "end_voltage_v_cell")
    optional = ("temperature_c", "power_factor", "age_factor", "reserve_factor", "configuration_id")
    if not isinstance(request, dict):
        raise CalculationError("invalid_document", "request must be an object")
    op = request.get("operation")
    if op == "runtime":
        object_fields(request, common+("model_id", "load", "parallel_strings"), optional)
    elif op == "profile":
        object_fields(request, common+("model_id", "stages"), optional+("max_parallel_strings",))
    elif op == "select":
        object_fields(request, common+("load", "required_minutes"), optional+("max_parallel_strings", "time_range_minutes"))
        if number(request.get("age_factor", 1), "age_factor") != 1 or number(request.get("reserve_factor", 1), "reserve_factor") != 1 or number(request.get("temperature_c", 25), "temperature_c") != 25:
            raise CalculationError("simple_mode_conditions", "Simple mode uses 25 C and age/reserve factors of 1")
    else:
        raise CalculationError("invalid_operation", "Use runtime, profile or select")
    if "configuration_id" in request:
        text(request["configuration_id"], "configuration_id")
    models, rejected = read_dataset(document["dataset"], demo)
    kwargs = {k:v for k,v in request.items() if k not in ("operation", "model_id")}
    kwargs["demo"] = demo
    if op == "select":
        result = select(models, **kwargs)
    else:
        model_id = text(request["model_id"], "model_id")
        model = next((m for m in models if m.id == model_id), None)
        if model is None:
            reason = next((x for x in rejected if x["model_id"] == model_id), None)
            raise CalculationError("model_unavailable", str(reason) if reason else "Model not in supplied new dataset")
        if op == "profile":
            stages = []
            for row in sequence(kwargs["stages"], "stages"):
                object_fields(row, ("load", "duration_minutes"))
                stages.append(Stage(**row))
            kwargs["stages"] = stages
            result = size_profile(model, **kwargs)
        else:
            result = runtime(model, **kwargs)
    dataset = document["dataset"]
    encoded = json.dumps(dataset, sort_keys=True, ensure_ascii=False, allow_nan=False).encode("utf-8")
    return {"result": result, "rejected_models": rejected,
            "dataset_id": dataset["dataset_id"], "dataset_revision": dataset["revision"],
            "dataset_sha256": hashlib.sha256(encoded).hexdigest(), "input_snapshot": document,
            "demo": dataset["origin"] == "synthetic", "release_status": "mathcad_parity_pending",
            "production_ready": False}
