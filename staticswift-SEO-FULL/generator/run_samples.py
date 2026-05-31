"""
Generate sample pages into generator/samples/<niche>-website-design-<city>/index.html.
Run from the SEO-FULL dir:  python3 -m generator.run_samples
"""

import os
from pathlib import Path

from . import template

ROOT = Path(__file__).resolve().parent
SAMPLES = ROOT / "samples"

# 10 sample pages spanning niches + city types.
# Cross-link sets are illustrative; the real generator picks them from the corpus.
SAMPLES_SPEC = [
    # (niche, city, [nearby cities], [cross-niches in same city])
    ("web-designer", "guildford",
     ["godalming", "woking", "farnham"],
     ["plumber", "electrician", "photographer"]),
    ("web-designer", "milton-keynes",
     ["bletchley", "newport-pagnell", "stony-stratford"],
     ["builder", "scaffolder", "accountant"]),
    ("plumber", "letchworth",
     ["hitchin", "stevenage", "baldock"],
     ["electrician", "builder", "roofer"]),
    ("electrician", "lichfield",
     ["burntwood", "rugeley", "tamworth"],
     ["plumber", "builder", "painter-decorator"]),
    ("scaffolder", "dudley",
     ["stourbridge", "halesowen", "walsall"],
     ["builder", "roofer", "plumber"]),
    ("carpet-cleaner", "sydenham",
     ["forest-hill", "penge", "catford"],
     ["window-cleaner", "removals", "painter-decorator"]),
    ("pest-control", "wrexham",
     ["chester", "deeside", "mold"],
     ["window-cleaner", "carpet-cleaner", "gardener"]),
    ("dentist", "bromsgrove",
     ["redditch", "kidderminster", "halesowen"],
     ["optician", "therapist", "accountant"]),
    ("tattoo-studio", "gosport",
     ["fareham", "portsmouth", "havant"],
     ["barber", "beauty-salon", "photographer"]),
    ("nursery", "oxford",
     ["abingdon", "kidlington", "bicester"],
     ["dentist", "photographer", "tutor"]),
]


def main():
    SAMPLES.mkdir(parents=True, exist_ok=True)
    for niche, city, nearby, cross in SAMPLES_SPEC:
        html = template.render(niche, city, nearby, cross)
        outdir = SAMPLES / f"{niche}-website-design-{city}"
        outdir.mkdir(parents=True, exist_ok=True)
        with open(outdir / "index.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"wrote {outdir}/index.html")


if __name__ == "__main__":
    main()
