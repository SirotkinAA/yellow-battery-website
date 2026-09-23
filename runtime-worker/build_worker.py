"""Bundle only core source and synthetic fixtures, never local environments."""
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
target = ROOT / "src"
target.mkdir(exist_ok=True)
(target / "battery_calculator").mkdir(exist_ok=True)
for name in ("__init__.py", "__main__.py", "core.py", "io.py", "catalog.py"):
    shutil.copy2(ROOT / "battery_calculator" / name, target / "battery_calculator" / name)
shutil.copy2(ROOT / "worker_entry.py", target / "entry.py")
examples = {name: json.loads((ROOT / "examples/calculator" / (name + ".json")).read_text())
            for name in ("runtime", "profile", "select")}
assert all(item["dataset"]["origin"] == "synthetic" for item in examples.values())
(target / "demo_data.py").write_text("EXAMPLES = " + repr(examples) + "\n")

dataset = json.loads((ROOT / "data/calculator/leaflets-v1.json").read_text())
assert dataset["origin"] == "new_shared_dataset"
(target / "catalog_data.py").write_text("DATASET = " + repr(dataset) + "\n")
