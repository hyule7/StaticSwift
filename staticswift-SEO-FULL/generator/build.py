"""
Bulk page builder.

Strategy:
  1) Read existing folder names in the SEO-FULL dir.
  2) Classify each folder as a niche+city tuple. Drop international cities.
  3) Read GSC Pages.csv to know which existing URLs have ≥1 impression.
  4) Build the rebuild target list:
       - All web-designer-* pages for any UK city we already cover.
       - All UK URLs in GSC Pages with ≥1 impression in last 3mo.
       - All niche pages whose city slug is in the Greater London set.
  5) For each target, pick:
       - up to 4 nearby cities (alphabetical neighbours within the same-niche corpus)
       - up to 3 cross-niches in the same city (alphabetical from same-city corpus)
  6) Render with template.render and overwrite the index.html for that URL.
  7) Track kept vs retired URLs. Write retired list to retired.txt for redirects.

Run from the SEO-FULL dir:  python3 -m generator.build
"""
from __future__ import annotations

import csv
import re
import os
from pathlib import Path
from collections import defaultdict

from . import template
from . import locales

ROOT = Path(__file__).resolve().parent.parent   # the SEO-FULL dir
GSC_PAGES = ROOT.parent / "https___staticswift" / "Pages.csv"

# URL pattern for a per-niche-per-city page directory
URL_RE = re.compile(r"^([a-z][a-z-]*)-website-design-([a-z0-9][a-z0-9-]*)$")
# Niches we treat as in-scope for the rebuild. Anything else gets retired.
KEPT_NICHES = {
    "web-designer", "plumber", "electrician", "builder", "scaffolder",
    "carpet-cleaner", "pest-control", "painter-decorator", "dentist",
    "mechanic", "locksmith", "dog-groomer", "photographer", "gardener",
    "accountant", "mobile-hairdresser", "nursery", "skip-hire",
    "tattoo-studio", "caterer", "roofer", "florist", "restaurant", "pub",
    "window-cleaner", "removals", "personal-trainer", "optician",
    "joiner", "tiler", "barber", "beauty-salon", "cafe", "solicitor",
    "vet", "therapist", "yoga-studio", "wedding-planner", "tutor",
    "estate-agent", "music-teacher", "driving-instructor", "dj",
    "plasterer", "retail", "cake-maker", "food-truck", "gym",
    "cleaning-company", "childminder",
}


def discover_existing(root: Path) -> list[tuple[str, str]]:
    """Walk the SEO-FULL dir and return (niche, city) tuples for every folder
    matching the per-niche-per-city pattern. Skips international cities and
    niches we're not rebuilding."""
    out = []
    for entry in os.scandir(root):
        if not entry.is_dir():
            continue
        m = URL_RE.match(entry.name)
        if not m:
            continue
        niche, city = m.group(1), m.group(2)
        if niche not in KEPT_NICHES:
            continue
        if locales.is_international(city):
            continue
        out.append((niche, city))
    return out


def load_gsc_impressions(csv_path: Path) -> dict[str, int]:
    """Return a {(niche, city): impressions} dict from the GSC Pages export."""
    out: dict[tuple[str, str], int] = {}
    if not csv_path.exists():
        return out
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row.get("Top pages", "").rstrip("/")
            # Match the per-niche-per-city URL shape on the URL path
            m = re.search(r"/([a-z][a-z-]*)-website-design-([a-z0-9][a-z0-9-]*)/?$", url)
            if not m:
                continue
            niche, city = m.group(1), m.group(2)
            try:
                imps = int(row.get("Impressions", "0").replace(",", ""))
            except ValueError:
                imps = 0
            out[(niche, city)] = imps
    return out


def build_targets(existing: list[tuple[str, str]], gsc: dict) -> list[tuple[str, str]]:
    """Rebuild every UK page in the in-scope niches. We previously curated to a
    smaller set; the new strategy is to clean every existing UK page so the
    whole corpus stops looking like doorway content. International pages are
    still retired (handled outside this function — they were already filtered
    from `existing` upstream)."""
    return sorted(set(existing))


def index_by_niche(targets: list[tuple[str, str]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = defaultdict(list)
    for niche, city in targets:
        out[niche].append(city)
    for niche in out:
        out[niche].sort()
    return out


def index_by_city(targets: list[tuple[str, str]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = defaultdict(list)
    for niche, city in targets:
        out[city].append(niche)
    for city in out:
        out[city].sort()
    return out


def neighbours(needle: str, sorted_list: list[str], n: int) -> list[str]:
    """Return up to `n` alphabetical neighbours of `needle` from `sorted_list`,
    excluding `needle` itself."""
    if needle not in sorted_list:
        return sorted_list[:n]
    i = sorted_list.index(needle)
    candidates = sorted_list[max(0, i - n // 2): i] + sorted_list[i + 1: i + 1 + (n - n // 2)]
    out = [x for x in candidates if x != needle][:n]
    # Pad from start if we didn't get enough
    if len(out) < n:
        extras = [x for x in sorted_list if x != needle and x not in out]
        out += extras[: n - len(out)]
    return out[:n]


def main():
    print("scanning existing folders...")
    existing = discover_existing(ROOT)
    print(f"  found {len(existing)} (niche, city) UK folders in-scope")

    print(f"reading GSC: {GSC_PAGES}")
    gsc = load_gsc_impressions(GSC_PAGES)
    print(f"  {len(gsc)} (niche, city) pairs in GSC")

    targets = build_targets(existing, gsc)
    print(f"  {len(targets)} targets after applying scope rules")

    by_niche = index_by_niche(targets)
    by_city = index_by_city(targets)

    # Discover the set of retired URLs (existing minus targets, plus international)
    target_set = set(targets)
    retired: list[str] = []
    for entry in os.scandir(ROOT):
        if not entry.is_dir():
            continue
        m = URL_RE.match(entry.name)
        if not m:
            continue
        niche, city = m.group(1), m.group(2)
        if (niche, city) not in target_set:
            retired.append(f"/{entry.name}/")
    retired.sort()
    print(f"  {len(retired)} URLs will be retired")

    # Write target + retired lists for audit
    with open(ROOT / "generator" / "kept-urls.txt", "w") as f:
        for niche, city in targets:
            f.write(f"/{niche}-website-design-{city}/\n")
    with open(ROOT / "generator" / "retired-urls.txt", "w") as f:
        for u in retired:
            f.write(u + "\n")
    print(f"  wrote kept-urls.txt and retired-urls.txt")

    print("rendering pages...")
    written = 0
    for niche, city in targets:
        nearby = neighbours(city, by_niche[niche], 4)
        cross = neighbours(niche, by_city[city], 3)
        html = template.render(niche, city, nearby, cross)
        outdir = ROOT / f"{niche}-website-design-{city}"
        outdir.mkdir(parents=True, exist_ok=True)
        with open(outdir / "index.html", "w", encoding="utf-8") as f:
            f.write(html)
        written += 1
        if written % 500 == 0:
            print(f"  ... {written} written")
    print(f"DONE: wrote {written} pages")


if __name__ == "__main__":
    main()
