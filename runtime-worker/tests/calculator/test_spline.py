"""Independent analytic checks, plus regression checks on the approved data."""
import json
from pathlib import Path
import unittest
from battery_calculator.core import Curve, CalculationError, size_profile, Stage
from battery_calculator.io import read_dataset

ROOT=Path(__file__).resolve().parents[2]
class NaturalSplineTests(unittest.TestCase):
    def curve(self,x,y):
        return Curve('constant_power',1.8,25,tuple(x),tuple(y),'synthetic:analytic','1','approved')

    def test_three_node_hand_calculation_and_inverse(self):
        # h=1; 4*M1=6*((2-3)-(3-5)), so M=[0,1.5,0].
        # At x=1.5: (5+3)/2 + ((.5**3-.5)*1.5)/6 = 3.90625.
        c=self.curve([1,2,3],[5,3,2])
        self.assertEqual(c.at(1.5),3.90625)
        self.assertEqual(c.at(2.5),2.40625)
        self.assertAlmostEqual(c.inverse(3.90625)['minutes'],1.5,places=12)
        self.assertNotEqual(c.at(1.5),4)
        self.assertEqual(c.spline_segments[0][2],0)
        _,_,q,d=c.spline_segments[-1]
        self.assertAlmostEqual(2*q+6*d,0)

    def test_uneven_nodes_independent_rational_solution(self):
        # x=[1,2,4], y=[9,5,3]: 6*M1=18, M1=3.
        c=self.curve([1,2,4],[9,5,3])
        self.assertEqual(c.at(1.5),6.8125)
        self.assertEqual(c.at(3),3.25)
        self.assertAlmostEqual(c.inverse(3.25)['minutes'],3,places=12)

    def test_overshoot_is_not_silently_linearized(self):
        c=self.curve([5,10,15,20],[100,80,80,40])
        self.assertFalse(c.spline_is_monotone)
        for operation in [lambda:c.at(12),lambda:c.inverse(80)]:
            with self.assertRaises(CalculationError) as ctx:operation()
            self.assertEqual(ctx.exception.code,'nonmonotone_spline')

    def test_all_approved_curves_nodes_and_roundtrips(self):
        models,rejected=read_dataset(json.loads((ROOT/'data/calculator/leaflets-v1.json').read_text()))
        self.assertFalse(rejected)
        review=[]
        for m in models:
            for c in m.curves:
                for t,v in zip(c.times_minutes,c.values):self.assertEqual(c.at(t),v)
                if not c.spline_is_monotone:
                    review.append((m.id,c.mode));continue
                for a,b in zip(c.times_minutes,c.times_minutes[1:]):
                    for f in [.1,.5,.9]:
                        t=a+(b-a)*f
                        self.assertAlmostEqual(c.inverse(c.at(t))['minutes'],t,places=7)
        self.assertEqual(review,[('HRL 12-22WM','constant_power')]*5)

    def test_profile_uses_same_nonlinear_curve(self):
        from battery_calculator.core import Model
        c=self.curve([1,2,3],[5,3,2])
        m=Model('TEST','HR-M',12,6,10,'synthetic','synthetic:test','1',(c,))
        r=size_profile(m,[Stage(.0234375,1.5)],'kW',100,1,1.8,demo=True)
        # 23.4375 W / 6 = 3.90625 W/cell: one string exactly at 1.5 min.
        self.assertAlmostEqual(r['required_capacity_ah'],10)
        self.assertEqual(r['parallel_strings'],1)

    def test_remote_overshoot_does_not_exclude_short_runtime(self):
        from battery_calculator.core import select
        models,_=read_dataset(json.loads((ROOT/'data/calculator/leaflets-v1.json').read_text()))
        m=next(m for m in models if m.id=='HRL 12-22WM')
        c=next(c for c in m.curves if c.mode=='constant_power' and c.end_voltage_v_cell==1.8)
        self.assertFalse(c.spline_is_monotone)
        # Evaluate the original full-table polynomial independently of at().
        i=c.times_minutes.index(5)
        a,b,q,d=c.spline_segments[i]
        power=((d*2.5+q)*2.5+b)*2.5+a
        self.assertEqual(c.at(7.5),power)
        self.assertAlmostEqual(c.inverse(power)['minutes'],7.5)
        result=select([m],5,time_range_minutes=[5,10],max_parallel_strings=1,
                      load=power*6/1000,unit='kW',efficiency_percent=100,
                      series_batteries=1,end_voltage_v_cell=1.8)
        self.assertEqual(result['total_candidates'],1)
        self.assertEqual(result['exclusions'],[])
        for operation in [lambda:c.at(900),lambda:c.inverse(.5),lambda:c.inverse(.3)]:
            with self.assertRaises(CalculationError) as ctx: operation()
            self.assertEqual(ctx.exception.code,'nonmonotone_spline')

    def test_selection_continues_after_interval_failure(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        from battery_calculator.core import select
        # A rejected interval for one string must not skip later configurations.
        good={'runtime':{'kind':'exact','minutes':7.5},'current_check':{'status':'not_checked'},
              'model_id':'TEST','parallel_strings':2,'total_batteries':2}
        with patch('battery_calculator.core.runtime',side_effect=[CalculationError('nonmonotone_spline','test'),good]) as run:
            result=select([SimpleNamespace(id='TEST')],5,time_range_minutes=[5,10],max_parallel_strings=2,
                          load=1,unit='kW',efficiency_percent=100,series_batteries=1,end_voltage_v_cell=1.8)
        self.assertEqual(run.call_count,2)
        self.assertEqual(result['total_candidates'],1)
        self.assertEqual(result['exclusions'][0]['parallel_strings'],1)

    def test_original_mathcad_cached_results(self):
        # Reference-only legacy tables: never imported into the production dataset.
        cases=json.loads((ROOT/'tests/calculator/fixtures/mathcad-cached-spline.json').read_text())
        for case in cases:
            c=self.curve(case['times'],case['values'])
            for t,expected in zip(case['check_times'],case['mathcad_values']):
                i=next(i for i in range(len(c.times_minutes)-1) if c.times_minutes[i]<=t<=c.times_minutes[i+1])
                a,b,q,d=c.spline_segments[i]
                u=t-c.times_minutes[i]
                # Compare the mathematical spline even where product safety checks reject it.
                actual=((d*u+q)*u+b)*u+a
                self.assertAlmostEqual(actual,expected,delta=1e-11)
            if 'target' in case:
                self.assertAlmostEqual(c.inverse(case['target'])['minutes'],case['mathcad_minutes'],delta=1e-9)
