"""Public metadata and example requests for the leaflet-backed catalogue."""
def catalog_summary(dataset):
    return {'dataset_id':dataset['dataset_id'], 'revision':dataset['revision'],
            'models':[{'id':m['id'],'series':m['series'],'capacity_ah':m['nominal_capacity_ah'],
                       'conditions':[{'temperature_c':c['temperature_c'],'end_voltage':c['end_voltage'],
                                      'min_minutes':min(c['times']),'max_minutes':max(c['times'])}
                                     for c in m['curves'] if c['mode']=='constant_power']}
                      for m in dataset['models']]}


def example_requests():
    common=dict(unit='kW',efficiency_percent=100,series_batteries=1,
                end_voltage_v_cell=1.80,temperature_c=25)
    return {'select':dict(common,operation='select',load=.5,required_minutes=5,max_parallel_strings=5),
            'runtime':dict(common,operation='runtime',model_id='HR 12-12M',load=.222,
                           parallel_strings=1,age_factor=1,reserve_factor=1),
            'profile':dict(common,operation='profile',model_id='HR 12-12M',max_parallel_strings=5,
                           stages=[{'load':.222,'duration_minutes':5},{'load':.1,'duration_minutes':10}],
                           age_factor=1,reserve_factor=1)}
