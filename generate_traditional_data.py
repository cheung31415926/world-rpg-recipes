"""Generate Traditional Chinese recipe and item datasets for the static catalog."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from opencc import OpenCC


ROOT = Path(__file__).resolve().parent
CONVERTER = OpenCC("s2t")


def convert_recipe_names(value: object) -> object:
    if isinstance(value, dict):
        return {
            key: CONVERTER.convert(item) if key == "name" and isinstance(item, str) else convert_recipe_names(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [convert_recipe_names(item) for item in value]
    return value


def main() -> None:
    with (ROOT / "data.json").open(encoding="utf-8") as file:
        recipes = convert_recipe_names(json.load(file))
    with (ROOT / "data-traditional.json").open("w", encoding="utf-8") as file:
        json.dump(recipes, file, ensure_ascii=False, indent=2)
        file.write("\n")

    with (ROOT / "data.csv").open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
        fields = source.seek(0) or next(csv.reader(source))
    for row in rows:
        row["name"] = CONVERTER.convert(row["name"] or "")
        row["description"] = CONVERTER.convert(row["description"] or "")
    with (ROOT / "data-traditional.csv").open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated Traditional Chinese datasets for {len(recipes['recipes'])} recipes and {len(rows)} items.")


if __name__ == "__main__":
    main()
