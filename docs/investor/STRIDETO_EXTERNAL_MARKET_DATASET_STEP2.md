# STRIDETO External Market Dataset — Step 2

## 1. Purpose

This document records Wave 1 Pakistan external market research for the investor market-sizing workstream.

It is a source register and data-quality document only.

It does **not** calculate TAM, SAM, SOM, market value, ARPA multiplication, or investor-deck market numbers.

Primary market-sizing unit:

> **ONE UNIQUE PAYING ORGANIZATION**

The approved monetized segments are:

1. Employers.
2. Education & Mobility Providers.
3. Business / Professional Service Providers.

Institutions are recorded as a non-monetized supply-side reference only.

## 2. Methodology

Research priority was given to official Pakistani statistical agencies, regulators, education authorities, and professional bodies.

Source priority:

1. Government statistical agency.
2. Corporate/company registry.
3. Government regulator.
4. Education regulator or ministry.
5. Official industry regulator.
6. Intergovernmental institution.
7. Recognized trade or professional association.

No random blogs, SEO pages, scraped directories, job boards, or generic search snippets were used as evidence.

Every source-register row records the source, dataset, year or access status, unit definition, confidence, verification status, deduplication treatment, and limitation.

No external count is silently converted into a unique paying-organization count.

## 3. Canonical Organization Unit

The future market model must count one unique organization rather than activity or inventory.

Do not count separately:

- branches;
- establishments where the parent organization is identifiable;
- jobs;
- services;
- listings;
- staff accounts;
- leads;
- transactions;
- duplicate registry records.

Where only establishments are available, the figure is explicitly labeled an **ESTABLISHMENT PROXY**.

Provider categories and institution types remain dimensions. They are not additional organizations.

The complete row-level register is in:

`docs/investor/data/strideto-market-source-register.csv`

## 4. Pakistan — Employers

### 4.1 Official totals and definitions

| Source | Data year | Reported figure | Unit | Status | Confidence | Use |
|---|---:|---:|---|---|---|---|
| Pakistan Bureau of Statistics Economic Census 2023, Table 1 | 2023 | 7,142,941 | Establishments; reported workforce 25,344,121 | PROXY | MEDIUM | Broad official starting population, not unique organizations |
| Pakistan Bureau of Statistics Economic Census 2023, Table 8 | 2023 | 6,820,932 establishments below 10 workforce; 322,009 at 10 or more | Establishment employment categories | PROXY | MEDIUM | Size-band context only |
| Securities and Exchange Commission of Pakistan FY2023-24 incorporation release | FY2023-24 | 27,542 new companies | New-company incorporations during the fiscal year; annual flow | VERIFIED_EXTERNAL_FACT | HIGH | Do not use as cumulative company stock |
| Securities and Exchange Commission of Pakistan FY2023-24 incorporation release | As reported 27 July 2024 | 222,697 | Total registered companies after FY2023-24 incorporations; cumulative stock | VERIFIED_EXTERNAL_FACT | HIGH | Registered-company stock, not active-employer count |
| Securities and Exchange Commission of Pakistan May 2026 incorporation release | As of 2 June 2026 | 297,239 | Total registered companies after May 2026 incorporations; cumulative stock | VERIFIED_EXTERNAL_FACT | HIGH | Latest verified stock located in this pass; not active-employer count |

Official URLs:

