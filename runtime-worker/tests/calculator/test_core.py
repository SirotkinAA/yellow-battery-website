import copy
from dataclasses import replace
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from battery_calculator.core import (CalculationError, Curve, Model, Stage, CurrentLimit,
    dc_power, normalize_values, series_count, runtime, size_profile, select, number)
from battery_calculator.io import execute, read_dataset

ROOT = Path(__file__).resolve().parents[2]


def model(times=(5, 10, 15, 20), values=(100, 80, 60, 40), **kwargs):
    curve = Curve("constant_power", 1.75, 25, times, values, "synthetic:curve", "test-1")
    return Model("SYNTHETIC", "HR-M", 12, 6, 100, "synthetic", "synthetic:model", "test-1", (curve,), **kwargs)


def params(**overrides):
    result = dict(load=.48, unit="kW", efficiency_percent=100, series_batteries=1,
                  parallel_strings=1, end_voltage_v_cell=1.75, demo=True)
    result.update(overrides)
    return result


class ArithmeticTests(unittest.TestCase):
    def test_historical_control_arithmetic_without_catalog_import(self):
        cases = json.loads((ROOT/"docs/calculator/reference-cases.json").read_text())["historical_arithmetic"]
        for c in cases:
            with self.subTest(c["id"]):
                p = dc_power(c["load"], c["unit"], c["efficiency_percent"], c.get("pf", .5))
                self.assertAlmostEqual(p/(c["batteries_per_string"]*c["cells_per_battery"]), c["expected_w_per_cell"], places=10)

    def test_kw_ignores_even_invalid_inactive_pf(self):
        self.assertEqual(dc_power(1, "kW", 100, "inactive"), 1000)

    def test_units(self):
        self.assertAlmostEqual(normalize_values([1766], "W/battery", 6)[0], 294.3333333333333)
        self.assertEqual(normalize_values([159], "A", 6), (159,))
        self.assertAlmostEqual(normalize_values([9.9], "V/battery", 6)[0], 1.65)
        self.assertEqual(series_count(744, 12), 62)
        with self.assertRaises(CalculationError):
            series_count(745, 12)

    def test_bad_numeric_and_ranges(self):
        for bad in (True, None, [], "", "1,000.5", float("nan"), float("inf")):
            with self.subTest(bad=bad), self.assertRaises(CalculationError):
                number(bad, "value")
        self.assertEqual(number(" 1,5 ", "value"), 1.5)
        for load, unit, efficiency, pf in [(0,"kW",93,1),(-1,"kW",93,1),(1,"kWh",93,1),(1,"kVA",93,None),(1,"kVA",93,1.1),(1,"kW",101,1),(1,"kW",0,1)]:
            with self.subTest(load=load,unit=unit,efficiency=efficiency,pf=pf), self.assertRaises(CalculationError):
                dc_power(load, unit, efficiency, pf)


class CurveTests(unittest.TestCase):
    def test_nodes_midpoint_inverse(self):
        c = model((15,20),(40,20)).curves[0]
        self.assertEqual(c.at(15),40)
        self.assertEqual(c.at(17.5),30)
        self.assertEqual(c.inverse(30),{"kind":"exact","minutes":17.5})
        for t in (15,15.001,16,18.5,19.99,20):
            self.assertAlmostEqual(c.inverse(c.at(t))["minutes"], t, places=10)

    def test_no_extrapolation_and_bounds(self):
        c=model().curves[0]
        for t in (1,180):
            with self.assertRaises(CalculationError):c.at(t)
        self.assertEqual(c.inverse(101),{"kind":"less_than","minutes":5})
        self.assertEqual(c.inverse(39),{"kind":"at_least","minutes":20})

    def test_plateau_returns_lower_bound_and_full_interval(self):
        c=model((5,10,15,20),(100,80,80,40)).curves[0]
        self.assertEqual(c.inverse(80),{"kind":"interval","minutes":10,"upper_minutes":15})

    def test_invalid_curves(self):
        for ts,vs in [((5,5),(100,80)),((5,10),(80,100)),((5,10),(80,0)),((5,10),(80,)),((5,),(80,))]:
            with self.subTest(ts=ts,vs=vs), self.assertRaises(CalculationError):model(ts,vs)

    def test_missing_cutoff_temperature(self):
        for kw, code in [({"end_voltage_v_cell":1.65},"missing_voltage"),({"temperature_c":0},"temperature_data_unavailable")]:
            with self.assertRaises(CalculationError) as ctx:runtime(model(),**params(**kw))
            self.assertEqual(ctx.exception.code,code)

    def test_duplicate_and_voltage_order(self):
        m=model()
        with self.assertRaises(CalculationError):replace(m,curves=(m.curves[0],m.curves[0]))
        higher=replace(m.curves[0],end_voltage_v_cell=1.8,values=(110,90,70,50))
        with self.assertRaises(CalculationError):replace(m,curves=(m.curves[0],higher))


