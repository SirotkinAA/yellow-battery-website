import unittest
from test_core import model, params
from battery_calculator.core import select, CalculationError

class TimeRangeTests(unittest.TestCase):
    def run_range(self, bounds, battery=None, **overrides):
        kwargs=params(**overrides)
        kwargs.pop('parallel_strings')
        return select([battery or model()], required_minutes=bounds[0],
                      max_parallel_strings=1, time_range_minutes=bounds, **kwargs)

    def test_closed_boundaries_and_no_tolerance(self):
        for bounds in ([5,10], [10,15]):
            self.assertEqual(self.run_range(bounds)['total_candidates'], 1)
        self.assertEqual(self.run_range([11,15])['total_candidates'], 0)
        self.assertEqual(self.run_range([5,9])['total_candidates'], 0)

    def test_over_twenty_hours_is_strict(self):
        battery=model(times=(600,1200,1800),values=(100,80,40))
        self.assertEqual(self.run_range([1200,None],battery)['total_candidates'],0)
        self.assertEqual(self.run_range([1200,None],battery,load=.36)['total_candidates'],1)
        # Beyond the table, a bounded runtime is not an exact selection candidate.
        self.assertEqual(self.run_range([1200,None],battery,load=.12)['total_candidates'],0)

    def test_invalid_bounds(self):
        for bounds in ([10,5],[10,10],[0,10],[10], [10,'bad']):
            with self.assertRaises(CalculationError):
                self.run_range(bounds)