- [PBS Economic Census landing page](https://www.pbs.gov.pk/pakistan-bureau-of-statistics-economic-statistics-production/)
- [PBS Economic Census Table 1](https://www.pbs.gov.pk/wp-content/uploads/2020/07/Table_1-6.pdf)
- [PBS Economic Census Table 8](https://www.pbs.gov.pk/wp-content/uploads/2020/07/Table_8-6.pdf)
- [SECP Annual Report 2024](https://www.secp.gov.pk/document/annual-report-2024/)
- [SECP FY2023-24 incorporation release](https://www.secp.gov.pk/media-center/press-releases/secp-registers-27542-new-companies-in-fy-2023-24/)
- [SECP May 2026 incorporation release](https://www.secp.gov.pk/wp-content/uploads/2026/06/Press-Release-June-02-2026-Record-415-Companies-Incorporated-in-a-Single-Day-as-May-Registrations-Reach-3161.pdf)
- [PBS Business Register](https://www.pbs.gov.pk/docs/business-register/)

### 4.2 What the PBS count measures

The PBS Economic Census Table 1 reports **7,142,941 establishments** and a workforce of **25,344,121** for Pakistan in Economic Census 2023.

This is not a unique employer count. It includes establishments across many PSIC categories, including retail, agriculture, education, public administration, health, religious facilities, and other activities.

The PBS Table 8 employment categories report:

- 6,820,932 establishments classified as less than 10 workforce; and
- 322,009 establishments classified as 10 and above workforce.

The table states that establishments for which workforce was not mentioned are included in the less-than-10 category. Therefore, these values must not be described as “businesses with employees.”

### 4.3 What the SECP count measures

The prior dataset label was incorrect. SECP’s official FY2023-24 release says **27,542 new companies were registered during FY2023-24**, raising the **total number of registered companies to 222,697**.

Therefore:

- **27,542 = annual incorporation flow**, not cumulative registered-company stock;
- **222,697 = cumulative registered-company stock reported after that fiscal year**; and
- neither figure proves that the companies were active employers, had employees, or were currently hiring.

SECP later reported **297,239 total registered companies as of 2 June 2026** after May 2026 incorporations. This is a newer cumulative stock reference, not an active-employer count.

These are corporate-registry populations, not verified active-employer populations. They do not establish:

- active trading status;
- employees;
- current hiring activity;
- digital reachability;
- willingness to pay;
- unique employer suitability for STRIDETO.

They should not be added to the PBS establishment count. They are incorporated-company stock/flow references, subject to definition reconciliation.

### 4.4 PBS Business Register and enterprise availability

PBS describes its Business Register as a comprehensive database of active business entities, including establishments and enterprises, with legal status, ownership, employment size, and activity variables. PBS also states that access is restricted and that establishment lists cannot be shared because of confidentiality restrictions.

This is conceptually closer to the required active-organization unit than the Economic Census establishment total, but **no public national enterprise count was verified in this pass**.

### 4.5 Best official starting populations

The best broad official starting population is:

> **PBS Economic Census 2023: 7,142,941 establishments**

Classification:

```text
PROXY — official establishment frame, not unique employer organizations
```

The SECP cumulative stock figures are formal-incorporated-company cross-checks, but they are narrower than PBS and do not prove active employer status. The 27,542 figure must be retained only as an annual flow.

Candidate proxies remain separate:

| Candidate | Strength | Weakness |
|---|---|---|
| PBS 7,142,941 establishments | Broadest official national frame | Includes household/informal activity and multiple establishments; not unique organizations |
| PBS Business Register enterprise population | Designed around active entities and enterprise/establishment distinction | Aggregate national enterprise count was not publicly available in reviewed material |
| SECP 297,239 registered companies | Latest official cumulative incorporated-company stock located | Includes inactive/non-employer companies and excludes unincorporated businesses |
| PBS employment-size categories | Official size-filter context | Still establishment units and not unique organizations |

No final employer eligibility percentage is applied.

### 4.5 Deduplication issues

The employer dataset requires reconciliation between:

- legal companies;
- enterprises;
- establishments;
- branches;
- subsidiaries;
- business groups;
- multiple registry entries.

The preferred future unit is a unique active employer enterprise or legal organization. If only establishment data is used, it must remain labeled an establishment proxy.

## 5. Pakistan — Education & Mobility Providers

### 5.1 Direct official count

**DIRECT OFFICIAL COUNT NOT AVAILABLE.**

The reviewed official sources did not provide a comprehensive national register and count of Pakistan-based:

- study-abroad consultancies;
- education consultancies;
- licensed education agents;
- overseas education advisers;
- relocation providers;
- immigration/mobility providers serving the approved STRIDETO segment.

HEC’s recognized-university, campus, qualification, and higher-education data describe institutions and qualifications, not a complete consultancy population. HEC has issued a public warning about education/study-abroad consultants and visa-processing rackets, but the reviewed notice does not establish a national licensing register or total provider count.

### 5.2 OEP distinction

The Bureau of Emigration & Overseas Employment maintains an official Overseas Employment Promoters list.

That register is not used as the Education & Mobility provider count because Overseas Employment Promoters are employment-recruitment licensees. They are not automatically:

- study-abroad agencies;
- education consultants;
- mobility providers;
- relocation providers.

The dynamic BEOE pages also displayed varying pagination totals across pages and statuses. No stable national active unique-organization count was adopted.

Classification:

```text
COUNT NOT VERIFIED — official adjacent register, outside the approved segment definition
```

### 5.3 Required future provider methodology

The strongest defensible sequence is:

1. Search for a direct regulator-backed study-abroad or education-agent register.
2. If unavailable, identify a regulator-backed subset by licensing or recognized service authorization.
3. Use recognized association directories only as a clearly labeled fallback.
4. Deduplicate one organization across study-abroad, visa, immigration, and relocation services.

Association membership must never be presented as the total Pakistan provider market.

### 5.4 Current Wave 1 result

| Provider category | Result | Confidence | Use |
|---|---|---|---|
| Study-abroad consultancies | COUNT NOT VERIFIED | LOW | Research gap |
| Education consultancies | COUNT NOT VERIFIED | LOW | Research gap |
| Licensed education agents | COUNT NOT VERIFIED | LOW | Direct register not verified |
| Overseas employment promoters | Adjacent official register only | LOW for this segment | Exclude from denominator |
| Relocation providers | COUNT NOT VERIFIED | LOW | Research gap |
| Immigration/mobility providers | COUNT NOT VERIFIED | LOW | Research gap |

## 6. Pakistan — Business / Professional Service Providers

### 6.1 SECP registered intermediaries

SECP provides an official registered-intermediary framework for company filing and incorporation-related services.

The reviewed official list, titled **List of Registered Intermediaries updated September 2025**, contains 110 numbered entries by manual row count.

Classification:

```text
PROXY — regulator-backed subset, not the total corporate-service-provider market
```

The entries include individuals, accounting firms, legal practices, corporate-service firms, and other intermediary records. The list is not a clean organization-only, active-status, full-service-provider population. They must be deduplicated and service-classified before being used as a provider population.

Official references:

- [SECP Services of Registered Intermediaries](https://www.secp.gov.pk/company-formation/online-company-formation/)
- [SECP Registered Intermediaries List](https://www.secp.gov.pk/document/registered-intermediaries-updated-up-to-may-2025/)
- [HEC warning on education/study-abroad consultants](https://www.hec.gov.pk/english/news/Documents/NewsViews/2023/April-June-2023.pdf)

### 6.2 Corporate-service-provider register

No comprehensive official national register of all Pakistan corporate-service providers was verified.

The SECP intermediary list is the strongest regulator-backed subset identified in this Wave 1 review. It should not be presented as the entire addressable provider market.

### 6.3 Professional-firm fallback

ICAP maintains official firm directories, but the reviewed page did not provide a single verified national aggregate count. Its current QCR document is a subset of firms with satisfactory QCR ratings, not all accounting firms.

ICMAP states that its public-practice function is supported by **over 150 firms**. This is an official organization-level statement, but it is an approximate lower-bound/reference population for management-accounting public practice, not a complete business-services population.

Official reference:

- [ICAP List of Firms](https://icap.org.pk/members/practice-requirements-plus/firms/)
- [ICMAP Public Practice](https://www.icmap.com.pk/public_practice.aspx)

ICAP and ICMAP firms may provide accounting, audit, tax, registration, or advisory services, but they must not automatically be classified as company-formation or corporate-service providers. Service relevance must be verified organization by organization or through a clearly defined activity classification.

### 6.4 Business-service result

| Category | Result | Classification | Confidence |
|---|---|---|---|
| SECP authorized intermediaries | 110 listed entries | PROXY | MEDIUM |
| All corporate-service providers | COUNT NOT VERIFIED | UNKNOWN | MEDIUM |
| Company-formation agents as a complete national population | COUNT NOT VERIFIED | UNKNOWN | LOW |
| ICAP accounting/audit firms | COUNT NOT VERIFIED | Association/professional fallback | LOW |
| ICMAP public-practice firms | Over 150 firms | Official approximate subset/reference | MEDIUM |
| All accountants, lawyers, or consultants | NOT USED | Not equivalent to STRIDETO provider segment | — |

## 7. Pakistan — Institutions

**NON-MONETIZED SUPPLY-SIDE DATA**

Institutions are excluded from base monetization and must not be multiplied by ARPA.

### 7.1 Official institution figures

| Source | Year | Figure | Unit | Confidence | Limitation |
|---|---:|---:|---|---|---|
| PBS Economic Census Table 7 | 2023 | 214 | University establishments | MEDIUM | Establishments, not necessarily HEC-recognized legal institutions |
| PBS Economic Census Table 7 | 2023 | 11,568 | College establishments | MEDIUM | Establishment count; not necessarily recognized/legal-entity count |
| PBS Economic Census Table 7 | 2023 | 242,616 | School establishments | MEDIUM | Platform-context reference only |
| Pakistan Economic Survey 2024-25 Table 10.1 | 2023-24 estimated | 269 | Universities, expressed from 0.269 thousand | MEDIUM | National education-statistics estimate; differs from PBS and HEC definitions |
| Pakistan Economic Survey 2024-25 Table 10.1 | 2023-24 estimated | 2,516 | Degree colleges, expressed from 2.516 thousand | MEDIUM | Estimated; definition differs from PBS college establishments |
| Pakistan Economic Survey 2024-25 Table 10.1 | 2023-24 estimated | 4,563 | Technical and vocational institutes, expressed from 4.563 thousand | MEDIUM | Training-provider reference, not Education/Mobility provider count |
| HEC recognized campuses page | Current page; accessed 10 September 2026 | 150 headline total | 95 public plus 55 private campuses in page headline | MEDIUM | Campus count, not unique university/legal-entity count; page body separately states private total 54, so the page contains an internal 1-campus discrepancy |
| HEC recognized universities list | Current page; date not stated | COUNT NOT VERIFIED | Recognized universities/DAIs list | MEDIUM | Reviewed page does not publish a single aggregate total |
| HEC Annual Report 2023-24 | 2023-24 | 262 | Total HEIs reported in HEC comparative table; organization-level reference | MEDIUM | Reported HEC HEI total, but exact composition and deduplication methodology are not exposed |

Official references:

- [PBS Table 7](https://www.pbs.gov.pk/wp-content/uploads/2020/07/Table_7-2.pdf)
- [Pakistan Economic Survey Education Chapter](https://www.finance.gov.pk/survey/chapter_25/10_Education.pdf)
- [Pakistan Education Statistics 2023-24](https://pie.gov.pk/SiteImage/Publication/PES%202024.pdf)
- [HEC recognized campuses](https://www.hec.gov.pk/english/universities/Pages/DAIs/HEC-recognized-Campuses.aspx)
- [HEC recognized universities](https://www.hec.gov.pk/english/universities/pages/recognised.aspx)
- [HEC Annual Report 2023-24](https://www.hec.gov.pk/english/news/AnnualReports/Annual-Report-2023-24.pdf)

### 7.2 Institution deduplication

Keep separate dimensions for:

- university system;
- legal institution;
- degree-awarding institution;
- campus;
- affiliated college;
- training location.

Do not add PBS university establishments, HEC campuses, and Economic Survey university totals together.

### 7.3 Unique HEC-recognized university/DAI result

**UNIQUE RECOGNIZED UNIVERSITY / DAI ORGANIZATION COUNT: 262 REPORTED HEIs, WITH DISCLOSED DEFINITION LIMITATION.**

HEC’s 2023-24 Annual Report reports **262 Total HEIs** in its Pakistan comparison table and cites the HEC recognized-universities page as the recognition source. This is the strongest published HEC organization-level reference located. It is recorded as a reported HEI total, not as an independently row-counted current recognized-university/DAI register, because the report does not expose the composition or deduplication method.

The HEC recognized-universities page remains authoritative as a recognition list but does not publish a single aggregate total in the reviewed material. The HEC campus page publishes a campus total rather than a unique university/DAI total and contains an internal inconsistency: its headline says 95 public plus 55 private campuses = 150, while the page body labels the private-sector section as total 54. Therefore, 150 remains only the page’s stated campus headline, not the unique institution count.

The Pakistan Economic Survey estimate of 269 universities and PBS’s 214 university establishments are not reconciled into one HEC organization count. They use different statistical units, coverage, and reference periods.

### 7.4 Technical and vocational institutions

The Pakistan Economic Survey figure of **4,563 technical and vocational institutes** is an estimated national education-statistics count for 2023-24. The table labels the unit as institutes; it does not establish unique legal providers, active status, or campus deduplication.

NAVTTC separately states that its national network has **3,500+ registered institutes**, with regional figures shown for Punjab, Sindh, KPK, and Balochistan. This is a regulator-network reference, not a complete census of every technical/vocational institute and not directly additive to the Economic Survey figure. NAVTTC also states that it operates the national registry of registered institutes, but the reviewed public page did not expose a precise national organization-level export.

References:

- [NAVTTC registration and national network](https://test.navttc.gov.pk/registration/)
- [NAVTTC mandate and TVET registry](https://navttc.gov.pk/about/)

## 8. Source Register Summary

The structured source register is:

`docs/investor/data/strideto-market-source-register.csv`

It contains:

- official PBS establishment and employment-category figures;
- SECP incorporated-company and registered-intermediary data;
- HEC recognition and campus sources;
- Pakistan Economic Survey education totals;
- BEOE adjacent-register review;
- ICAP professional-firm fallback review;
- explicit unverified rows for missing direct provider counts.
- PBS Business Register availability and access limitation.
- SECP annual-flow versus cumulative-stock correction.
- ICMAP public-practice approximate firm reference.
- NAVTTC registered-TVET-network reference.
- HEC Annual Report 2023-24 reported total of 262 HEIs, with composition limitation disclosed.

## 9. Data Gaps

The following remain unresolved:

1. Unique active Pakistani employer organizations.
2. Businesses with employees expressed as unique organizations rather than establishments.
3. Digital reachability of businesses.
4. Businesses with current hiring activity.
5. A comprehensive education-consultancy register.
6. A comprehensive study-abroad-agent register.
7. A comprehensive relocation or immigration-provider register.
8. A complete corporate-service-provider population.
9. Active-status reconciliation for SECP intermediary records.
10. Deduplicated legal-entity crosswalk between PBS and SECP populations.
11. A single HEC-recognized unique-institution total aligned with the education-statistics totals.
12. Official national counts for relevant non-degree training providers aligned with STRIDETO’s provider definition.
13. Public aggregate of PBS enterprise-level active entities; the Business Register is described but not publicly downloadable.
14. HEC-published unique recognized university/DAI aggregate; the current HEC page provides lists and campus data but no clean total.
15. Reconciliation of the HEC campus-page internal 150 versus 95+54/55 presentation.

## 10. Proxy Requirements

### Employers

Use PBS Economic Census establishments as the broad official establishment proxy, PBS Business Register enterprise data if access is later granted, and SECP cumulative registered-company stock as an incorporated-company cross-check. Keep SECP’s 27,542 annual incorporations as a flow only. Do not add these populations.

### Education & Mobility

Use a direct regulator-backed register if found in a later research pass. Otherwise, use a recognized association or licensing subset with an explicit lower-bound label. Do not use BEOE OEPs as a substitute for education/mobility providers.

### Business Services

Use the SECP registered-intermediary list as a regulator-backed subset. ICAP firms may be a secondary professional-services reference but are not automatically STRIDETO providers.

### Institutions

Use Pakistan Education Statistics and HEC recognition sources as separate non-monetized supply-side references. Do not combine their totals.

### Technical and vocational institutions

Use the Economic Survey’s 4,563 estimated institutes and NAVTTC’s 3,500+ registered-institute network as separate references. Do not add them or treat either as a unique paying-provider population.

## 11. Eligibility Filters Still Requiring Management Decisions

No Conservative/Base/Upside percentage was applied.

| Filter | Status |
|---|---|
| Registered versus active company | VERIFIED DATA FILTER where source supports it; unresolved for current combined denominator |
| Establishment versus unique organization | PROXY REQUIRED |
| Businesses with employees | PROXY REQUIRED from available PBS categories |
| Digital reachability | MANAGEMENT ASSUMPTION |
| Hiring likelihood | MANAGEMENT ASSUMPTION or PROXY REQUIRED |
| Relevant employer sectors | MANAGEMENT ASSUMPTION |
| Provider service relevance | VERIFIED DATA FILTER only when regulator or record supports it; otherwise PROXY REQUIRED |
| Provider willingness to pay | MANAGEMENT ASSUMPTION |
| Provider legal-entity deduplication | PROXY REQUIRED |
| Institution recognition | VERIFIED DATA FILTER through HEC or official education source |
| Institution monetization | EXCLUDED by Step 1 management decision |

## 12. Wave 1 Confidence Assessment

### Highest-confidence figures

- PBS Economic Census 2023 national establishment total: **7,142,941 establishments** — official, national, directly reported, but not unique organizations.
- PBS Economic Census 2023 national workforce: **25,344,121** — official workforce context, not a payer count.
- SECP FY2023-24 incorporation figure: **27,542 new companies** — official annual flow, not cumulative stock or active employers.
- SECP cumulative stock: **222,697 registered companies** after FY2023-24 and **297,239 registered companies** as of 2 June 2026 — formal-company reference figures, not active employers.
- Pakistan Economic Survey 2024-25 2023-24 estimated universities: **269** — official national education-statistics estimate, non-monetized.
- Pakistan Economic Survey 2024-25 2023-24 estimated degree colleges: **2,516** — official estimate, non-monetized.
- HEC recognized campus page: **150 campuses** — official current campus inventory, not a unique institution total.

### Medium-confidence proxies

- PBS establishments as employer starting frame.
- PBS employment-category counts.
- SECP registered-intermediary list with 110 manually counted rows, plus ICMAP’s approximate **over 150 public-practice firms** statement.
- NAVTTC’s **3,500+ registered institutes** network statement, kept separate from the Economic Survey’s 4,563 institute estimate.

### Low-confidence or unusable as headline market counts

- Association membership counts without a published total-market methodology.
- BEOE Overseas Employment Promoters as an Education/Mobility denominator.
- Generic accountants, lawyers, consultants, or audit firms as corporate-service providers.
- Search-directory counts.
- Technical country or product support without organization counts.

## 13. Recommendations Before Wave 2

Before researching international markets:

1. Obtain or validate a Pakistan legal-entity crosswalk between PBS establishments and SECP companies.
2. Confirm whether investor sizing should use an establishment proxy or incorporated-company subset as the employer base.
3. Find a direct Pakistan education-agent or consultancy register, if one exists.
4. Review SECP intermediary validity and remove expired or duplicate entries.
5. Define the exact Business/Professional Provider activity scope.
6. Keep institutions in a separate non-monetized table.
7. Record source definitions before comparing Pakistan figures with US, UK, or other countries.
8. Do not apply eligibility percentages until management approves the filters.

## Pakistan Wave 1 Final Source Closure

### Resolved and accepted references

| Segment | Final reference | Treatment |
|---|---|---|
| Employers | PBS Economic Census: 7,142,941 establishments | Primary broad official reference; establishment proxy only |
| Employers | PBS 10+ workforce establishments: 322,009 | Conservative establishment-size proxy; not unique organizations |
| Employers | SECP: 297,239 registered companies as of 2 June 2026 | Formal-company cross-check; not active employers |
| Education and Mobility | No direct national count verified | No quantitative market denominator accepted in Wave 1 |
| Business Services | SECP registered-intermediary list: 110 rows | Regulator-backed register-row proxy; not unique organization count |
| Business Services | ICMAP: over 150 public-practice firms | Approximate organization-level professional subset; not complete market |
| Institutions | HEC Annual Report: 262 total HEIs | Best published HEC organization-level reference; definition limitation disclosed |
| Campuses | HEC page: 150 stated campuses | Campus reference only; not added to HEI count |
| Technical/vocational | Pakistan Economic Survey: 4,563 institutes; NAVTTC: 3,500+ registered institutes | Separate non-monetized reference populations; not added together |

### Unresolved counts

- Unique active employer enterprises: **COUNT NOT VERIFIED**.
- Direct national Education & Mobility provider organizations: **COUNT NOT VERIFIED**.
- Complete Business Services provider population: **COUNT NOT VERIFIED**.
- Independently deduplicated current HEC recognized-university/DAI row count: **COUNT NOT VERIFIED**; HEC’s best published organization-level reference is 262 total HEIs.
- Cross-registry legal-entity deduplication: **NOT PUBLICLY AVAILABLE** in the reviewed sources.

### Accepted and rejected proxy policy

| Proxy | Internal market model | Detailed investor appendix | Headline investor slide |
|---|---|---|---|
| PBS 7,142,941 establishments | YES WITH FOOTNOTE | YES WITH FOOTNOTE | NO |
| PBS 322,009 establishments with 10+ workforce | YES WITH FOOTNOTE | YES WITH FOOTNOTE | NO |
| SECP 297,239 registered companies | YES WITH FOOTNOTE | YES WITH FOOTNOTE | NO |
| SECP 110 intermediary register rows | YES WITH FOOTNOTE | YES WITH FOOTNOTE | NO |
| ICMAP over 150 public-practice firms | YES WITH FOOTNOTE | YES WITH FOOTNOTE | NO |
| HEC 262 total HEIs | YES WITH FOOTNOTE | YES WITH FOOTNOTE | NO until definition is reconciled |
| HEC 150 campuses | NO as university count | YES WITH FOOTNOTE | NO |
| BEOE Overseas Employment Promoters | NO | NO for Education/Mobility denominator | NO |
| Generic accountants, lawyers, consultants, or directories | NO | NO | NO |

### Recommended final proxy paths

1. Employers: use PBS establishments as the primary broad reference, with PBS 10+ establishments as a conservative size proxy and SECP registered-company stock as a formal-sector cross-check. Never label any of these as unique active employers.
2. Education & Mobility: do not publish a count in the Pakistan market denominator. If later required for an appendix, assemble a reproducible lower-bound by deduplicating Pakistan-based organizations appearing in official destination-country or regulator-backed agent registers; no such complete public register was verified in this pass.
3. Business Services: use the SECP 110-row intermediary register as the narrowest regulator-backed proxy, supplemented separately by ICMAP’s approximate public-practice subset. Do not combine them without organization-level overlap removal.
4. Institutions: use HEC’s reported 262 HEIs and the separate 150 campus reference only as non-monetized supply-side context.

## 14. Step 2 Wave 1 Status

**WAVE 1 STATUS: COMPLETE WITH DISCLOSED DATA GAPS**

Pakistan research now has a defensible official reference or explicitly documented proxy path for each segment. Perfect unique-organization counts are not publicly available for every segment; those gaps are disclosed and no proxy is presented as a verified total.

No TAM, SAM, SOM, market value, ARPA multiplication, or unsupported percentage assumption was created.
