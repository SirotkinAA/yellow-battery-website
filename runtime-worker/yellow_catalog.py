"""Compatibility presentation adapters; all engineering values come from D1."""
import html,json,re
from urllib.parse import parse_qs
from unified_catalog import Catalogue

DATA_SCRIPTS={'/assets/rack-components-data.js':('rack-components','RackComponents',False),'/assets/rack-cladded-data.js':('cladded-racks','CladdedRacks',True)}
CATALOGUE_PATHS=('/catalog/','/bms/','/lithium/','/racks/','/cabinets/')
def dumps(v):return json.dumps(v,ensure_ascii=False,allow_nan=False,separators=(',',':'))
def esc(v):return html.escape(str(v),quote=True)
def bilingual(ru,en):return '<span data-lang="ru">'+ru+'</span><span data-lang="en" hidden>'+en+'</span>'
def replace_element(source,tag,marker,replacement):
 opening=next((m for m in re.finditer('<'+tag+r'\b[^>]*>',source,re.S) if marker in m[0]),None)
 if opening is None:raise ValueError('Catalogue template is missing '+marker)
 depth=1
 for m in re.finditer(r'</?'+tag+r'\b[^>]*>',source[opening.end():],re.S):
  depth+=-1 if m[0].startswith('</') else 1
  if depth==0:return source[:opening.start()]+replacement+source[opening.end()+m.end():]
 raise ValueError('Unclosed catalogue template')
def battery_card(m):
 name=esc(m['id']);slug=esc(m['slug']);capacity=f"{m['capacity']:g}";voltage=f"{m['voltage']:g}"
 return f'<article class="product-card" data-product data-series="{esc(m["series"])}" data-capacity="{capacity}" data-name="{name}"><a class="product-image" href="/catalog/{slug}/"><img src="{esc(m["drawing"])}" alt="{name}" loading="lazy"></a><div class="product-info"><p class="eyebrow">{esc(m["series"])} / AGM</p><h2><a href="/catalog/{slug}/">{name}</a></h2><div class="product-rating"><strong>{capacity} '+bilingual('А·ч','Ah')+f'</strong><span>{voltage} V</span></div><p class="rating-condition">{m["hours"]} '+bilingual('ч','h')+f' · {m["end_voltage"]:g} V · {m["temperature"]} °C</p><p class="dimensions">{esc(m["overall_dimensions"])} '+bilingual('мм','mm')+f'</p><div class="battery-price" data-price-model="{name}"></div><div class="product-actions"><a class="text-link" href="/catalog/{slug}/">'+bilingual('Подробнее ↗','View model ↗')+f'</a><a class="text-link" href="{esc(m["pdf"])}">PDF ↓</a></div></div></article>'
def battery_specs(m):
 rows=[('Номинальное напряжение','Nominal voltage',f"{m['voltage']:g} V"),('Номинальная ёмкость','Rated capacity',f"{m['capacity']:g} Ah"),('Условия измерения ёмкости','Capacity rating conditions',f"{m['hours']} h / {m['end_voltage']:g} V / {m['temperature']} °C"),('Габариты Д × Ш × полная В','L × W × overall H',m['overall_dimensions']+' mm'),('Масса, приблизительно','Approximate weight',m['weight']),('Буферное / циклическое напряжение','Float / cycle voltage',m['charging']),('Максимальный зарядный ток','Maximum charge current',m['max_charge'])]
 return '<dl class="spec-table">'+''.join('<div><dt>'+bilingual(ru,en)+'</dt><dd>'+esc(value)+'</dd></div>' for ru,en,value in rows)+'</dl>'
async def data_script(store,path,query):
 collection,variable,as_list=DATA_SCRIPTS[path];q=parse_qs(query);rev,records=await Catalogue(store).records('yellow',collection,q.get('catalog_release',[None])[0])
 data=list(records.values()) if as_list else records
 # JSON.parse keeps imported data inert, including any special object keys.
 return rev,'window.'+variable+'=JSON.parse('+dumps(dumps(data))+');'
