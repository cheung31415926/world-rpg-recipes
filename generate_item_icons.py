"""Build browser-ready item icons from an extracted Warcraft III map directory."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent


def source_path(map_root: Path, art_path: str) -> Path:
    return map_root.joinpath(*art_path.replace("/", "\\").split("\\"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate WebP item icons for the recipe catalog.")
    parser.add_argument("map_root", type=Path, help="Extracted Warcraft III map directory")
    args = parser.parse_args()

    source_root = args.map_root.resolve()
    if not source_root.is_dir():
        parser.error(f"Map directory does not exist: {source_root}")

    with (ROOT / "data.json").open(encoding="utf-8") as file:
        recipes = json.load(file)["recipes"]
    with (ROOT / "txt" / "item.txt").open(encoding="utf-8-sig") as file:
        item_objects = json.load(file)

    rawcodes = {
        item["rawcode"]
        for recipe in recipes
        for item in [recipe["output"], *recipe["ingredients"]]
    }
    output_dir = ROOT / "assets" / "items"
    shutil.rmtree(output_dir, ignore_errors=True)
    output_dir.mkdir(parents=True)

    icons: dict[str, str] = {}
    generated: dict[str, str] = {}
    missing: list[str] = []
    for rawcode in sorted(rawcodes):
        item = item_objects.get(rawcode, {})
        art = item.get("art")
        if not art:
            missing.append(rawcode)
            continue
        image_path = source_path(source_root, art)
        if not image_path.is_file():
            missing.append(rawcode)
            continue
        key = hashlib.sha1(art.lower().encode()).hexdigest()[:12]
        output_name = f"{key}.png"
        if key not in generated:
            with Image.open(image_path) as image:
                image.convert("RGBA").save(output_dir / output_name, "PNG", optimize=True)
            generated[key] = output_name
        icons[rawcode] = f"assets/items/{generated[key]}"

    with (ROOT / "item-icons.json").open("w", encoding="utf-8") as file:
        json.dump(icons, file, ensure_ascii=False, indent=2)
        file.write("\n")
    print(f"Generated {len(generated)} PNG icons for {len(icons)} recipe items.")
    if missing:
        print(f"No source icon found for {len(missing)} item(s): {', '.join(missing)}")


if __name__ == "__main__":
    main()
