# DEPRECATED — do not regenerate from these templates

`template.py` and `hub_template.py` still carry the retired pricing era
(Starter £149, Advanced £299, £29 hosting add-on, "24h delivery",
"no monthly fees") and a lead form without the POST fallback.

The live estate was corrected in place by `scripts/patch-facts-phase0.mjs`
on 2026-06-10. Running this generator as-is would resurrect every false
claim and the PII-leaking GET form across 31,000+ pages.

Before any regeneration these templates must be rebuilt to render all
prices, timeframes and guarantee figures from `data/facts.json`
(Phase 1 of the growth plan). Until then, treat this directory as
read-only history. `samples/` output here is similarly stale.
