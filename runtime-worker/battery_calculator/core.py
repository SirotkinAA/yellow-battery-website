"""Pure calculation functions; time in minutes, power in W/cell, current in A.

The sectional method implements SPECIFICATION.md, not certification to IEEE-485.
Mathcad parity on the new HR-M/HR-WM dataset remains a release requirement.
"""
from dataclasses import dataclass, asdict
import math
from typing import Optional, Tuple

ENGINE_VERSION = "0.1.0"
SERIES = {"HR-M", "HR-WM"}
COMPONENTS = ("battery", "terminals", "interconnects", "protection")


class CalculationError(ValueError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def number(value, name, minimum=None, strict=False):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise CalculationError("invalid_number", name + " must be a finite number")
    try:
        # Decimal comma is accepted; grouping separators and mixed notation are not.
        if isinstance(value, str):
            if "," in value and "." in value:
                raise ValueError()
            value = value.strip().replace(",", ".")
        result = float(value)
    except (ValueError, OverflowError):
        raise CalculationError("invalid_number", name + " must be a finite number")
    if not math.isfinite(result):
        raise CalculationError("invalid_number", name + " must be finite")
    if minimum is not None and (result < minimum or (strict and result == minimum)):
        raise CalculationError("invalid_range", name + " is outside its allowed range")
    return result


def positive(value, name):
    return number(value, name, 0, True)


def count(value, name):
    result = positive(value, name)
    if not result.is_integer():
        raise CalculationError("invalid_integer", name + " must be a positive integer")
    return int(result)


def dc_power(load, unit, efficiency_percent, power_factor=None, allow_zero=False):
    load = number(load, "load", 0, not allow_zero)
    efficiency = positive(efficiency_percent, "efficiency_percent")
    if efficiency > 100:
        raise CalculationError("invalid_efficiency", "Efficiency cannot exceed 100%")
    if unit == "kVA":
        pf = positive(power_factor, "power_factor")
        if pf > 1:
            raise CalculationError("invalid_power_factor", "Power factor cannot exceed 1")
    elif unit == "kW":
        pf = 1  # An inactive PF field must never change active power.
    else:
        raise CalculationError("invalid_unit", "Load unit must be kW or kVA")
    return positive(load * 1000 * pf / (efficiency / 100), "dc_power") if load else 0.0


def normalize_values(values, unit, cells):
    cells = count(cells, "cells")
    if unit not in ("W/battery", "W/cell", "V/battery", "V/cell", "A"):
        raise CalculationError("invalid_unit", "Unsupported characteristic unit")
    divisor = cells if unit in ("W/battery", "V/battery") else 1
    return tuple(positive(v, "characteristic") / divisor for v in values)


def series_count(nominal_dc_voltage, battery_voltage):
    quotient = positive(nominal_dc_voltage, "nominal_dc_voltage") / positive(battery_voltage, "battery_voltage")
    # Permit arithmetic noise, not rounding to a different physical configuration.
    rounded = round(quotient)
    if not math.isclose(quotient, rounded, rel_tol=0, abs_tol=1e-10) or rounded < 1:
        raise CalculationError("incompatible_voltage", "DC voltage is not a whole number of batteries")
    return rounded


@dataclass(frozen=True)
class Curve:
    mode: str
    end_voltage_v_cell: float
    temperature_c: float
    times_minutes: Tuple[float, ...]
    values: Tuple[float, ...]
    source_ref: str
    revision: str
    approval: str = "needs_review"

    def __post_init__(self):
        if self.mode not in ("constant_power", "constant_current"):
            raise CalculationError("invalid_mode", "Unsupported discharge mode")
        object.__setattr__(self, "end_voltage_v_cell", positive(self.end_voltage_v_cell, "end_voltage"))
        object.__setattr__(self, "temperature_c", number(self.temperature_c, "temperature"))
        ts = tuple(positive(t, "time") for t in self.times_minutes)
        vs = tuple(positive(v, "value") for v in self.values)
        if len(ts) < 2 or len(ts) != len(vs):
            raise CalculationError("invalid_curve", "Curve needs at least two equal-length axes")
        if any(b <= a for a, b in zip(ts, ts[1:])):
            raise CalculationError("invalid_curve", "Time must strictly increase")
        if any(b > a for a, b in zip(vs, vs[1:])):
            raise CalculationError("invalid_curve", "Discharge values must not increase with duration")
        if not self.source_ref or not self.revision or self.approval not in ("approved", "needs_review", "retired"):
            raise CalculationError("invalid_provenance", "Curve needs source, revision and valid approval")
        object.__setattr__(self, "times_minutes", ts)
        object.__setattr__(self, "values", vs)

    def at(self, minutes):
        t = positive(minutes, "duration_minutes")
        if not self.times_minutes[0] <= t <= self.times_minutes[-1]:
            raise CalculationError("outside_curve", "Duration is outside the source table")
        for time, value in zip(self.times_minutes, self.values):
            if t == time:
                return value
        for i, (a, b) in enumerate(zip(self.times_minutes, self.times_minutes[1:])):
            if a < t < b:
                return self.values[i] + (t - a) / (b - a) * (self.values[i+1] - self.values[i])
        raise AssertionError("Unreachable interpolation interval")

    def inverse(self, value):
        v = positive(value, "required_discharge")
        if v > self.values[0]:
            return {"kind": "less_than", "minutes": self.times_minutes[0]}
        if v < self.values[-1]:
            return {"kind": "at_least", "minutes": self.times_minutes[-1]}
        equal = [t for t, x in zip(self.times_minutes, self.values) if x == v]
        if equal:
            if len(equal) > 1:
                return {"kind": "interval", "minutes": equal[0], "upper_minutes": equal[-1]}
            return {"kind": "exact", "minutes": equal[0]}
        for i, (a, b) in enumerate(zip(self.values, self.values[1:])):
            if a > v > b:
                t = self.times_minutes[i] + (a-v)/(a-b)*(self.times_minutes[i+1]-self.times_minutes[i])
                return {"kind": "exact", "minutes": t}
        raise AssertionError("Unreachable inverse interval")


@dataclass(frozen=True)
class CurrentLimit:
    component: str
    max_a: float
    max_duration_minutes: float
    temperature_c: float
    configuration_id: str
    source_ref: str
    revision: str
    approval: str = "needs_review"

    def __post_init__(self):
        if self.component not in COMPONENTS:
            raise CalculationError("invalid_limit", "Unknown current-limit component")
        for name in ("max_a", "max_duration_minutes"):
            object.__setattr__(self, name, positive(getattr(self, name), name))
        object.__setattr__(self, "temperature_c", number(self.temperature_c, "temperature"))
        if not self.configuration_id or not self.source_ref or not self.revision:
            raise CalculationError("invalid_provenance", "Limit needs execution, source and revision")
        if self.approval not in ("approved", "needs_review", "retired"):
            raise CalculationError("invalid_provenance", "Invalid limit approval")


@dataclass(frozen=True)
class Model:
    id: str
    series: str
    nominal_voltage_v: float
    cells: int
    nominal_capacity_ah: float
    source_kind: str
    source_ref: str
    revision: str
    curves: Tuple[Curve, ...]
    current_limits: Tuple[CurrentLimit, ...] = ()

    def __post_init__(self):
        if not self.id or not self.source_ref or not self.revision:
            raise CalculationError("invalid_provenance", "Model needs id, source and revision")
        if self.series not in SERIES:
            raise CalculationError("series_out_of_scope", "Only HR-M and HR-WM are in scope")
        if self.source_kind not in ("new_shared_dataset", "synthetic"):
            raise CalculationError("forbidden_source", "Historical discharge datasets cannot be imported")
        object.__setattr__(self, "cells", count(self.cells, "cells"))
        for name in ("nominal_voltage_v", "nominal_capacity_ah"):
            object.__setattr__(self, name, positive(getattr(self, name), name))
        object.__setattr__(self, "curves", tuple(self.curves))
        object.__setattr__(self, "current_limits", tuple(self.current_limits))
        keys = [(c.mode, c.end_voltage_v_cell, c.temperature_c) for c in self.curves]
        if len(keys) != len(set(keys)):
            raise CalculationError("duplicate_curve", "Ambiguous curve for the same conditions")
        # Compare only supplied nodes; never interpolate between voltages.
        for a in self.curves:
            for b in self.curves:
                if a.mode == b.mode and a.temperature_c == b.temperature_c and a.end_voltage_v_cell < b.end_voltage_v_cell:
                    common = set(a.times_minutes) & set(b.times_minutes)
                    if any(b.at(t) > a.at(t) for t in common):
                        raise CalculationError("invalid_voltage_order", "Higher cutoff voltage increases discharge capability")

    def curve(self, end_voltage, temperature, demo=False):
        cutoff = positive(end_voltage, "end_voltage")
        temp = number(temperature, "temperature")
        if self.source_kind == "synthetic" and not demo:
            raise CalculationError("demo_only", "Synthetic data requires explicit demo mode")
        candidates = [c for c in self.curves if c.mode == "constant_power" and c.end_voltage_v_cell == cutoff]
        if not candidates:
            raise CalculationError("missing_voltage", "No power table at this cutoff voltage")
        candidates = [c for c in candidates if c.temperature_c == temp]
        if not candidates:
            raise CalculationError("temperature_data_unavailable", "No confirmed table at requested temperature; no generic correction")
        c = candidates[0]
        if c.approval != "approved" and not (demo and self.source_kind == "synthetic" and c.approval != "retired"):
            raise CalculationError("unapproved_data", "Selected curve is not approved")
        return c


@dataclass(frozen=True)
class Stage:
    load: float
    duration_minutes: float

    def __post_init__(self):
        object.__setattr__(self, "load", number(self.load, "stage_load", 0))
        object.__setattr__(self, "duration_minutes", positive(self.duration_minutes, "stage_duration"))


def factors(age_factor, reserve_factor):
    return number(age_factor, "age_factor", 1) * number(reserve_factor, "reserve_factor", 1)


def checks(model, current_a, duration, temperature, configuration_id, bounded=True):
    details = []
    for component in COMPONENTS:
        limits = [lim for lim in model.current_limits if lim.component == component
                  and lim.approval == "approved" and lim.configuration_id == configuration_id
                  and lim.temperature_c == temperature and lim.max_duration_minutes >= duration]
        failed = [lim for lim in limits if current_a > lim.max_a]
        state = "exceeded" if failed else ("checked" if limits and bounded else "not_checked")
        details.append({"component": component, "status": state,
                        "limits": [asdict(lim) for lim in limits]})
    status = "exceeded" if any(x["status"] == "exceeded" for x in details) else (
        "checked" if all(x["status"] == "checked" for x in details) else "not_checked")
    return {"status": status, "string_current_a": current_a, "duration_minutes": duration,
            "configuration_id": configuration_id, "components": details,
            "assumption": "equal current sharing; per-string limits; no cable voltage-drop or thermal model"}


def metadata(model, curve):
    return {"engine_version": ENGINE_VERSION, "model_id": model.id, "series": model.series,
            "model_revision": model.revision, "source_kind": model.source_kind,
            "curve_source": curve.source_ref, "curve_revision": curve.revision,
            "curve_approval": curve.approval, "mode": "demo" if model.source_kind == "synthetic" else "production_data",
            "validation": "mathcad_parity_pending"}


def runtime(model, load, unit, efficiency_percent, series_batteries, parallel_strings,
            end_voltage_v_cell, temperature_c=25, power_factor=None, age_factor=1,
            reserve_factor=1, configuration_id=None, demo=False):
    curve = model.curve(end_voltage_v_cell, temperature_c, demo)
    ns, np = count(series_batteries, "series_batteries"), count(parallel_strings, "parallel_strings")
    pdc = dc_power(load, unit, efficiency_percent, power_factor)
    k = factors(age_factor, reserve_factor)
    actual = pdc / (ns * model.cells * np)
    time = curve.inverse(actual * k)
    # Finite intervals are conservatively checked up to their upper end.
    duration = time.get("upper_minutes", time["minutes"])
    current = actual / curve.end_voltage_v_cell
    check = checks(model, current, duration, curve.temperature_c, configuration_id,
                   bounded=time["kind"] in ("exact", "interval"))
    return {**metadata(model, curve), "operation": "runtime", "runtime": time,
            "dc_power_w": pdc, "power_w_cell": actual, "equivalent_power_w_cell": actual*k,
            "correction_factor": k, "temperature_factor": 1,
            "series_batteries": ns, "parallel_strings": np, "total_batteries": ns*np,
            "current_check": check, "fully_checked": model.source_kind != "synthetic" and check["status"] == "checked"}


def size_profile(model, stages, unit, efficiency_percent, series_batteries,
                 end_voltage_v_cell, temperature_c=25, power_factor=None,
                 age_factor=1, reserve_factor=1, max_parallel_strings=5,
                 configuration_id=None, demo=False):
    curve = model.curve(end_voltage_v_cell, temperature_c, demo)
    ns = count(series_batteries, "series_batteries")
    maximum = count(max_parallel_strings, "max_parallel_strings")
    stages = tuple(stages)
    if not stages or len(stages) > 100:
        raise CalculationError("invalid_profile", "Provide 1–100 stages (computational limit)")
    ps = [dc_power(s.load, unit, efficiency_percent, power_factor, allow_zero=True) / (ns*model.cells) for s in stages]
    if not any(ps):
        raise CalculationError("zero_profile", "Entire profile cannot have zero load")
    delta = [ps[0]] + [b-a for a, b in zip(ps, ps[1:])]
    sections = []
    for j in range(len(stages)):
        contributions = []
        for i in range(j+1):
            minutes = math.fsum(s.duration_minutes for s in stages[i:j+1])
            factor = model.nominal_capacity_ah / curve.at(minutes)
            contributions.append({"stage": i+1, "remaining_minutes": minutes,
                                  "delta_power_w_cell": delta[i], "factor_ah_per_w": factor,
                                  "capacity_ah": delta[i]*factor})
        sections.append({"section": j+1, "capacity_ah": math.fsum(c["capacity_ah"] for c in contributions),
                         "contributions": contributions})
    critical = max(sections, key=lambda x: x["capacity_ah"])
    required = positive(critical["capacity_ah"] * factors(age_factor, reserve_factor), "required_capacity")
    # No tolerance-based downward rounding: never remove genuinely needed capacity.
    np = math.ceil(required / model.nominal_capacity_ah)
    duration = math.fsum(s.duration_minutes for s in stages)
    # Conservative sustained-envelope check: peak actual current for full duty duration.
    peak = max(ps) / (np*curve.end_voltage_v_cell)
    check = checks(model, peak, duration, curve.temperature_c, configuration_id)
    return {**metadata(model, curve), "operation": "profile", "sections": sections,
            "base_capacity_ah": critical["capacity_ah"], "required_capacity_ah": required,
            "critical_section": critical["section"], "parallel_strings": np,
            "installed_capacity_ah": np*model.nominal_capacity_ah, "series_batteries": ns,
            "total_batteries": ns*np, "max_parallel_strings": maximum,
            "within_parallel_limit": np <= maximum, "temperature_factor": 1,
            "current_check": check, "current_check_method": "peak_current_for_full_profile_duration",
            "fully_checked": model.source_kind != "synthetic" and np <= maximum and check["status"] == "checked"}


def select(models, required_minutes, max_parallel_strings=5, time_range_minutes=None, **kwargs):
    target = positive(required_minutes, "required_minutes")
    lower, upper = 0.8*target, 1.2*target
    if time_range_minutes is not None:
        if not isinstance(time_range_minutes, (list, tuple)) or len(time_range_minutes) != 2:
            raise CalculationError("invalid_range", "time_range_minutes requires two bounds")
        lower = positive(time_range_minutes[0], "minimum_minutes")
        upper = None if time_range_minutes[1] is None else positive(time_range_minutes[1], "maximum_minutes")
        if upper is not None and upper <= lower:
            raise CalculationError("invalid_range", "maximum_minutes must exceed minimum_minutes")
        target = lower
    maximum = count(max_parallel_strings, "max_parallel_strings")
    if maximum > 100:
        raise CalculationError("resource_limit", "Maximum enumeration is 100 parallel strings")
    # Validate shared input before per-model failures are collected.
    dc_power(kwargs.get("load"), kwargs.get("unit"), kwargs.get("efficiency_percent"), kwargs.get("power_factor"))
    count(kwargs.get("series_batteries"), "series_batteries")
    positive(kwargs.get("end_voltage_v_cell"), "end_voltage_v_cell")
    number(kwargs.get("temperature_c", 25), "temperature_c")
    factors(kwargs.get("age_factor", 1), kwargs.get("reserve_factor", 1))
    groups = {"meets_target": [], "below_target": []}
    exclusions = []
    for model in models:
        for np in range(1, maximum+1):
            try:
                r = runtime(model, parallel_strings=np, **kwargs)
            except CalculationError as exc:
                exclusions.append({"model_id": model.id, "code": exc.code, "message": str(exc)})
                break  # Model/curve/input eligibility is independent of parallel count.
            time = r["runtime"]
            if r["current_check"]["status"] == "exceeded":
                exclusions.append({"model_id": model.id, "parallel_strings": np, "code": "current_exceeded"})
                continue
            if time["kind"] not in ("exact", "interval"):
                exclusions.append({"model_id": model.id, "parallel_strings": np,
                                   "code": "time_not_exact", "runtime_bound": time})
                continue
            minutes = time["minutes"]
            end_minutes = time.get("upper_minutes", minutes) if time_range_minutes is not None else minutes
            in_range = (minutes > lower if upper is None else lower <= minutes and end_minutes <= upper)
            if in_range:
                group = "meets_target" if minutes >= target else "below_target"
                r["target_difference_minutes"] = minutes-target
                groups[group].append(r)
    for rows in groups.values():
        rows.sort(key=lambda r: (abs(r["target_difference_minutes"]), r["parallel_strings"], r["total_batteries"], r["model_id"]))
    return {"engine_version": ENGINE_VERSION, "operation": "select", "target_minutes": target,
            "band_minutes": [lower, upper], "time_range_minutes": time_range_minutes, "groups": groups, "exclusions": exclusions,
            "display_limit": 10, "total_candidates": sum(len(v) for v in groups.values())}
