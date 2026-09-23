"""Bundle only core source and synthetic fixtures, never local environments."""
import json
from pathlib import Path
import shutil

def copy_changed(source, destination):
    if not destination.exists() or source.read_bytes()!=destination.read_bytes():
        shutil.copy2(source,destination)

def write_changed(destination, value):
    if not destination.exists() or destination.read_text()!=value:
        destination.write_text(value)

ROOT = Path(__file__).resolve().parent
target = ROOT / "src"
target.mkdir(exist_ok=True)
(target / "battery_calculator").mkdir(exist_ok=True)
for name in ("__init__.py", "__main__.py", "core.py", "io.py", "catalog.py"):
    copy_changed(ROOT / "battery_calculator" / name, target / "battery_calculator" / name)
copy_changed(ROOT / "worker_entry.py", target / "entry.py")
examples = {name: json.loads((ROOT / "examples/calculator" / (name + ".json")).read_text())
            for name in ("runtime", "profile", "select")}
assert all(item["dataset"]["origin"] == "synthetic" for item in examples.values())
write_changed(target / "demo_data.py", "EXAMPLES = " + repr(examples) + "\n")

dataset = json.loads((ROOT / "data/calculator/leaflets-v1.json").read_text())
assert dataset["origin"] == "new_shared_dataset"
write_changed(target / "catalog_data.py", "DATASET = " + repr(dataset) + "\n")

portal_target=target / "battery_portal"
portal_target.mkdir(exist_ok=True)
for name in ("__init__.py", "security.py", "service.py", "storage.py", "transport.py"):
    copy_changed(ROOT / "battery_portal" / name, portal_target / name)

copy_changed(ROOT / "crypto_bridge.mjs", target / "crypto_bridge.mjs")
