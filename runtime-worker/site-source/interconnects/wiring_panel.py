"""Shared layout-derived cable panel for racks and cabinets."""
import json
from pathlib import Path
def content():
    root=Path(__file__).parent
    catalog=json.loads((root.parent/'data/interconnects/dkc-tml.json').read_text())
    return '<script id="layout-lug-catalog" type="application/json">'+json.dumps(catalog,ensure_ascii=False).replace('<','\\u003c')+'</script>'+ (root/'wiring-panel.html').read_text()
def scripts():
    return ''.join('<script defer src="/assets/'+name+'"></script>' for name in ('rack-wiring.js','layout-interconnects.js','rack-wiring-ui.js'))
