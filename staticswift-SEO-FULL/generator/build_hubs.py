"""
Build hub pages: one per niche, listing every city we cover for that niche.

Run from the SEO-FULL dir:  python3 -m generator.build_hubs
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from collections import defaultdict

from . import hub_template
from . import build as build_lib

ROOT = Path(__file__).resolve().parent.parent
URL_RE = re.compile(r"^([a-z][a-z-]*)-website-design-([a-z0-9][a-z0-9-]*)$")


def main():
    by_niche: dict[str, list[str]] = defaultdict(list)
    for entry in os.scandir(ROOT):
        if not entry.is_dir():
            continue
        m = URL_RE.match(entry.name)
        if not m:
            continue
        niche, city = m.group(1), m.group(2)
        if niche not in build_lib.KEPT_NICHES:
            continue
        from . import locales
        if locales.is_international(city):
            continue
        by_niche[niche].append(city)

    print(f"building {len(by_niche)} niche hubs...")
    new_urls = []
    for niche, cities in sorted(by_niche.items()):
        html = hub_template.render_niche_hub(niche, cities)
        outdir = ROOT / f"{niche}-website-design"
        outdir.mkdir(parents=True, exist_ok=True)
        with open(outdir / "index.html", "w", encoding="utf-8") as f:
            f.write(html)
        new_urls.append(f"/{niche}-website-design/")
        print(f"  {niche} ({len(cities)} cities) → {outdir}/index.html")
    # Append hub URLs to kept-urls.txt so the sitemap picks them up
    kept_path = ROOT / "generator" / "kept-urls.txt"
    existing = kept_path.read_text().splitlines() if kept_path.exists() else []
    existing_set = set(ln.strip() for ln in existing if ln.strip())
    added = 0
    with open(kept_path, "a", encoding="utf-8") as f:
        for u in new_urls:
            if u not in existing_set:
                f.write(u + "\n")
                added += 1
    print(f"appended {added} hub URLs to kept-urls.txt")
    print(f"DONE: {len(new_urls)} hub pages")


if __name__ == "__main__":
    main()
