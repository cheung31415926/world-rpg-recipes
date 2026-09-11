"""Merge verified item drops extracted from the map's JASS loot registration."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "drop-source-input.json"


def main() -> None:
    path = ROOT / "data.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    items = {
        item["rawcode"]: item["name"]
        for recipe in data["recipes"]
        for item in [recipe["output"], *recipe["ingredients"]]
    }
    data["drop_source_schema_version"] = 1
    drop_data = json.loads(SOURCE.read_text(encoding="utf-8"))
    confirmed = {}
    for item in drop_data["drop_items"]:
        sources = item["drop_sources"]
        for source in sources:
            rawcode = source["unit_rawcode"]
            name = source["unit_name"].strip()
            if not name or name == rawcode:
                raise ValueError(
                    f"Drop source for {item['rawcode']} has no resolved unit name: {rawcode}"
                )
        if sources:
            confirmed[item["rawcode"]] = sources
    data["item_drop_sources"] = {
        rawcode: {
            "item": {"rawcode": rawcode, "name": name},
            "status": "confirmed" if rawcode in confirmed else "unknown",
            "sources": [
                {
                    "unit": {"rawcode": source["unit_rawcode"], "name": source["unit_name"]},
                    "drop_rate_percent": source["drop_rate_percent"],
                    "exclusive": source["exclusive"],
                    "source_kind": "jass_loot_registration",
                }
                for source in confirmed.get(rawcode, [])
            ],
            "evidence": (
                {"kind": "jass_loot_registration", "source_file": drop_data["drop_source"]["script"],
                 "function": drop_data["drop_source"]["function"]}
                if rawcode in confirmed else
                {"kind": "runtime_loot_system_unresolved", "source_file": "war3map.j",
                 "note": "No verified item mapping was found for this item in the parsed loot registration."}
            ),
        }
        for rawcode, name in sorted(items.items())
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded {sum(rawcode in confirmed for rawcode in items)} confirmed and "
          f"{sum(rawcode not in confirmed for rawcode in items)} unknown item drop statuses.")


if __name__ == "__main__":
    main()
