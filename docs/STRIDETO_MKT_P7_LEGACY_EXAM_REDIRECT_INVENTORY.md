# STRIDETO MKT-P7 Legacy Exam Redirect Inventory

This is a planning inventory only. No redirects or data migrations are implemented by P7-A.

| Legacy route type | Current intent | Candidate future destination | Confidence | Traffic/backlink evidence required |
|---|---|---|---|---|
| `/exam-prep` | Pakistan government-exam catalog | `/tests` or a deprecation page | Medium | Yes |
| `/exam-prep/:slug` | Legacy exam detail with syllabus/papers/quizzes | Case-by-case `/tests/:slug` only when intent genuinely matches; otherwise deprecation page | Low | Yes |
| `/exam-prep/quiz/:quizId` | Internal MCQ quiz | No automatic destination; preserve temporarily, then deprecate | Low | Yes |
| `/admin/exams` | Internal legacy authoring/management | Existing read/archive view | High | No |

## Rules

- Legacy records remain untouched.
- Quiz URLs remain non-indexable.
- No broad redirect is approved until traffic, backlinks, and production data are reviewed.
- A redirect must not imply that a Pakistan government-exam quiz is an international admissions-test guide.
