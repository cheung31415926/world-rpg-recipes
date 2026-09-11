"""Record verified item drop-source coverage from extracted map data."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    path = ROOT / "data.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    items = {
        item["rawcode"]: item["name"]
        for recipe in data["recipes"]
        for item in [recipe["output"], *recipe["ingredients"]]
    }
    data["drop_source_schema_version"] = 1
    data["item_drop_sources"] = {
        rawcode: {
            "item": {"rawcode": rawcode, "name": name},
            "status": "unknown",
            "sources": [],
            "evidence": {
                "kind": "runtime_loot_system_unresolved",
                "source_file": "war3map.j",
                "note": "No static monster-to-item mapping was found; the map's LootChest system builds drops at runtime.",
            },
        }
        for rawcode, name in sorted(items.items())
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded explicit unknown drop status for {len(items)} items.")


if __name__ == "__main__":
    main()
