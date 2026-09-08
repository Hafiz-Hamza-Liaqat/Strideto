# Schools & Colleges replacement editorial plan

Status: local planning and draft preparation only. No route, sitemap, redirect,
CanonicalInstitution, or CMS record has been changed.

## Article set and institution mapping

| Draft slug | Institutions covered |
| --- | --- |
| `schools-colleges-lahore-study-options-official-sources` | Aitchison College; Lahore Grammar School 55 Main; The City School Pakistan |
| `schools-colleges-karachi-study-options-official-sources` | Karachi Grammar School; Nixor College |
| `government-college-peshawar-admission-study-guide` | Government College Peshawar |
| `islamabad-college-for-girls-f6-2-student-guide` | Islamabad College for Girls F-6/2 |
| `technical-institutes-quetta-training-study-options` | Quetta Institute of Information Technology and English Language |

Girls Cadet College Quetta is intentionally absent pending contact-data
verification.

## Editorial and linking rules

The drafts provide comparison and application-verification guidance rather
than directory cards or rankings. They link to official institution or
authority sources and instruct readers to verify dates, fees, eligibility, and
programme availability at the source.

Future contextual links can be added from Admissions & Intakes and Scholarships
& Funding when an article genuinely helps the reader. Official institution
websites remain the destination for current applications. No Schools &
Colleges item is added to primary navigation.

## Future redirect candidates (not activated)

Only activate a redirect after the destination article is published and
actually covers the institution:

- `/schools-and-colleges/aitchison-college-lahore` -> `/blog/schools-colleges-lahore-study-options-official-sources`
- `/schools-and-colleges/lahore-grammar-school-55-main` -> `/blog/schools-colleges-lahore-study-options-official-sources`
- `/schools-and-colleges/the-city-school-pakistan` -> `/blog/schools-colleges-lahore-study-options-official-sources`
- `/schools-and-colleges/karachi-grammar-school` -> `/blog/schools-colleges-karachi-study-options-official-sources`
- `/schools-and-colleges/nixor-college-karachi` -> `/blog/schools-colleges-karachi-study-options-official-sources`
- `/schools-and-colleges/government-college-peshawar` -> `/blog/government-college-peshawar-admission-study-guide`
- `/schools-and-colleges/islamabad-college-for-girls-f-6-2` -> `/blog/islamabad-college-for-girls-f6-2-student-guide`
- `/schools-and-colleges/quetta-institute-information-technology-english-language` -> `/blog/technical-institutes-quetta-training-study-options`

No destination is proposed for Girls Cadet College Quetta.

## Future CMS step

Review the five local payloads, then create them through the authenticated
staff-only `POST /api/admin/blogs` flow with `status: draft`. Keep publication
as a separate editorial decision. The current local payloads are not a record
of CMS writes and contain no production IDs.
