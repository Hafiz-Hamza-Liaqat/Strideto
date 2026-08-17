# STRIDETO pre-freeze acceptance runner durability

The canonical acceptance runner persists resumable QA state under the ignored
`qa-artifacts/acceptance-runs/<runId>/` directory. A run contains `run.json`
(HEAD and manifest fingerprint metadata), `ledger.jsonl` (one durable record
per visual cell or redirect), and `summary.json` (derived reconciliation).

Commands:

```powershell
$env:STRIDETO_QA_BASE='https://localhost:8443'
node scripts/pre-freeze-final-acceptance-harness.mjs --full --run-id=final-<id>
node scripts/pre-freeze-final-acceptance-harness.mjs --full --resume --run-id=final-<id>
node scripts/pre-freeze-final-acceptance-harness.mjs --reconcile --run-id=final-<id>
node scripts/acceptance-ledger-self-test.mjs
```

The runner is serial by default. PASS cells are skipped on resume; FAIL
records remain failures and unseen/INCOMPLETE cells are eligible for a later
run. Resume refuses a different repository HEAD, manifest fingerprint, or
planned count. Cell keys are deterministic from persona, manifest route ID,
classification, theme, and width. The persisted summary reports duplicates,
unseen cells, per-theme/width counts, and redirect progress. No credentials,
cookies, or tokens are written.

The full visual contract remains 7,340 cells (367 rendered persona-route
combinations × four themes × five widths) plus 20 redirect contracts. The
durability self-test intentionally exercises only a small synthetic subset;
it verifies interruption retention, resume fingerprint refusal, duplicate and
missing-cell detection, failed-cell preservation, and redirect checkpointing.
