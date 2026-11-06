"""Read-only channel catalogue. Schema/imports run through D1 control plane."""
import json
from urllib.parse import parse_qs
from unified_catalog import Catalogue

PUBLIC_CHANNELS={'invertomatic'}
MODEL_FIELDS={'model_id','name','slug','family','placement','technology','specifications','rating_conditions'}
SPEC_FIELDS={'total_cooling_capacity_kw','sensible_cooling_capacity_kw','airflow_m3h'}
CONDITION_FIELDS={'return_air_temperature_c','return_air_rh_percent','outdoor_temperature_c','revision'}

async def catalogue(store, query):
    values=parse_qs(query)
    channel=values.get('channel',[''])[0]
    if channel not in PUBLIC_CHANNELS or len(values.get('channel',[]))!=1:
        return 404,{'error':'unknown_catalogue'}
    if store is None:return 503,{'error':'catalogue_unavailable'}
    revision,records=await Catalogue(store).records(channel,'cooling')
    source={'models':list(records.values())}
    # Never serialize internal fields, even if a future import contains them.
    models=[]
    for item in sorted(source['models'],key=lambda m:m['name']):
        m={k:v for k,v in item.items() if k in MODEL_FIELDS}
        m['specifications']={k:v for k,v in m.get('specifications',{}).items() if k in SPEC_FIELDS}
        m['rating_conditions']={k:v for k,v in (m.get('rating_conditions') or {}).items() if k in CONDITION_FIELDS}
        models.append(m)
    return 200,{'schema_version':1,'channel':channel,'release_id':revision,'models':models}
