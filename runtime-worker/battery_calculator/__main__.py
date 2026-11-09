"""python3 -m battery_calculator INPUT.json --demo [--output RESULT.json]"""
import argparse
import json
from pathlib import Path
import sys

from .core import CalculationError
from .io import execute


def reject_constant(value):
    raise CalculationError("invalid_number", "Non-finite JSON number: " + value)


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise CalculationError("duplicate_field", "Duplicate JSON field: " + key)
        obj[key] = value
    return obj


def main():
    parser = argparse.ArgumentParser(description="Battery autonomy core; no production catalog bundled")
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--demo", action="store_true", help="Explicitly allow synthetic data")
    args = parser.parse_args()
    try:
        document = json.loads(args.input.read_text(encoding="utf-8"), parse_constant=reject_constant, object_pairs_hook=unique_object)
        output = execute(document, demo=args.demo)
        rendered = json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if args.output:
            if args.output.resolve() == args.input.resolve():
                raise CalculationError("same_output_path", "Output must not overwrite input")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
        return 0
    except (CalculationError, OSError, ValueError) as exc:
        print(json.dumps({"error": getattr(exc, "code", "invalid_input"), "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
