"""Read-only channel catalogue. Schema/imports run through D1 control plane."""
import json
from urllib.parse import parse_qs

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
    rows=await store.query('SELECT r.release_id,r.payload FROM catalog_channel_heads h JOIN catalog_channel_releases r ON r.channel=h.channel AND r.release_id=h.release_id WHERE h.channel=?',[channel])
    if not rows:return 503,{'error':'catalogue_not_published'}
    source=json.loads(rows[0]['payload'])
    # Never serialize internal fields, even if a future import contains them.
    models=[]
    for item in source['models']:
        m={k:v for k,v in item.items() if k in MODEL_FIELDS}
        m['specifications']={k:v for k,v in m.get('specifications',{}).items() if k in SPEC_FIELDS}
        m['rating_conditions']={k:v for k,v in (m.get('rating_conditions') or {}).items() if k in CONDITION_FIELDS}
        models.append(m)
    return 200,{'schema_version':1,'channel':channel,'release_id':rows[0]['release_id'],'models':models}
