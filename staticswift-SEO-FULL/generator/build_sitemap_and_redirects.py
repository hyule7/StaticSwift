"""
Build clean sitemap and Netlify _redirects for the rebuilt corpus.

Inputs:
  kept-urls.txt    : one URL path per line (kept, rebuilt with new template)
  retired-urls.txt : one URL path per line (to be served 410 Gone)

Outputs:
  ../sitemap-seo.xml          : split into multiple files if >50k URLs (well under)
  ../sitemap-index.xml        : the index, replaces existing
  ../_redirects.seo           : 410 rules for retired URLs (append to existing _redirects)
  ../robots.txt               : updated to advertise only the sitemap-index

Run from the SEO-FULL dir:  python3 -m generator.build_sitemap_and_redirects
"""
from __future__ import annotations

from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://staticswift.co.uk"
TODAY = date.today().isoformat()


def read_paths(p: Path) -> list[str]:
    if not p.exists():
        return []
    return [ln.strip() for ln in p.read_text().splitlines() if ln.strip()]


def write_sitemap(paths: list[str], out: Path) -> None:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    # Include the home page and a few static pages first
    static = [
        ("/", "1.0"),
        ("/order.html", "0.9"),
        ("/about/", "0.8"),
        ("/showcase/", "0.7"),
    ]
    for path, prio in static:
        lines.append(
            f"  <url><loc>{SITE}{path}</loc><lastmod>{TODAY}</lastmod>"
            f"<changefreq>monthly</changefreq><priority>{prio}</priority></url>"
        )
    for p in paths:
        lines.append(
            f"  <url><loc>{SITE}{p}</loc><lastmod>{TODAY}</lastmod>"
            f"<changefreq>monthly</changefreq><priority>0.6</priority></url>"
        )
    lines.append("</urlset>")
    out.write_text("\n".join(lines), encoding="utf-8")


def write_sitemap_index(sitemap_files: list[str], out: Path) -> None:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for f in sitemap_files:
        lines.append(f"  <sitemap><loc>{SITE}/{f}</loc><lastmod>{TODAY}</lastmod></sitemap>")
    lines.append("</sitemapindex>")
    out.write_text("\n".join(lines), encoding="utf-8")


def write_redirects(retired: list[str], out: Path) -> None:
    """Write a _redirects.seo file with one 410 line per retired URL.
    The user should concatenate or replace their existing _redirects.
    Netlify _redirects format:  /old-path   /404   410
    """
    lines = [
        "# ----- Retired SEO pages (Google should drop from index) -----",
        f"# Generated {TODAY}. {len(retired)} URLs.",
        "",
    ]
    for u in retired:
        # 410 Gone — definitive signal that the URL is permanently removed
        lines.append(f"{u}    /gone.html    410")
    out.write_text("\n".join(lines), encoding="utf-8")


def write_robots(out: Path) -> None:
    out.write_text("""User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /client/
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 1

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: https://staticswift.co.uk/sitemap-index.xml
""", encoding="utf-8")


def main():
    kept = read_paths(ROOT / "generator" / "kept-urls.txt")
    retired = read_paths(ROOT / "generator" / "retired-urls.txt")
    print(f"kept    : {len(kept)} URLs")
    print(f"retired : {len(retired)} URLs")

    # Sitemap fits easily in one file (<50k URL limit)
    write_sitemap(kept, ROOT / "sitemap-seo.xml")
    write_sitemap_index(["sitemap-seo.xml"], ROOT / "sitemap-index.xml")
    print("wrote sitemap-seo.xml, sitemap-index.xml")

    write_redirects(retired, ROOT / "_redirects")
    print("wrote _redirects (Netlify-ready, replaces any existing one)")

    write_robots(ROOT / "robots.txt")
    print("wrote robots.txt (now advertises only sitemap-index.xml)")


if __name__ == "__main__":
    main()
