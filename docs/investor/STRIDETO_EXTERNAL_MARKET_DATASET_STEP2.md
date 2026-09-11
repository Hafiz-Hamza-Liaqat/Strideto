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

## United States — Employers

### Official Sources

The following official U.S. sources were reviewed:

- [U.S. Census Bureau 2022 Economic Census first-look results](https://www.census.gov/library/stories/2024/06/economic-census-annual-business-survey-results.html)
- [U.S. Census Bureau 2023 Annual Business Survey company summary](https://data.census.gov/table/ABSCS2023.AB2300CSA01)
- [U.S. Census Bureau 2023 County Business Patterns](https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html)
- [U.S. Census Bureau 2023 Business Dynamics Statistics](https://www.census.gov/data/datasets/time-series/econ/bds/bds-datasets.html)
- [U.S. Census Bureau BDS API variables and size definitions](https://api.census.gov/data/timeseries/bds/variables.html)
- [U.S. Census Bureau 2022 Economic Census firm-size table](https://data.census.gov/table/ECNSIZE2022.EC2200SIZEEMPFIRM)

### Primary Employer Reference

The strongest broad U.S. organization-level reference located is the 2022 Economic Census first-look total of approximately **6.2 million firms at the company level**. The same release reports approximately 8.0 million establishments and 140.0 million employees. The firm count is closer to STRIDETO’s canonical organization unit than the establishment count because a company or firm may operate one or more establishments.

The latest exact direct employer-firm count located is the 2023 Annual Business Survey: **5,934,950 employer firms**. The ABS universe requires firms to have paid employees, to have operated for at least part of the reference year, to have at least $1,000 in annual receipts, and to fall within 19 in-scope sectors. The ABS reports companies/firms rather than establishments and counts a multi-establishment firm once in the U.S. all-sector total.

For this dataset:

- **PRIMARY EMPLOYER REFERENCE:** 2022 Economic Census, approximately 6.2 million company-level firms.
- **CONSERVATIVE PROXY:** 2023 ABS, 5,934,950 employer firms, because its narrower sector and receipt scope is explicitly defined and directly organization-level.
- **CROSS-CHECK:** 2022 Economic Census approximately 8.0 million employer establishments; 2023 CBP establishment data; 2023 BDS firm series.
- **UNSUITABLE AS UNIQUE ORGANIZATION COUNT:** CBP establishment totals, QCEW establishments, and nonemployer businesses.

These are official population references only. No hiring, digital-reachability, willingness-to-pay, or STRIDETO eligibility percentage is applied.

### U.S. Source Comparison

| Source | Data year | Reported count | Unit | Employer? | Unique organization? | National? | Recommended role | Limitations |
|---|---:|---:|---|---|---|---|---|---|
| 2022 Economic Census first-look | 2022 | Approx. 6.2 million | Firms at company level | Yes, paid-employer universe | Yes, company/firm unit | Yes, broad 19-sector scope | Primary broad employer reference | First-look aggregate; count is approximate; detailed firm-size extraction remains separate |
| 2022 Economic Census first-look | 2022 | Approx. 8.0 million | Employer establishments/locations | Yes | No | Yes | Cross-check only | One organization may own multiple establishments |
| 2023 Annual Business Survey | 2023 reference year | 5,934,950 | Employer firms/companies | Yes | Yes within ABS scope | Yes | Conservative direct organization proxy | Excludes specified sectors and firms below $1,000 annual receipts; exact survey universe differs from Economic Census |
| 2023 County Business Patterns | 2023 | COUNT NOT VERIFIED in this pass | Employer establishments | Yes | No | Yes | Establishment cross-check | Establishment unit; not a company/enterprise count |
| 2023 Business Dynamics Statistics | 2023 | COUNT NOT VERIFIED in this pass | Firms and establishments by dynamics/size | Yes | Firm series is organization-oriented | Yes, 50 states and D.C. | Size and activity cross-check | Public size files/API require separate extraction; not used as a headline total here |
| Nonemployer Statistics | Latest reviewed source family | NOT USED | Nonemployer businesses | No | Not suitable for employer denominator | Yes | Rejected contrast | Nonemployers have no paid employees and must not be added to employer firms |

### Size Distribution

The U.S. official sources support firm-size analysis, but the published category systems are not identical to STRIDETO’s requested bands. The BDS categorical size framework exposes firm-size categories including:

- 1–4 employees;
- 5–9;
- 10–19;
- 20–49;
- 50–99;
- 100–249;
- 250–499;
- 500–999;
- 1,000 or more.

The ABS has an employment-size-of-firm table for employer firms, and the 2022 Economic Census has an employment-size-of-firms table. Their national size counts were not transcribed into this pass because the official interactive/download endpoints expose separate table extraction requirements. The size-band sources are retained for the next structured extraction rather than silently re-binning or estimating counts.

No exact U.S. conservative/base/upside eligible population is created.

### Establishment vs Firm Treatment

The U.S. Census Bureau defines an establishment as a single physical location. A company or firm may contain one or more establishments operating under common ownership or control. Accordingly:

- employer firms are the preferred organization unit;
- establishments are operating-location units;
- CBP and QCEW establishment totals must not be treated as unique employers;
- multi-state firms must be counted once in a national firm total;
- branches, stores, plants, offices, and job locations are not additional paying organizations;
- subsidiaries remain separate only where the source’s firm definition treats them as separate organizations.

### State-Level Research Readiness

**NATIONAL TAM DATA: READY**

The U.S. has a sufficiently strong national official employer-firm reference for later TAM work without immediately researching all 50 states.

**STATE-LEVEL SAM RESEARCH: REQUIRED LATER**

State-level research should occur after STRIDETO management defines the initial U.S. launch scope. The Census ABS, CBP, BDS, and SBA state-profile ecosystems can support state analysis, but a final state list is not selected in this wave. State selection requires a separate product, rollout, and commercial decision.

### Data Gaps

- The 6.2 million Economic Census figure is an approximate first-look aggregate.
- The 5,934,950 ABS figure has narrower sector and receipts coverage.
- A single fully reconciled current U.S. unique active employer-organization count across all source universes was not produced.
- Exact national size-band counts require a separate extraction from the ABS/Economic Census/BDS tables.
- Legal-entity deduplication across federal source universes is not publicly exposed as a single crosswalk.

### Confidence

| Finding | Source quality | Market-sizing suitability |
|---|---|---|
| Economic Census 6.2 million company-level firms | HIGH | HIGH with scope note |
| ABS 5,934,950 employer firms | HIGH | HIGH as a narrower organization proxy |
| CBP establishment data | HIGH | MEDIUM / establishment proxy |
| BDS firm and size series | HIGH | MEDIUM until exact table extraction |
| Nonemployer data | HIGH | LOW for employer market sizing |

## United Kingdom — Employers

### Official Sources

The following official U.K. sources were reviewed:

- [Department for Business and Trade — Business Population Estimates 2025](https://www.gov.uk/government/statistics/business-population-estimates-2025/business-population-estimates-for-the-uk-and-regions-2025-statistical-release)
- [Office for National Statistics — UK business: activity, size and location 2025](https://www.ons.gov.uk/releases/ukbusinessactivitysizeandlocation2025)
- [ONS 2025 enterprise/local-unit dataset](https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/datasets/ukbusinessactivitysizeandlocation/2025)
- [Companies House — Companies register activities, April 2025 to March 2026](https://www.gov.uk/government/statistics/companies-register-activities-statistical-release-april-2025-to-march-2026/companies-register-activities-statistical-release-april-2025-to-march-2026)
- [Companies House statistics and definitions](https://www.gov.uk/government/organisations/companies-house/about/statistics)

### Primary Employer Reference

The strongest direct U.K. employer organization reference is the Department for Business and Trade’s Business Population Estimates 2025:

> **1,417,730 private-sector businesses with employees at the start of 2025.**

The BPE table defines this as the employer population with one or more employees. The publication also reports 4,272,535 non-employing businesses and 5,690,265 total private-sector businesses. These must not be combined.

For this dataset:

- **PRIMARY EMPLOYER REFERENCE:** BPE 2025, 1,417,730 employers.
- **CONSERVATIVE PROXY:** BPE 2025 employer count, because it directly separates employers from non-employers and provides the requested size bands.
- **CROSS-CHECK:** ONS 2025 IDBR-based VAT/PAYE business population and local-unit statistics.
- **UNSUITABLE AS EMPLOYER ORGANIZATION COUNT:** Companies House total/effective register stock and ONS local-unit totals.

The BPE 2025 publication is official statistics in development, so its official source quality is HIGH but its statistical-status caveat is disclosed.

### U.K. Source Comparison

| Source | Data year/as-of date | Reported count | Unit | Employer? | Unique organization? | National? | Recommended role | Limitations |
|---|---:|---:|---|---|---|---|---|---|
| DBT Business Population Estimates | Start of 2025 | 1,417,730 | Private-sector employer businesses | Yes | Yes, business-level estimate | Yes | Primary employer reference | Official statistics in development; methodology estimates the wider private sector |
| DBT Business Population Estimates | Start of 2025 | 5,690,265 | All private-sector businesses | Mixed | Yes, business-level estimate | Yes | Total-population cross-check only | Includes 4,272,535 non-employers |
| ONS UK Business: Activity, Size and Location | March 2025 | 2.73 million | VAT and/or PAYE businesses | Mixed | Enterprise-based, but not employer-only | Yes | Registered-business cross-check | Includes businesses without an employee-size restriction in the headline |
| ONS UK Business: Activity, Size and Location | March 2025 | Approx. 3.2 million | Local units/sites | Mixed | No | Yes | Local-unit cross-check only | Sites/local units can duplicate one enterprise |
| Companies House register activities | 31 March 2026 | 5,479,045 | Companies/corporate bodies on total register | No | Legal register unit, not employer unit | Yes | Registered-company cross-check only | Includes companies regardless of whether they actively trade; includes corporate forms beyond ordinary employer businesses |

### Size Distribution

The BPE 2025 employer distribution is:

| Official band | Businesses |
|---|---:|
| 1–9 employees | 1,150,875 |
| 10–49 employees | 220,085 |
| 50–249 employees | 38,435 |
| 250 or more employees | 8,335 |
| Total employers | 1,417,730 |

The BPE publication also reports:

- 5,643,495 businesses with 0–49 employees;
- 5,681,930 SMEs with 0–249 employees;
- 4,272,535 non-employing businesses;
- 5,690,265 total private-sector businesses.

The requested micro/small/medium/large mapping is preserved using the official U.K. thresholds. No additional eligibility or penetration percentage is applied.

### Enterprise vs Local Unit Treatment

ONS states that its 2025 dataset contains both enterprises and local units from an Inter-Departmental Business Register snapshot dated 14 March 2025. An enterprise is the organization-level unit; a local unit is a site/location associated with an enterprise.

Companies House is a legal registration system, not a trading/employer census. Companies House explicitly states that registered companies may not actively trade. The total register also includes companies in liquidation, dissolution, or other non-operating states; its effective register is still not equivalent to employer organizations.

Therefore:

- use BPE employers as the primary U.K. organization reference;
- do not use ONS local units as unique organizations;
- do not use Companies House total register as an employer denominator;
- do not add BPE employers to Companies House companies;
- deduplicate branches and trading locations to the enterprise/legal organization;
- preserve subsidiaries separately only when they are separate source-defined enterprises.

### Data Gaps

- BPE is an estimate and its 2025 status is official statistics in development.
- BPE’s “no employees” category treats companies with only one employee as having no employees when that employee is assumed to be a working proprietor.
- ONS enterprise/local-unit data and BPE business-population data use different source universes and should not be added.
- Companies House registered-company stock does not prove active trading, employees, or hiring.
- A legal-entity crosswalk between Companies House, IDBR enterprises, and BPE businesses is not provided as one public national table.

### Confidence

| Finding | Source quality | Market-sizing suitability |
|---|---|---|
| BPE 1,417,730 employers | HIGH, with official-statistics-in-development caveat | HIGH |
| BPE size-band counts | HIGH, with methodology caveat | HIGH |
| ONS 2.73 million VAT/PAYE businesses | HIGH | MEDIUM / registered-business cross-check |
| ONS 3.2 million local units | HIGH | LOW / local-unit proxy |
| Companies House 5,479,045 total register | HIGH | LOW / registered-company proxy |

## Global Market Framework

This section establishes the international-standard framework for future market sizing. It does not create a global organization total, TAM, SAM, SOM, market value, ARPA multiplication, penetration rate, or eligible-customer estimate.

### Global Employer Population

**Repository and research conclusion:** a single authoritative worldwide count of unique active employer organizations was **NOT FOUND**. Global sources measure different universes and must not be added together.

The recommended framework is a controlled multi-source aggregation:

1. Use comparable enterprise/employer series from OECD Structural and Demographic Business Statistics where countries are covered. The OECD database provides enterprise counts by activity and size class, but its enterprise universe can include both employers and non-employers; employer status and size definitions must be filtered explicitly. See the [OECD business-demography data explorer](https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.SDD.TPS&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=DSD_SDBSBD_ISIC4%40DF_BD&df%5Bvs%5D=1.0&snb=23&tm=elderly) and [OECD structural business statistics](https://data-explorer.oecd.org/s/42g).
2. Use national employer-business or enterprise references for priority countries not covered consistently by the OECD series. Pakistan, the United States, and the United Kingdom are already documented in this file; Canada, UAE, Saudi Arabia, Australia, and Singapore are validation anchors for later waves.
3. Use World Bank Enterprise Surveys as a comparable formal-private-sector benchmark, not as a count. The survey targets registered private firms with five or more employees and is establishment-level representative sample data. See the [World Bank Enterprise Surveys collection](https://microdata.worldbank.org/collections/enterprise_surveys) and [official methodology](https://documents1.worldbank.org/curated/en/099021625220536458/pdf/P178118-d08968cd-5a94-4eb2-8ebf-d5f56be6791a.pdf).
4. Use ILOSTAT for employment-size, labour-market, and regional context. ILOSTAT is not a unique-organization register and must not be used as a worldwide employer denominator. See the [ILOSTAT data catalogue](https://ilostat.ilo.org/data/) and [bulk data framework](https://ilostat.ilo.org/data/bulk/).

The global employer source types are classified as follows:

| Source type | Organization unit | Employer requirement | Global use | Suitability |
|---|---|---|---|---|
| OECD enterprise/business-demography tables | Enterprise, with official size/activity dimensions | Must filter to employer-relevant series/size classes | Comparable multi-country aggregation | HIGH where employer filter and coverage are clear |
| National employer-business or enterprise counts | Country-defined enterprise/business | Varies by source; definition must be recorded | Priority-country validation and gap filling | HIGH to MEDIUM depending on definition |
| World Bank Enterprise Surveys | Formal private-sector establishment sample | Registered firm; generally 5+ employees | Definition and size-band benchmark, not total count | MEDIUM / sample framework |
| ILOSTAT | Labour and employment indicators | Not an organization count | Regional context and size/employment validation | LOW for payer denominator |
| OECD SME indicators | SME/business-demography framework | Varies; not a global employer stock | Regional benchmark/context | MEDIUM for context, not denominator |

No global employer count is presented here as a verified total. The future aggregation must choose one non-overlapping country/region universe, preserve enterprise versus establishment definitions, and avoid adding global, regional, and country totals that cover the same organizations.

### OECD Actual Extraction Result

The OECD Data Explorer was inspected for the actual business-demography and structural-business-statistics series. The strongest comparable series for an employer-led model is:

| Field | Extracted result |
|---|---|
| Dataset name | **Employer business demography by size class and economic activity (ISIC Rev. 4)**, OECD Structural and Demographic Business Statistics (SDBS), dataflow `DSD_SDBSBD_ISIC4@DF_BD_EMP` |
| Measure name | **Enterprises**; active employer enterprises by economic activity and employment-size class |
| Latest common year | **2022** for the 39-country comparison selection inspected in the OECD table; later country observations exist but are not common to every selected country |
| Countries covered | OECD members, accession and partner countries, ESS countries supplying Eurostat data, and participants in OECD regional initiatives. The inspected 39-area selection included AUT, BEL, CAN, CHE, CRI, CZE, DEU, DNK, ESP, EST, FIN, FRA, GBR, GRC, HRV, HUN, IRL, ISL, ISR, ITA, LTU, LUX, LVA, MLT, MKD, NLD, NOR, POL, PRT, ROU, SRB, SVK, SVN, SWE, TUR, ALB, BIH, BGR and CYP. Coverage is not universal and must be checked by country/year. |
| Unit | Number of enterprises; enterprise size classes based on persons employed: total/all sizes, 1–9, 10–49, 50–249, and 250 or more where reported |
| Employer-only | **YES**, for the `DF_BD_EMP` employer-business-demography flow. The parallel `DF_BD` flow is all enterprises and includes employers and non-employers. |
| Enterprise-level | **YES** |
| Active enterprise | **YES**; the OECD/Eurostat business-demography convention defines active employer enterprises as enterprises with at least one employee, with the all-enterprise population separately including non-employers |
| Source URL | [OECD employer business demography by size class](https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.SDD.TPS&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=DSD_SDBSBD_ISIC4%40DF_BD_EMP&lc=en), [OECD structural business statistics by size class](https://data-explorer.oecd.org/s/42g), and [Eurostat-OECD business-demography manual](https://www.oecd.org/content/dam/oecd/en/publications/reports/2008/01/eurostat-oecd-manual-on-business-demography-statistics_g1gh8b54/9789264041882-en.pdf) |
| Market-sizing suitability | **HIGH as the multi-country employer-enterprise framework; not a worldwide total.** Use country/year cells only after checking coverage, sector scope, and overlap with national anchors. |

The OECD definition distinguishes: `N` = active enterprises including employers and non-employers; `N1` = active employer enterprises with at least one employee; `N2` = active employer enterprises with at least two employees; and `N(0)` = active non-employer enterprises. This resolves the prior ambiguity: OECD does provide an employer-only enterprise series, but it is a country/year table rather than a single globally complete population. The separate structural-business-statistics flow provides enterprise counts by activity and employment-size class, with the OECD table exposing the standard total, 1–9, 10–49, 50–249, and 250+ bands. See the [OECD all-enterprise dataflow](https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.SDD.TPS&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=DSD_SDBSBD_ISIC4%40DF_BD&df%5Bvs%5D=1.0&snb=23&tm=elderly), [OECD employer dataflow](https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.SDD.TPS&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=DSD_SDBSBD_ISIC4%40DF_BD_EMP&lc=en), and [OECD structural-size table](https://data-explorer.oecd.org/s/42g).

### International Anchor Extraction — Canada, UAE, Saudi Arabia, Australia, Singapore

These are validation anchors, not additive global totals.

#### Canada actual result

**CANADA PRIMARY EMPLOYER REFERENCE:** **approximately 1.37 million employer businesses**; **December 2025**; **active employer businesses counted by the statistical concept of location**. Statistics Canada defines employer businesses through payroll-deduction remittances and identifies businesses as active on the Business Register. The companion non-employer population with annual revenue above $30,000 was approximately 3.67 million. The location unit is not identical to a unique enterprise, so this is a strong employer-location anchor and not a clean legal-enterprise denominator. The 2023 Entrepreneurship Indicators release separately reports **1,197,980 active enterprises with one or more employees**, which is the stronger enterprise-level cross-check but is older. Sources: [Canadian business counts, December 2025](https://www150.statcan.gc.ca/n1/daily-quotidien/260213/dq260213c-eng.htm), [Entrepreneurship indicators of Canadian enterprises, 2023](https://www150.statcan.gc.ca/n1/daily-quotidien/251112/dq251112c-eng.htm), and [Canadian Business Counts with employees, December 2023](https://www150.statcan.gc.ca/n1/en/catalogue/3310080601).

#### UAE actual result

**UAE PRIMARY EMPLOYER/BUSINESS REFERENCE:** **1.5 million active and cancelled commercial licences**; **1 October 2024**; **National Economic Registry (NER) licence records across the seven emirates**. This is the strongest official national proxy located. It is not an employer-only count, and the published figure combines active and cancelled licences. NER uses the federal unified economic number to integrate federal and local licensing data and distinguishes a national registry from separate emirate registers. It may include establishments, branches, and licence records; the public release does not provide a deduplicated active-enterprise or employee filter. Do not combine it with emirate counts or describe it as 1.5 million employers. Source: [UAE Ministry of Economy — National Economic Registry Growth](https://www.moec.gov.ae/en/-/ministry-of-economy-launches-national-economic-registry-growth-to-support-the-uae-s-efforts-in-providing-proactive-government-services).

#### Saudi Arabia actual result

**SAUDI PRIMARY EMPLOYER/BUSINESS REFERENCE:** **1.019 million active enterprises**; **2023**; **enterprise-level business-demography population covering all 13 administrative regions**. GASTAT reports active enterprises by ISIC Rev. 4 and separately reports new and closed enterprises. The statistical unit is enterprise, which is materially stronger than a commercial-registration count. The public headline does not state that every active enterprise has an employee, so employer-only status is **PARTIAL / NOT VERIFIED**; use the OECD-style active-enterprise measure as the primary business anchor and retain employment-size data separately. Monsha’at’s **1.6 million commercial registrations** in Q4 2024 is a registry cross-check, not an enterprise or employer count. Sources: [GASTAT Business Demography Statistics 2023](https://www.stats.gov.sa/documents/d/guest/business-demography-2023-en-1-pdf), [GASTAT business-demography methodology](https://www.stats.gov.sa/en/w/methodology-and-quality-report-for-business-demography-statistics), and [Monsha’at Q4 2024 commercial-registration release](https://www.monshaat.gov.sa/en/node/274250).

#### Australia actual result

**AUSTRALIA PRIMARY EMPLOYER REFERENCE:** **999,161 employing businesses**; **30 June 2024**; **actively trading market-sector businesses with employment**. ABS reports 2,662,998 actively trading businesses in total, including 999,161 employing and therefore approximately 1,663,837 non-employing businesses. The ABS frame is built from the ABS Business Register, ABN/ATO administrative data, and excludes general government, the Reserve Bank of Australia, and non-profit institutions serving households. Reported employment-size counts include **693,558 businesses with 1–4 employees**, **68,214 with 20–199**, and **5,189 with 200+**; the remaining 5–19 band is available in the ABS data cube but is not needed to establish the headline employer count. Source: [ABS Counts of Australian Businesses, July 2020–June 2024](https://www.abs.gov.au/statistics/economy/business-indicators/counts-australian-businesses-including-entries-and-exits/jul2020-jun2024).

#### Singapore actual result

**SINGAPORE PRIMARY EMPLOYER REFERENCE:** **NOT VERIFIED as employer-only.** The strongest official enterprise proxy located is **345,100 enterprises in 2023**, excluding the public sector. Singapore DOS defines enterprises as incorporated or registered entities with revenue or employment in the reference period; ministries, statutory boards, and government/government-aided schools are excluded. This is an enterprise-level active/revenue-or-employment population, not an employee-only population. ACRA’s **609,422 live entities as at 31 March 2025** is kept separate as a live-register count. MOM reports **356,600 SMEs with fewer than 200 workers in 2024**, including employment bands, but that is an SME subset defined by revenue or employment and is not the full employer population. Sources: [Singapore DOS Enterprise Landscape 2023](https://www.singstat.gov.sg/-/media/files/visualising_data/infographics/industry/singapores-enterprise-landscape.ashx), [ACRA FY2024-25 annual report](https://www.acra.gov.sg/docs/default-source/default-document-library/training-and-resources/publications/reports/acra-annual-reports/acra-fy2024-25-annual-report_high-res.pdf?sfvrsn=2221dec1_2), and [MOM SME employment-size answer](https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2026/0303-written-answer-to-pq-on-distribution-of-smes).

### Normalized Eight-Country Validation Table

| Country | Primary count | Year | Unit | Employer-only? | Enterprise-level? | Official source | Headline suitability | Notes |
|---|---:|---:|---|---|---|---|---|---|
| Pakistan | 7,142,941 | 2023 | Establishments | NO | NO | PBS Economic Census Table 1 | Proxy only | Broad official establishment frame; preserve existing treatment and do not call it unique employers. |
| United States | 5,934,950 | 2023 | Employer companies/firms | YES, source-defined | YES | U.S. Census Annual Business Survey | High | Paid-employee firms in the ABS scope; preserve existing exclusions and methodology. |
| United Kingdom | 1,417,730 | 2025 | Private-sector employer businesses | YES | Business unit | DBT Business Population Estimates Table C | High | Direct employer reference; official statistics in development caveat preserved. |
| Canada | ~1,370,000 | Dec. 2025 | Active employer business locations | YES | NO / location | Statistics Canada Canadian business counts | High with unit caveat | Strong employer anchor; use 2023 active-enterprise count as enterprise-level cross-check. |
| UAE | 1,500,000 | 2024 | Active and cancelled commercial licences | NO | NO / licence record | UAE Ministry of Economy NER | Proxy only | National seven-emirate proxy; do not treat licences, branches, and establishments as unique employers. |
| Saudi Arabia | 1,019,000 | 2023 | Active enterprises | PARTIAL / NOT VERIFIED | YES | GASTAT Business Demography | Medium / proxy | Enterprise-level active population; employer filter not stated in public headline. |
| Australia | 999,161 | Jun. 2024 | Employing actively trading businesses | YES | Business-level | Australian Bureau of Statistics CABEE | High | Preferred Australian employer count; total active businesses and size bands retained separately. |
| Singapore | 345,100 | 2023 | Active/revenue-or-employment enterprises | NO | YES | Singapore Department of Statistics | Medium / proxy | Employer-only count not verified; ACRA live entities remain a separate registry cross-check. |

Counts in this table are not summed. The table validates country coverage and unit quality only; it is not TAM, SAM, SOM, or a global total.

### Provider Decisions

**Education & Mobility: PROXY ONLY.** No defensible internationally comparable organization dataset was found for the full study-abroad, education-agent, immigration/mobility, and relocation payer universe. Use regulator-backed national registers as lower-bound proxies, keep employment promoters separate from education agents, and do not present association or registry unions as a complete global population.

**Business / Professional Services: PROXY ONLY.** OECD activity tables and national business registers can frame relevant enterprises, but no single deduplicated international dataset was found for the exact corporate-services, company-formation, accounting/corporate-secretarial, and advisory payer universe. Regulator-backed registers such as SECP intermediaries and ACRA registered filing agents are defensible lower-bound subsets only.

### Calculation Readiness

**EMPLOYER TAM POPULATION: READY** for a controlled multi-country calculation using the OECD employer-enterprise flow where populated and the eight documented national anchors/proxies with explicit unit flags. This does not authorize a calculation in Step 2 and does not imply the country figures may be added without overlap reconciliation.

**EDUCATION & MOBILITY: PROXY ONLY**

**BUSINESS SERVICES: PROXY ONLY**

**GLOBAL REGIONAL VALIDATION: ADEQUATE** for Step 2 validation coverage. UAE, Saudi Arabia, and Singapore remain proxy/partial employer measures, but each now has an inspected official source, a stated unit, a year, and an explicit limitation; no unsupported count is presented as an employer fact.

### Global SME / Enterprise References

The OECD reports that SMEs represent approximately 99% of businesses in the OECD area, but this is a share/context indicator rather than a global organization count. See [OECD SME indicators and benchmarking](https://www.oecd.org/en/topics/sme-indicators-benchmarking-and-monitoring.html) and [OECD SME productivity/inclusive-growth context](https://www.oecd.org/en/publications/strengthening-smes-and-entrepreneurship-for-productivity-and-inclusive-growth_c19b6f97-en/full-report/component-3.html).

The IFC describes MSMEs as more than 90% of firms worldwide and provides finance-gap estimates, including a formal MSME finance-gap study. Those figures are broad context or credit-constrained subsets, not a validated unique employer denominator. See [IFC MSME finance](https://www.ifc.org/en/what-we-do/sector-expertise/financial-institutions/msme-finance) and the [IFC MSME finance-gap report](https://www.ifc.org/content/dam/ifc/doclink/2018/msme-finance-gap-report.pdf).

Accordingly:

- **DIRECT EMPLOYER REFERENCE:** country/regional employer-enterprise series after definition filtering.
- **BROAD ENTERPRISE REFERENCE:** OECD and national enterprise totals where employer status is mixed.
- **SME REFERENCE:** OECD/IFC shares and size frameworks; not a count for the base model.
- **ESTABLISHMENT PROXY:** census, CBP, local-unit, or survey establishment series.
- **NONEMPLOYER-INCLUSIVE:** all-enterprise or SME totals unless the source explicitly separates employers.
- **UNSUITABLE:** repeated marketing figures without an authoritative source, definition, year, and coverage statement.

The frequently repeated “hundreds of millions of MSMEs” claims are not used as a STRIDETO denominator unless the underlying source, universe, year, and employer treatment can be reproduced.

### Regional Employer Coverage

The international framework uses regions as coverage and reconciliation dimensions, not as additional populations to be added to country totals:

| Region | Validation anchors | Framework sources | Current status |
|---|---|---|---|
| North America | United States and Canada | National employer/enterprise series; OECD where covered; World Bank/ILO context | United States and Canada extracted; Canada location/enterprise distinction disclosed |
| Europe | United Kingdom and EU/Eurostat | UK BPE/ONS; Eurostat/OECD enterprise tables | United Kingdom complete; EU regional extraction planned |
| GCC / Middle East | UAE and Saudi Arabia, with other GCC only if data quality justifies it | National statistical/regulator sources; OECD/ILO/World Bank context where available | UAE official licence proxy and Saudi active-enterprise anchor extracted; no aggregate invented |
| South Asia | Pakistan, with India/Bangladesh/Sri Lanka only where an authoritative comparable series exists | Pakistan completed; OECD/World Bank/ILO and national sources | Pakistan complete with disclosed gaps |
| Asia-Pacific | Australia and Singapore, with New Zealand/Malaysia only if useful | OECD, national statistical/business registers, UIS/ILO context | Australia employer count extracted; Singapore enterprise proxy and employer gap disclosed |
| Other global markets | Region-level coverage only where a comparable official series exists | World Bank/OECD/ILO/UN regional datasets | Do not force country-by-country research |

This framework is sufficient to stop treating every country as a separate research requirement. Individual-country research remains necessary only for priority-market validation, legal/serviceability decisions, and material definition gaps.

### Education & Mobility Provider Coverage

**GLOBAL DIRECT COUNT: NOT FOUND IN REPOSITORY OR OFFICIAL GLOBAL SOURCES REVIEWED.** No single internationally comparable register of study-abroad consultancies, education agents, student-recruitment organizations, migration/mobility consultancies, and relocation providers was identified.

The defensible future approach is a tagged lower-bound proxy:

- collect official government, regulator, university-sector, or destination-country agent registers that identify Pakistan-based or other origin-country provider organizations;
- normalize organization names, domains, addresses, and legal identifiers where available;
- deduplicate one organization across education advising, student recruitment, visa assistance, immigration, and relocation categories;
- retain source-by-source coverage and do not present the union as a complete global population;
- label the result **OFFICIAL LOWER-BOUND PROVIDER PROXY** unless national coverage and inclusion rules are demonstrated.

Association directories and commercial directories may support discovery, but they are not headline totals. Student or international-mobility counts from UNESCO or OECD measure demand, not provider organizations.

The [OECD international student mobility indicator](https://www.oecd.org/en/data/indicators/international-student-mobility.html) and UNESCO UIS international education indicators are appropriate demand-side context, not a provider denominator.

### Business Services Provider Coverage

**GLOBAL DIRECT COUNT: NOT FOUND.** No single global registry was found that counts the exact STRIDETO payer universe of corporate-service, company-formation, accounting/corporate-secretarial, and business-advisory organizations.

The future provider methodology is:

1. define the included activity taxonomy before counting (company formation/corporate services, company secretarial, accounting or tax practice where the official register identifies firms, and relevant business advisory services);
2. use OECD structural business statistics or national statistical business registers to identify enterprise populations in the relevant activities where available;
3. use regulator-backed firm registers as lower-bound validation subsets;
4. keep individual professionals separate from firms and do not add accountants, lawyers, consultants, and company agents without an explicit service-relevance rule;
5. deduplicate across overlapping activity registers before any aggregation.

OECD structural business statistics are suitable for a broad activity-based enterprise frame, but they are not automatically a count of STRIDETO providers. National regulator registers remain necessary for precise provider classification.

### Institution Reference Population

Institutions remain **NON-MONETIZED / DO NOT MODEL AS BASE REVENUE**. They are supply-side/reference data only.

The preferred global reference is the [UNESCO Institute for Statistics Data Browser](https://databrowser.uis.unesco.org/) and its [February 2026 bulk data release](https://databrowser.uis.unesco.org/resources/bulk). UIS is UNESCO’s official statistical agency and provides internationally comparable education statistics; its formal-education data are collected from official administrative sources and cover colleges, universities, and other tertiary institutions. See the [UIS data methodology](https://uis.unesco.org/en/methodology/communication-et-information) and [background information on education statistics](https://uis.unesco.org/sites/default/files/documents/background-information-education-statistics-uis-database-en-2025.pdf).

UIS indicators and national registers must preserve separate dimensions for institution, campus, local unit, and education level. Enrollment and institution counts are not interchangeable, and campuses must not be added to university/DAI organizations unless the source defines them as the same unit. No institution count is multiplied by ARPA in the base model.

### Demand-Side Reference Population

Individual users are free and are **DEMAND / LIQUIDITY METRICS**, not payer units. Future demand-side context may use:

- ILOSTAT global/regional labour-force, employment, and job-seeker indicators;
- UNESCO UIS tertiary enrolment, international mobility, and education-participation indicators;
- World Bank population and labour-market indicators where definitions are explicit;
- OECD international student mobility for destination-market context.

These sources may support product-liquidity and adoption narratives, but they must not be converted into paying-organization counts or revenue.

### Country Validation Anchors

The existing priority anchors are retained:

- **Pakistan:** PBS establishment/workforce references, SECP company stock/flow, HEC/Pakistan Economic Survey/NAVTTC institutional references, with disclosed provider gaps.
- **United States:** Census ABS employer-firm reference, Economic Census company-level context, CBP establishment cross-check, and BDS size-series framework.
- **United Kingdom:** DBT BPE employer-business reference, ONS enterprise/local-unit cross-check, and Companies House legal-register cross-check.
- **Canada, UAE, Saudi Arabia, Australia, Singapore:** official national anchors/proxies extracted above with explicit employer, enterprise, establishment, licence, and registry distinctions.

Country anchors validate definitions and serviceability; they are not added to a global aggregate if the global/regional source already covers the same organizations.

### Source Normalization Rules

Every retained source record must normalize:

`country_or_region | source | dataset | year | reported_count | unit | employer_required | formal_only | active_status | enterprise_or_establishment | source_authority | source_type | confidence | TAM_suitability | SAM_suitability | headline_suitability | deduplication_notes | limitations`

The existing CSV schema is preserved. The expanded fields are represented in its existing columns: `unit_definition`, `geographic_scope`, `source_tier`, `confidence`, `verified_status`, `deduplication_notes`, `eligibility_use`, `limitations`, and `notes`.

Required status labels remain:

- `VERIFIED_EXTERNAL_FACT`
- `PROXY`
- `COUNT_NOT_VERIFIED`

Authority and suitability are separate. An official source can still be a low-suitability proxy when it measures establishments, legal registrations, non-employers, survey samples, campuses, or register rows rather than unique payer organizations.

### Global Deduplication Rules

The canonical payer unit is **ONE UNIQUE ORGANIZATION**.

- Prefer an enterprise/legal organization identifier over a branch, establishment, local unit, job location, or staff account.
- Do not add global, regional, and country datasets covering overlapping populations.
- Keep subsidiaries separate only when the source defines them as separate enterprises and the model intentionally counts them as separate paying organizations.
- Count a multi-service education/mobility provider once across study-abroad, visa, immigration, and relocation categories.
- Count a business-services firm once across incorporation, accounting, tax, company-secretarial, and corporate-advisory categories when the same organization is identified.
- Keep institution, campus, school, and local-unit dimensions separate.
- Where deduplication is impossible, label the result as `REGISTER ROWS`, `ESTABLISHMENT PROXY`, `LOCAL-UNIT PROXY`, `LEGAL-ENTITY STOCK`, or `OFFICIAL LOWER-BOUND PROVIDER PROXY`.

### Future TAM Methodology

TAM will later be structured as:

`unique eligible employer organizations × global USD employer ARPA`

`+ unique eligible education/mobility provider organizations × global USD provider ARPA`

`+ unique eligible business/professional service organizations × global USD provider ARPA`

Only after the organization universe, coverage, and eligibility filters are locked. Institutions are excluded from base revenue because they are free initially. Individual users are excluded because they are free demand-side users. Featured/sponsored listings, qualified leads, consultations, commissions, and advertising remain secondary/future revenue and are excluded from base ARPA.

### Future SAM Methodology

SAM will apply explicit serviceability filters to the unique organization universe, including:

- legal and regulatory ability to serve the market;
- supported language and product availability;
- payment accessibility and USD checkout feasibility;
- operational/onboarding coverage;
- relevant employer/provider vertical availability;
- launch-country and near-term rollout scope.

SAM must not be created by applying an arbitrary global percentage. Each excluded geography or segment must have a documented reason, and technically available countries must not be treated as commercially serviceable without product and operating evidence.

### Future SOM Methodology

SOM will later use launch geographies and operating constraints, including:

- sales and onboarding capacity;
- acquisition budget and channel capacity;
- free-to-paid conversion;
- employer/provider activation;
- rollout timing and country sequencing;
- retention/churn;
- global USD ARPA;
- CAC, sales cycle, and realistic time horizon.

Conservative, Base, and Upside scenarios may be created only after management approves the operating assumptions. No SOM percentage or dollar value is created here.

### Top-Down Cross-Check Policy

Industry data for online recruitment, HR technology, education services, international student recruitment, and professional/business-services marketplaces may be used later as **TOP-DOWN CONTEXT / CROSS-CHECK** only.

Such market reports must not replace STRIDETO’s bottom-up payer model unless the measured market maps directly to STRIDETO’s monetizable organization units, geographies, and revenue mechanism. “Global recruitment market = $X” is not STRIDETO TAM by itself. Preferred investor wording is:

`unique paying organizations × annual global USD ARPA`,

with any broader industry market size presented separately and clearly labelled as context.

### Remaining Data Gaps

- No single authoritative global unique active employer-organization total.
- OECD country/year coverage still requires overlap reconciliation before any multi-country calculation; the actual employer flow and definitions are now identified.
- UAE is a licence-record proxy, Saudi Arabia is an active-enterprise measure with employer status not stated in the public headline, and Singapore has no verified employer-only total; these are disclosed limitations, not unrecorded gaps.
- No globally comparable direct education/mobility-provider organization count.
- No globally comparable direct business/professional-service-provider organization count.
- Provider organization crosswalks and regulator-register deduplication are not yet complete.
- Institution sources provide comparable education indicators, but institution-versus-campus organization counts require source-specific treatment.
- Legal-entity crosswalks between country business registers and international enterprise datasets are generally not public as a universal table.
- SAM serviceability, payment, language, legal, and rollout decisions require management inputs beyond source counts.

### Global Readiness Assessment

**GLOBAL STEP 2 STATUS: READY FOR MARKET-SIZE CALCULATION**

The OECD/multi-country employer framework has been inspected, all eight validation anchors are documented, provider segments have explicit PROXY ONLY decisions, and remaining unit limitations are disclosed. A later calculation must still select a non-overlapping country/region universe and apply the approved ARPA inputs; this document does not calculate TAM, SAM, or SOM.

## 14. Step 2 Wave 2 Status

**WAVE 2 STATUS: COMPLETE**

The United States and United Kingdom now have official national employer references, explicit organization-versus-location treatment, documented size-band sources, and disclosed limitations. Exact U.S. firm-size values remain a follow-on extraction item, but the official source and category framework are identified without estimating or re-binning.

No TAM, SAM, SOM, market value, ARPA multiplication, penetration percentage, or final STRIDETO eligible-customer count was created.

## 15. Step 2 Wave 1 Status

**WAVE 1 STATUS: COMPLETE WITH DISCLOSED DATA GAPS**

Pakistan research now has a defensible official reference or explicitly documented proxy path for each segment. Perfect unique-organization counts are not publicly available for every segment; those gaps are disclosed and no proxy is presented as a verified total.

No TAM, SAM, SOM, market value, ARPA multiplication, or unsupported percentage assumption was created.

## 16. Final Validation Checklist

```text
TAM = NO
SAM = NO
SOM = NO
Production auth requested = NO
Production API calls = 0
Production writes = 0
```

Only the two intended Step 2 files were edited in this pass. Step 1, product code, staging, commits, and pushes were not performed. Existing Pakistan, United States, and United Kingdom data were preserved.