class EngineTests(unittest.TestCase):
    def test_parallel_scaling_and_age_once(self):
        a=runtime(model(),**params())
        b=runtime(model(),**params(parallel_strings=2,age_factor=1.25,reserve_factor=1.1))
        self.assertEqual(a["power_w_cell"],80)
        self.assertEqual(b["power_w_cell"],40)
        self.assertAlmostEqual(b["equivalent_power_w_cell"],55)
        self.assertEqual(b["total_batteries"],2)
        self.assertAlmostEqual(b["runtime"]["minutes"],16.25)

    def test_critical_section_is_not_last_and_round_up(self):
        result=size_profile(model(),[Stage(.54,5),Stage(.06,5)],"kW",100,1,1.75,
                            age_factor=1.25,reserve_factor=1.1,max_parallel_strings=1,demo=True)
        self.assertEqual([s["capacity_ah"] for s in result["sections"]],[90,32.5])
        self.assertEqual(result["critical_section"],1)
        self.assertAlmostEqual(result["required_capacity_ah"],123.75)
        self.assertEqual(result["parallel_strings"],2)
        self.assertEqual(result["installed_capacity_ah"],200)
        self.assertFalse(result["within_parallel_limit"])

    def test_single_stage_capacity(self):
        r=size_profile(model(),[Stage(.54,5)],"kW",100,1,1.75,demo=True)
        self.assertEqual(r["base_capacity_ah"],90)
        self.assertEqual(r["parallel_strings"],1)

    def test_negative_step_preserved_including_zero_load(self):
        r=size_profile(model(),[Stage(.54,5),Stage(0,5)],"kW",100,1,1.75,demo=True)
        self.assertEqual(r["sections"][1]["contributions"][1]["delta_power_w_cell"],-90)
        self.assertEqual(r["critical_section"],1)

    def test_profile_validation_and_source_range(self):
        for stages in ([],[Stage(0,5)],[Stage(.5,30)]):
            with self.subTest(stages=stages), self.assertRaises(CalculationError):
                size_profile(model(),stages,"kW",100,1,1.75,demo=True)
        with self.assertRaises(CalculationError):Stage(1,0)
        with self.assertRaises(CalculationError):Stage(-1,5)

    def test_missing_limits_is_not_pass(self):
        r=runtime(model(),**params())
        self.assertEqual(r["current_check"]["status"],"not_checked")
        self.assertFalse(r["fully_checked"])

    def test_five_second_limit_not_sixty_minutes(self):
        limit=CurrentLimit("battery",1000,5/60,25,"cfg","synthetic:limit","1","approved")
        r=runtime(model((5,60),(100,80),current_limits=(limit,)),**params(configuration_id="cfg"))
        self.assertEqual(r["runtime"]["minutes"],60)
        self.assertEqual(r["current_check"]["components"][0]["status"],"not_checked")

    def test_limits_require_execution_and_temperature(self):
        limits=tuple(CurrentLimit(c,100,60,25,"cfg","synthetic:limit","1","approved") for c in ("battery","terminals","interconnects","protection"))
        m=model(current_limits=limits)
        self.assertEqual(runtime(m,**params(configuration_id="other"))["current_check"]["status"],"not_checked")
        good=runtime(m,**params(configuration_id="cfg"))
        self.assertEqual(good["current_check"]["status"],"checked")
        self.assertFalse(good["fully_checked"])  # Synthetic fixture is never a real recommendation.
        bad=replace(m,current_limits=(replace(limits[0],max_a=1),)+limits[1:])
        self.assertEqual(runtime(bad,**params(configuration_id="cfg"))["current_check"]["status"],"exceeded")

    def test_unbounded_runtime_not_fully_current_checked(self):
        limits=tuple(CurrentLimit(c,100,60,25,"cfg","synthetic:limit","1","approved") for c in ("battery","terminals","interconnects","protection"))
        r=runtime(model(current_limits=limits),**params(load=.12,configuration_id="cfg"))
        self.assertEqual(r["runtime"]["kind"],"at_least")
        self.assertEqual(r["current_check"]["status"],"not_checked")

    def test_select_band_inclusive_and_unrounded_target(self):
        models=[replace(model((t,t+10),(80,40)),id="test-"+str(t)) for t in (8,9.99,10,12,12.01)]
        kw=params();kw.pop("parallel_strings")
        r=select(models,10,max_parallel_strings=1,**kw)
        self.assertEqual([x["runtime"]["minutes"] for x in r["groups"]["meets_target"]],[10,12])
        self.assertEqual([x["runtime"]["minutes"] for x in r["groups"]["below_target"]],[9.99,8])

    def test_failed_limits_are_excluded(self):
        lim=CurrentLimit("battery",1,60,25,"cfg","synthetic:limit","1","approved")
        kw=params(configuration_id="cfg");kw.pop("parallel_strings")
        r=select([model(current_limits=(lim,))],10,max_parallel_strings=1,**kw)
        self.assertEqual(r["total_candidates"],0)
        self.assertEqual(r["exclusions"][0]["code"],"current_exceeded")

    def test_select_isolates_missing_voltage(self):
        m=model();bad=replace(m,id="missing",curves=(replace(m.curves[0],end_voltage_v_cell=1.8),))
        kw=params();kw.pop("parallel_strings")
        r=select([bad,m],10,max_parallel_strings=1,**kw)
        self.assertEqual(r["total_candidates"],1)
        self.assertEqual(r["exclusions"][0]["code"],"missing_voltage")

    def test_input_errors_not_silently_empty_results(self):
        kw=params(load=0);kw.pop("parallel_strings")
        with self.assertRaises(CalculationError):select([],10,**kw)


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.document=json.loads((ROOT/"examples/calculator/runtime.json").read_text())

    def test_synthetic_requires_explicit_demo(self):
        with self.assertRaises(CalculationError):execute(self.document)
        r=execute(self.document,demo=True)
        self.assertTrue(r["demo"])
        self.assertFalse(r["production_ready"])

    def test_forbidden_origin_even_if_approved(self):
        for origin in ("russian_site","archive","mathcad"):
            self.document["dataset"]["origin"]=origin
            self.document["dataset"]["models"][0]["curves"][0]["approval"]="approved"
            with self.subTest(origin=origin),self.assertRaises(CalculationError):execute(self.document,demo=True)

    def test_unapproved_new_curve_not_bypassed_by_demo(self):
        self.document["dataset"]["origin"]="new_shared_dataset"
        with self.assertRaises(CalculationError):execute(self.document,demo=True)

    def test_units_normalized_and_current_not_divided(self):
        c=self.document["dataset"]["models"][0]["curves"][0]
        c.update(mode="constant_current",value_unit="A",voltage_unit="V/battery",end_voltage=10.5,time_unit="hours",times=[1,1.5],values=[159,100])
        models,rejected=read_dataset(self.document["dataset"],demo=True)
        self.assertFalse(rejected)
        curve=models[0].curves[0]
        self.assertEqual(curve.times_minutes,(60,90))
        self.assertEqual(curve.values,(159,100))
        self.assertEqual(curve.end_voltage_v_cell,1.75)

    def test_partial_catalog_invalid_model_reported(self):
        bad=copy.deepcopy(self.document["dataset"]["models"][0]);bad.update(id="BAD",series="ABF")
        self.document["dataset"]["models"].append(bad)
        r=execute(self.document,demo=True)
        self.assertEqual(r["rejected_models"][0]["code"],"series_out_of_scope")
        self.assertEqual(r["result"]["runtime"]["minutes"],30)

    def test_duplicate_ids_and_unknown_fields(self):
        self.document["dataset"]["models"]*=2
        with self.assertRaises(CalculationError):execute(self.document,demo=True)
        self.setUp();self.document["request"]["temperature_factor"]=1.2
        with self.assertRaises(CalculationError):execute(self.document,demo=True)

    def test_simple_mode_conditions_and_determinism(self):
        doc=json.loads((ROOT/"examples/calculator/select.json").read_text())
        self.assertEqual(execute(doc,demo=True),execute(doc,demo=True))
        doc["request"]["age_factor"]=1.25
        with self.assertRaises(CalculationError):execute(doc,demo=True)

    def test_invalid_curve_type_is_rejected_without_traceback(self):
        self.document["dataset"]["models"][0]["curves"][0]["mode"]=[]
        models,rejected=read_dataset(self.document["dataset"],demo=True)
        self.assertFalse(models)
        self.assertEqual(rejected[0]["code"],"invalid_text")

    def test_partial_approval_is_by_selected_curve(self):
        self.document["dataset"]["origin"]="new_shared_dataset"
        c=self.document["dataset"]["models"][0]["curves"][0]
        c["approval"]="approved"
        other=copy.deepcopy(c);other.update(end_voltage=1.8,approval="needs_review",values=[v*.9 for v in c["values"]])
        self.document["dataset"]["models"][0]["curves"].append(other)
        self.assertFalse(execute(self.document)["production_ready"])
        self.document["request"]["end_voltage_v_cell"]=1.8
        with self.assertRaises(CalculationError):execute(self.document)

    def test_cli_bad_json_and_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/"bad.json"
            for value in ('{"x": NaN}', '{"x":1,"x":2}', '{broken'):
                src.write_text(value)
                r=subprocess.run([sys.executable,"-m","battery_calculator",str(src),"--demo"],cwd=ROOT,capture_output=True,text=True)
                self.assertEqual(r.returncode,2)
                self.assertIn("error",json.loads(r.stderr))

    def test_cli_does_not_overwrite_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/"input.json";src.write_text(json.dumps(self.document))
            before=src.read_bytes()
            r=subprocess.run([sys.executable,"-m","battery_calculator",str(src),"--demo","--output",str(src)],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(r.returncode,2)
            self.assertEqual(src.read_bytes(),before)

    def test_cli_all_three_modes_and_refusal_without_demo(self):
        with tempfile.TemporaryDirectory() as tmp:
            for mode in ("runtime","profile","select"):
                out=Path(tmp)/(mode+".json")
                run=subprocess.run([sys.executable,"-m","battery_calculator",str(ROOT/"examples/calculator"/(mode+".json")),"--demo","--output",str(out)],cwd=ROOT,capture_output=True,text=True)
                self.assertEqual(run.returncode,0,run.stderr)
                self.assertEqual(json.loads(out.read_text())["result"]["operation"],mode)
            denied=subprocess.run([sys.executable,"-m","battery_calculator",str(ROOT/"examples/calculator/runtime.json")],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(denied.returncode,2)
            self.assertEqual(json.loads(denied.stderr)["error"],"demo_only")


if __name__ == "__main__":
    unittest.main()
