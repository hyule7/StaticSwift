# StaticSwift — local controls. Shifts run the workforce; gates guard deploys.

.PHONY: shift-morning shift-midday shift-evening gates validate crawl test report roles

shift-morning: ; ./agents/run-shift.sh morning
shift-midday:  ; ./agents/run-shift.sh midday
shift-evening: ; ./agents/run-shift.sh evening

# Pre-deploy gates (run all three before any push)
gates: validate crawl test
validate: ; node scripts/validate-facts.mjs
crawl:    ; node scripts/crawl-audit.mjs
test:     ; npx playwright test

report:   ; node scripts/weekly-report.mjs
roles:    ; node agents/_build-roles.mjs

creatives: ; node scripts/build-ad-creatives.mjs
