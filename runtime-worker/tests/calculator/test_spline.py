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
