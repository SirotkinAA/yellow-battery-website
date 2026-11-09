import json,re,hashlib,sys
from pathlib import Path
import pdfplumber
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from battery_calculator.io import read_dataset
manifest=json.loads((ROOT/'output/catalogue/manifest.json').read_text())
out={'schema_version':'1','dataset_id':'yellow-leaflets-hr-m-hr-wm','revision':'leaflets-2026-09-23-v1','origin':'new_shared_dataset','models':[]}
provenance=[];quarantine=[]
for entry in manifest:
 p=Path(entry['file']);digest=hashlib.sha256(p.read_bytes()).hexdigest();ref=p.relative_to(ROOT).as_posix()
 with pdfplumber.open(p) as pdf:
  first=pdf.pages[0].extract_text();page=pdf.pages[2].extract_text()
 assert first.splitlines()[0]==entry['model'] and page.splitlines()[0]==entry['model']
 cap=float(re.search(r'12 V ([\d.]+) Ah',first)[1]);rating=re.search(r'6 cells ([\d.]+) h to ([\d.]+) V at ([\d.]+)°C',first)
 temp=float(re.search(r'Fully charged battery / ([\d.]+)°C',page)[1])
 curves=[];mode=None;times=None
 for line in page.splitlines():
  if line=='Constant-current discharge / A':mode='constant_current';continue
  if line=='Constant-power discharge / W per cell':mode='constant_power';continue
  if line.startswith('V/cell '):
   tokens=line.split()[1:];assert all(re.fullmatch(r'[\d.]+[mh]',x) for x in tokens)
   times=[float(x[:-1])*(60 if x[-1]=='h' else 1) for x in tokens];continue
  if mode and re.match(r'^1\.\d\d ',line):
   values=[float(x) for x in line.split()];assert len(values)==len(times)+1
   curves.append(dict(mode=mode,end_voltage=values[0],voltage_unit='V/cell',temperature_c=temp,times=times,time_unit='minutes',values=values[1:],value_unit='A' if mode=='constant_current' else 'W/cell',source_ref=ref+'#page=3;sha256='+digest,revision=out['revision'],approval='approved'))
 assert len(curves)>=10,(entry['model'],len(curves))
 model=dict(id=entry['model'],series='HR-WM' if entry['model'].endswith('WM') else 'HR-M',nominal_voltage_v=12,cells=6,nominal_capacity_ah=cap,capacity_rating=dict(duration_hours=float(rating[1]),end_voltage_v_battery=float(rating[2]),temperature_c=float(rating[3])),source_ref=ref+';sha256='+digest,revision=out['revision'],curves=curves,current_limits=[])
 for mode in ['constant_current','constant_power']:
  subset=[x for x in curves if x['mode']==mode];test=dict(out,models=[dict(model,curves=subset)])
  _,rejected=read_dataset(test)
  if rejected:
   quarantine.append(dict(model=model['id'],mode=mode,reason=rejected,curves=subset));model['curves']=[x for x in model['curves'] if x['mode']!=mode]
 out['models'].append(model)
 provenance.append(dict(model=model['id'],pdf=ref,sha256=digest,table_page=3,capacity_page=1,manufacturer_source=entry['source'],leaflet_notes=entry['notes'],temperature_c=temp,maximum_discharge_statement=next((x for x in first.splitlines() if x.startswith('Maximum discharge')),None),extraction='Printed values from Yellow PDF page 3; no old audit JSON read',approval_basis='User authorized database from completed leaflets in this task; validated against PDF values',printed_values=sum(len(c['values']) for c in curves)))
models,rejected=read_dataset(out);assert not rejected,rejected
for name,data in [('leaflets-v1.json',out),('leaflets-provenance.json',provenance),('leaflets-quarantine.json',quarantine)]:
 (ROOT/'data/calculator'/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'models':len(models),'curves':sum(len(m.curves) for m in models),'printed_values':sum(p['printed_values'] for p in provenance),'quarantined':[(x['model'],x['mode'],x['reason']) for x in quarantine]},ensure_ascii=False))

# SQLite is the normalized local database; JSON is its portable Worker snapshot.
import sqlite3
path=ROOT/'data/calculator/leaflets-v1.sqlite'
with sqlite3.connect(path) as db:
 db.executescript('DROP TABLE IF EXISTS points; DROP TABLE IF EXISTS curves; DROP TABLE IF EXISTS models; DROP TABLE IF EXISTS sources; DROP TABLE IF EXISTS quarantine; CREATE TABLE sources(model TEXT PRIMARY KEY, pdf TEXT, sha256 TEXT, metadata TEXT); CREATE TABLE models(id TEXT PRIMARY KEY, series TEXT, metadata TEXT); CREATE TABLE curves(id INTEGER PRIMARY KEY, model TEXT, mode TEXT, cutoff REAL, temperature REAL, unit TEXT, source_ref TEXT); CREATE TABLE points(curve_id INTEGER, minutes REAL, value REAL, PRIMARY KEY(curve_id,minutes)); CREATE TABLE quarantine(model TEXT, mode TEXT, details TEXT);')
 for row in provenance:db.execute('INSERT INTO sources VALUES (?,?,?,?)',(row['model'],row['pdf'],row['sha256'],json.dumps(row,ensure_ascii=False)))
 for model in out['models']:
  db.execute('INSERT INTO models VALUES (?,?,?)',(model['id'],model['series'],json.dumps({k:v for k,v in model.items() if k!='curves'},ensure_ascii=False)))
  for c in model['curves']:
   cid=db.execute('INSERT INTO curves(model,mode,cutoff,temperature,unit,source_ref) VALUES (?,?,?,?,?,?)',(model['id'],c['mode'],c['end_voltage'],c['temperature_c'],c['value_unit'],c['source_ref'])).lastrowid
   db.executemany('INSERT INTO points VALUES (?,?,?)',[(cid,t,v) for t,v in zip(c['times'],c['values'])])
 for row in quarantine:db.execute('INSERT INTO quarantine VALUES (?,?,?)',(row['model'],row['mode'],json.dumps(row,ensure_ascii=False)))
 assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
