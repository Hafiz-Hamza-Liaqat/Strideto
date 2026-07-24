# Repository cleanup — EduRozgaar → Strideto

**Date:** 2026-07-24  
**Scope:** Naming, docs, GitHub metadata (manual where CLI unavailable)

---

## Done in repo

- Product docs and README already brand as **Strideto** / `strideto.com`
- Active Phase C docs use Strideto naming
- Historical EduRozgaar materials remain under `docs/archive/` (intentional)
- Local DB example name may still be `edurozgaar` in older runbooks — prefer `strideto` for new Atlas DBs (legacy URI still works)
- Client `localStorage` keys still use `edurozgaar-*` dual-read patterns — **do not rename without a migration** (see security audit S8)

## GitHub (manual — `gh` not available in this environment)

Update on https://github.com/Hafiz-Hamza-Liaqat/Strideto (or current remote):

| Field | Suggested value |
|-------|-----------------|
| Description | Pakistan career & education platform — jobs, scholarships, admissions, Talent Profile. Every step toward success. |
| Website | https://strideto.com |
| Topics | `career`, `education`, `jobs`, `pakistan`, `react`, `nodejs`, `mongodb`, `strideto` |

Commands (when `gh` is installed):

```bash
gh repo edit --description "Pakistan career & education platform — jobs, scholarships, admissions, Talent Profile."
gh repo edit --homepage "https://strideto.com"
gh repo edit --add-topic career --add-topic education --add-topic jobs --add-topic pakistan --add-topic strideto
```

## Archive policy

- Obsolete sprint/QA/launch docs: keep in `docs/archive/` only
- Do not delete archive PDFs/screenshots without an explicit request
- Active runbooks stay in `docs/` root + Phase C deliverables