async def render_page(store,path,source):
 cat=Catalogue(store);rev,manifest=await cat.head('yellow');urlpath=path.removesuffix('index.html')
 if not urlpath.endswith('/') and not urlpath.endswith('.html'):urlpath+='/'
 _,projection=await cat.record('yellow','technical-pages',urlpath,rev)
 if projection:
  values=iter(projection['blocks'])
  def project(match):
   if '<input' in match[0] or '<button' in match[0]:return match[0]
   block=next(values,None)
   if not block or block['tag']!=match[1]:raise ValueError('Technical projection/template mismatch')
   # Keep the full comparison available while older catalogue releases have fewer parameters.
   template = match[0]
   projected = block['html']
   if urlpath == '/bms/' and match[1] == 'table' and 'data-bms-column=' in template:
    if len(re.findall(r'<tr\b', projected)) < len(re.findall(r'<tr\b', template)):
     return template
   return projected
  source=re.sub(r'<(dl|table)\b[^>]*>.*?</\1>',project,source,flags=re.S)
  if next(values,None):raise ValueError('Incomplete technical projection')
 if path.startswith('/catalog/'):
  _,models=await cat.records('yellow','batteries',rev)
  if urlpath=='/catalog/':
   order={name:i for i,name in enumerate(re.findall(r'<article class="product-card"[^>]*data-name="([^"]+)"',source))}
   source=replace_element(source,'div','class="product-grid"','<div class="product-grid">'+''.join(battery_card(m) for m in sorted(models.values(),key=lambda m:(order.get(m['id'],9999),m['capacity'])))+'</div>')
  else:
   model=next((m for m in models.values() if '/catalog/'+m['slug']+'/'==urlpath),None)
   if model:
    source=replace_element(source,'dl','class="spec-table"',battery_specs(model))
    rating='<div class="detail-rating"><strong>'+f"{model['capacity']:g}"+' <small>'+bilingual('А·ч','Ah')+'</small></strong><strong>'+f"{model['voltage']:g}"+' <small>V</small></strong></div>'
    source=replace_element(source,'div','class="detail-rating"',rating)
 if urlpath=='/lithium/':
  _,models=await cat.records('yellow','lithium-cabinets',rev)
  source=re.sub(r'(<script id="vision-data" type="application/json">).*?(</script>)',lambda m:m[1]+dumps({'models':list(models.values())}).replace('<','\\u003c')+m[2],source,flags=re.S)
 if 'data-battery-models=' in source or 'data-shelf-models=' in source:
  _,batteries=await cat.records('yellow','batteries',rev)
  for attribute in ['data-battery-models','data-shelf-models']:
   source=re.sub(attribute+r'="[^"]*"',lambda m:attribute+'="'+esc(dumps(list(batteries.values())))+'"',source)
 if urlpath=='/racks/':
  _,models=await cat.records('yellow','ready-racks',rev)
  source=re.sub(r'data-rack-catalog="[^"]*"',lambda m:'data-rack-catalog="'+esc(dumps({'schema_version':1,'configurations':[r for r in models.values() if 'sections_nominal_mm' in r]}))+'"',source)
 # Every data script in this response is pinned to this same immutable revision.
 for script in [*DATA_SCRIPTS,'/assets/cabinet-shelf-core.js']:
  source=re.sub(re.escape(script)+r'(?:\?[^"\s]*)?',lambda m:script+'?catalog_release='+rev,source)
 source=source.replace('</head>','<meta name="catalogue-release" content="'+rev+'"></head>')
 return rev,source
async def shelf_script(store,query,source):
 q=parse_qs(query);rev,models=await Catalogue(store).records('yellow','shelf-cabinets',q.get('catalog_release',[None])[0])
 source,n=re.subn(r'const models=\{[^\n]*?\};',lambda m:'const models='+dumps(models)+';',source,count=1)
 if n!=1:raise ValueError('Cabinet calculator template mismatch')
 return rev,source
