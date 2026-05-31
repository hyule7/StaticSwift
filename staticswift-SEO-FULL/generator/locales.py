"""
Locale data: UK-only for the rebuild.
"""
from __future__ import annotations
"""

For UK pages we set addressLocality = city, addressCountry = "GB",
and OMIT addressRegion unless the city slug is a known Greater London
borough (where we are confident). Omitting region is valid LD-JSON and
better than guessing wrong.

International suffixes are listed only so we can classify and skip them.
"""

# International country-code suffixes that should be REMOVED from the corpus.
# Any city slug ending in one of these means the page is not UK and we drop it.
INTERNATIONAL_SUFFIXES = {
    "nz", "za", "ie", "au",  # whole-country tags
    # US state codes
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
    "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
    "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
    "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
    "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy", "dc",
    # Canadian provinces
    "ab", "bc", "mb", "nb", "nl", "ns", "nt", "nu", "on", "pe", "qc", "sk", "yt",
    # Australian states
    "nsw", "vic", "qld", "wa", "sa", "tas", "nt", "act",
}

# Some Australian state codes overlap with US (wa, sa, nt). Either way they're
# international, so the set above is the right call: any match = drop.

# Known Greater London boroughs/areas. When the city slug matches one of these
# (case-insensitive), set addressRegion = "Greater London".
GREATER_LONDON = {
    "acton", "balham", "barnet", "battersea", "bethnal-green", "brentford",
    "brixton", "bromley", "camden", "chelsea", "chiswick", "clapham",
    "covent-garden", "croydon", "dagenham", "dulwich-village", "ealing",
    "eltham", "enfield", "finchley", "fulham", "greenwich", "hammersmith",
    "hampstead", "harrow", "hayes", "hendon", "holloway", "hornsey",
    "hounslow", "ilford", "islington", "kensington", "kilburn",
    "kingston", "lewisham", "marylebone", "muswell-hill", "notting-hill",
    "paddington", "peckham", "putney", "richmond", "romford", "ruislip",
    "shoreditch", "soho", "southall", "stratford", "stratford-london",
    "streatham", "sutton", "sydenham", "tooting", "tottenham", "twickenham",
    "uxbridge", "walthamstow", "wandsworth", "wembley", "wimbledon",
    "woodford", "woolwich", "wood-green",
}


def is_international(city_slug: str) -> bool:
    """True if the city slug looks like a non-UK location we should drop."""
    parts = city_slug.split("-")
    if not parts:
        return False
    last = parts[-1].lower()
    # 'co2' style disambiguators: 'colorado-springs-co2' -> still 'co' suffix
    if last.startswith("co") and last[2:].isdigit():
        last = "co"
    return last in INTERNATIONAL_SUFFIXES


def city_display(city_slug: str) -> str:
    """Convert a city slug to a human-readable display name.
    e.g. 'bury-st-edmunds' -> 'Bury St Edmunds'
         'stratford-upon-avon' -> 'Stratford-upon-Avon'
    """
    parts = city_slug.split("-")
    # Words to keep lowercase (in the middle of multi-word names)
    LOWER_WORDS = {"on", "upon", "in", "of", "the", "le", "by", "under"}
    # Single-word capitalisation
    out = []
    for i, p in enumerate(parts):
        if i > 0 and p in LOWER_WORDS:
            out.append(p)
        else:
            out.append(p.capitalize())
    # Hyphenate joined forms (Stratford-upon-Avon, Newcastle-under-Lyme)
    # Rejoin everything with spaces but re-hyphenate around lowercase joiners
    s = " ".join(out)
    for w in LOWER_WORDS:
        s = s.replace(f" {w} ", f"-{w}-")
    return s


def address_region(city_slug: str) -> str | None:
    """Return addressRegion for the city slug, or None to omit."""
    if city_slug in GREATER_LONDON:
        return "Greater London"
    # Conservative: don't guess for the rest. Better than a wrong region.
    return None
