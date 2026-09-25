import json
import unittest
from pathlib import Path
from battery_calculator.io import read_dataset, execute
from battery_calculator.catalog import example_requests
ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'data/calculator/leaflets-v1.json').read_text())

class CatalogueTests(unittest.TestCase):
    def test_all_models_load_and_anomaly_is_quarantined(self):
        models,rejected=read_dataset(DATA)
        self.assertEqual(rejected,[])
        self.assertEqual(len(models),26)
        model=next(m for m in models if m.id=='HRL 12-22WM')
        self.assertEqual({c.mode for c in model.curves},{'constant_power'})
        quarantine=json.loads((ROOT/'data/calculator/leaflets-quarantine.json').read_text())
        self.assertEqual(quarantine[0]['model'],model.id)
        self.assertEqual(len(quarantine[0]['curves']),5)

    def test_printed_power_cell_value_and_runtime(self):
        request=example_requests()['runtime']
        response=execute({'dataset':DATA,'request':request})
        self.assertEqual(response['result']['runtime']['minutes'],15)
        self.assertEqual(response['result']['power_w_cell'],37)
        self.assertFalse(response['demo'])
        self.assertEqual(response['result']['current_check']['status'],'not_checked')

    def test_temperature_is_not_silently_converted(self):
        request=example_requests()['select']
        request.update(load=.2,required_minutes=5,time_range_minutes=[5,60],temperature_c=25)
        r=execute({'dataset':DATA,'request':request})['result']
        self.assertTrue(any(e['model_id']=='HR 12-40WM' and e['code']=='temperature_data_unavailable' for e in r['exclusions']))
        request['temperature_c']=20
        r=execute({'dataset':DATA,'request':request})['result']
        self.assertGreater(r['total_candidates'],0)
        self.assertEqual({m['model_id'] for group in r['groups'].values() for m in group},{'HR 12-40WM'})

    def test_default_site_request_produces_real_models(self):
        request=example_requests()['select']
        request.update(load=10,unit='kVA',power_factor=.7,efficiency_percent=93,series_batteries=20,required_minutes=5,time_range_minutes=[5,10])
        r=execute({'dataset':DATA,'request':request})['result']
        self.assertGreater(r['total_candidates'],0)
        for row in r['groups']['meets_target']:
            self.assertEqual(row['total_batteries'],20*row['parallel_strings'])
            self.assertTrue(5<=row['runtime']['minutes']<=10)
            self.assertNotIn('SYNTHETIC',row['model_id'])
