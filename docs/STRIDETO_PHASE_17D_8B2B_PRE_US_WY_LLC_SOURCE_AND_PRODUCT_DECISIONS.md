# STRIDETO PHASE 17D-8B2B-PRE
US-WY LLC OFFICIAL-SOURCE REQUIREMENT PACK
SOURCE MAPPING AND PRODUCT ARCHITECTURE DECISION LOCK

**PHASE:** 17D-8B2B-PRE

**TYPE:** OFFICIAL-SOURCE + PRODUCT DECISION LOCK

**STATUS:** COMPLETE

**17D-8B2B IMPLEMENTATION:** NOT STARTED

**PACK:** DRAFT DESIGN ONLY

**PACK ACTIVATION:** NO

**HSI:** OFF / NOT REQUIRED FOR WY V1

**DOCUMENT UPLOADS:** ZERO FOR WY V1

**B2C:** NOT STARTED

**8C:** NOT STARTED

**GOVERNMENT SUBMISSION:** NOT IMPLEMENTED

**LEGAL COUNSEL STATUS:** NOT PROVIDED BY THIS DOCUMENT

This document is **official-source requirement mapping** and **product / owner architecture authority**.

It is **not** legal counsel, pack implementation, pack activation, HSI launch approval, filing authorization, statutory e-signature, payment, or government submission.

No Wyoming pack code, Case fact UI, Provider fact UI, HSI enablement, CaseFilingAuthorization, e-sign, or SOS filing is authorized by this lock.

---

## 1. Baseline record

Decision-lock baseline HEAD: `c7a74986f18a1ac2518be61314b75a58c482ac25`

`docs(release): finalize phase 17d-8b2a acceptance and closure`

| Item | Status |
| --- | --- |
| 17D-7 | CLOSED |
| 17D-8A | CLOSED |
| 17D-8B1 | CLOSED |
| 17D-8B2-PRE | CLOSED |
| 17D-8B2A | CLOSED |
| 17D-8B2B | NOT STARTED |
| 17D-8B2C | NOT STARTED |
| 17D-8C | NOT STARTED |
| Phase 18 | NOT STARTED |
| Wyoming pack | DRAFT DESIGN ONLY / NOT IMPLEMENTED / NOT ACTIVATED |
| HSI production | OFF / NOT READY |
| Marketplace | OFF |
| Existing Worker | STOPPED |

Architectural **selections** in this document are not runtime **PASS** and are not pack activation.

---

## 2. What this lock is and is not

This lock persists the accepted 17D-8B2B-PRE Wyoming source research and product mapping for:

- `capabilityId`: `business_formation`
- `jurisdictionId`: `j:US-WY`
- `entityTypeId`: `et:US-WY:LLC`
- `authorityId`: `auth:US-WY-SOS`

Scope: **Wyoming domestic limited liability company formation only.**

Out of this pack:

- foreign LLC qualification
- corporation, nonprofit, LP, LLP
- series LLC
- close LLC (v1)
- L3C
- DAO
- annual report as a formation requirement
- EIN / federal tax / bank account
- BOI / FinCEN
- ongoing compliance, dissolution, amendment, conversion, merger

This document does **not** authorize 17D-8B2B application code. Future B2B, if commissioned, may implement a **DRAFT** pack only under the boundary in section 45.

---

## 3. Official Wyoming source set

**LOCKED.** Retrieval date for this lock: **2026-08-16**.

Commercial formation-service companies, blogs, SEO articles, law-firm summaries, and registered-agent marketing sites are **not** legal authority. Secondary pages may be used only to locate an official source.

| sourceId | Authority | Title | URL | Source type | Revision / effective date if stated |
| --- | --- | --- | --- | --- | --- |
| `src:US-WY-sos` | Wyoming Secretary of State, Business Division | Business & UCC Center | https://sos.wyo.gov/Business/default.aspx | OFFICIAL WEB GUIDANCE | live page; retrieved 2026-08-16 |
| `src:US-WY-forms-index` | Wyoming Secretary of State | Forms & Publications | https://sos.wyo.gov/Forms/ | OFFICIAL WEB GUIDANCE | live page; retrieved 2026-08-16 |
| `src:US-WY-llc-articles-form` | Wyoming Secretary of State, Business Division | Limited Liability Company Articles of Organization, instructions, and Consent to Appointment by Registered Agent (same official PDF) | https://sos.wyo.gov/Forms/Business/LLC/LLC-ArticlesOrganization.pdf | OFFICIAL FORM + OFFICIAL INSTRUCTION | Articles form: **Revised June 2021**. Instructions: **Revised May 2022**. RAConsent: **Revised December 2021**. |
| `src:US-WY-fees` | Wyoming Secretary of State, Business Division | Business Division Filing Fee Schedule | https://sos.wyo.gov/Business/docs/BusinessFees.pdf | OFFICIAL FEE SCHEDULE | **Revised: June 2026**. **Effective July 1st, 2026**. |
| `src:US-WY-howto-create` | Wyoming Secretary of State, Business Division | How to Create a Wyoming Company | https://sos.wyo.gov/Business/Docs/HowToCreateAWyomingCompany.pdf | OFFICIAL INSTRUCTION | **Revised June 2026** |
| `src:US-WY-ra` | Wyoming Secretary of State, Business Division | How to Find (or Become) a Registered Agent | https://sos.wyo.gov/Business/docs/HowToFindOrBecomeARegisteredAgent.pdf | OFFICIAL INSTRUCTION | revision not shown on fetched text; retrieved 2026-08-16 |
| `src:US-WY-name` | Wyoming Secretary of State, Business Division | How to Choose a Company Name | https://sos.wyo.gov/Business/Docs/HowToChooseACompanyName.pdf | OFFICIAL INSTRUCTION | revision not shown on fetched text; retrieved 2026-08-16 |
| `src:US-WY-name-search-tips` | Wyoming Secretary of State | Searching Business Entity Names Helpful Search Tips | https://sos.wyo.gov/Forms/WyoBiz/Name_Search_Tips.pdf | OFFICIAL INSTRUCTION | revision not shown on fetched text; retrieved 2026-08-16 |
| `src:US-WY-search` | Wyoming Secretary of State | WyoBiz online business services | https://wyobiz.wyo.gov/ | OFFICIAL WEB GUIDANCE | live page; retrieved 2026-08-16 |
| `src:US-WY-statutes-index` | Wyoming Secretary of State | Business Statutes index | https://sos.wyo.gov/Business/BusinessStatute.aspx | OFFICIAL WEB GUIDANCE | live page; retrieved 2026-08-16 |
| `src:US-WY-llc-act` | Wyoming Legislature / SOS reprint | Wyoming Limited Liability Company Act, W.S. 17-29-101 through 17-29-1105 | https://sos.wyo.gov/Forms/WyoBiz/wyoming_limited_liability_company_act_and_close_llc_supplement.pdf ; Article 2 also reviewed via Wyoming Legislature gateway | OFFICIAL STATUTE | SOS reprint / LSO statute gateway; retrieved 2026-08-16 |
| `src:US-WY-ra-act` | Wyoming Legislature / SOS reprint | Registered Offices and Agents Act, Chapter 28, W.S. 17-28-101 et seq. | https://sos.wyo.gov/Forms/WyoBiz/Registered_Offices_and_Agents_Act_Chapter_28.pdf | OFFICIAL STATUTE | SOS reprint; retrieved 2026-08-16 |
| `src:US-WY-17-16-123` | Wyoming Legislature / SOS reprint | W.S. 17-16-123 Effective time and date of document, incorporated by W.S. 17-29-205(c) | SOS WBCA reprint; LLC Act W.S. 17-29-205(c) | OFFICIAL STATUTE | SOS reprint; retrieved 2026-08-16 |

In-repo catalog already points at matching SOS / fee / RA / WyoBiz identifiers (`auth:US-WY-SOS`, `et:US-WY:LLC`, `src:US-WY-sos`, `src:US-WY-fees`, `src:US-WY-ra`, `src:US-WY-search`, `fee:US-WY-llc-articles`, `rule:US-WY-registered-agent`). This lock **does not modify the catalog**.

WyoBiz interactive wizard screens were **not** field-enumerated (no authenticated portal session). Legal filing scope is locked from statute + official paper Articles + SOS statements that domestic LLCs may file the same Articles electronically. Additional WyoBiz-only fields remain an open source question (section 44).

---

## 4. Source version truth

These dates are **separate**. Do not collapse them into one claim that all Wyoming rules became effective on 2026-07-01.

| Artifact | Locked version truth |
| --- | --- |
| Articles of Organization form | Revised **June 2021** (`LLC-ArticlesOrganization`) |
| Articles instructions | Revised **May 2022** (`LLC-ArticlesOrganizationInstructions`) |
| Consent to Appointment by Registered Agent | Revised **December 2021** (`RAConsent`) |
| Business Division filing fee schedule | Revised **June 2026**; **Effective July 1, 2026** |
| How to Create a Wyoming Company | Revised **June 2026** |

Known version tension (recorded, not silently corrected):

- Articles instructions (May 2022) still state that Wyoming statutes do not allow expedited filing.
- Fee schedule (June 2026 / effective 1 Jul 2026) lists Expedited Filing Service Same Business Day $1,400 and Next Business Day $700.

Ordinary v1 pack does **not** include expedite. The filer uses the SOS process in force at future external filing time.

---

## 5. Pack applicability date vs source-law dates

**LOCKED.**

Pack-level applicability and source-law / source-document dates are **different concepts**.

Do **not** use `effectiveFrom = 2026-07-01` to imply that Articles requirements, RA consent, organizer rules, name rules, or registered-agent law all became effective on that date.

Preferred future schema field:

- `packApplicableFrom`

Meaning: **the earliest date STRIDETO considers this exact pack / source-set version applicable.**

Each `sourceRef` retains its own:

- revision
- `effectiveDate` if the official source states one
- `retrievedAt`
- `lastReviewedAt`

If a future implementation must keep a field named `effectiveFrom` because of existing catalog/pack schema, that field means **STRIDETO PACK APPLICABILITY DATE**, not a universal source-law effective date. Document that meaning at the field. Do not silently alter legal meaning.

For this locked design, the intended pack applicability date is **2026-08-16** (source-set retrieval / this lock), not 2026-07-01. The fee schedule’s 2026-07-01 date remains a **fee-source** effective date only.

---

## 6. Authority and entity scope

**LOCKED.**

| Field | Value |
| --- | --- |
| Filing authority | Wyoming Secretary of State, Business Division |
| `authorityId` | `auth:US-WY-SOS` |
| Entity | Domestic Wyoming limited liability company |
| `entityTypeId` | `et:US-WY:LLC` |
| `jurisdictionId` | `j:US-WY` |
| Capability | `business_formation` |

Statutory formation basis includes W.S. 17-29-201 (Articles of Organization delivered to the secretary of state), W.S. 17-29-210(a)(i) (Articles fee), W.S. 17-29-108 (name), and W.S. 17-28-101 et seq. (registered office and registered agent).

---

## 7. Official filing form

**LOCKED.**

Formation instrument: **Limited Liability Company Articles of Organization**.

Paper PDF and WyoBiz electronic filing represent the **same formation instrument / scope** (Articles of Organization for a domestic LLC). W.S. 17-29-205(a) permits a medium allowed by the secretary of state. Official How to Create a Wyoming Company (June 2026) states domestic LLCs may file online or by paper.

| Variant | v1 status |
| --- | --- |
| Ordinary domestic LLC Articles | IN SCOPE |
| Series LLC (separate SOS form) | OUT |
| Close LLC (form item 2; W.S. 17-25) | OUT OF V1 |
| L3C | OUT |
| DAO | OUT |
| Foreign qualification | OUT |

`close_llc_election` is collected so v1 can fail closed if the customer elects close LLC. v1 readiness requires that value to be **false**.

---

## 8. Filing fee

**LOCKED.** Ordinary Articles filing fee: **USD 100**.

Source-backed by:

- W.S. 17-29-210(a)(i)
- official fee schedule (Limited Liability Companies: Articles of Organization*/Continuance/Domestication $100.00; revised June 2026; effective July 1, 2026)
- official Articles instructions (Filing fee of $100.00)

Existing catalog `fee:US-WY-llc-articles` amount already matches **$100**. This lock does **not** modify the catalog. The catalog **label** groups Continuance/Domestication with Articles because the official fee line does. This pack’s scope is **formation Articles only**.

Online card **convenience fee** is not part of the statutory $100.

**Expedite:** OUT OF V1.

**Payment:** OUT. Pack may cite the official $100 as readiness information only. Do not charge, collect payment, or create payment authorization in B2B.

---

## 9. Filing methods

**LOCKED** as informational methods. B2B itself does not file.

- `wyobiz_online`
- `paper_mail`

The Provider selects and uses the actual authority method later (future 8C). Special / restricted-name conditions may force paper filing or additional authority review (official name guidance). Encode those as explicit conditions, not description-string folklore.

---

## 10. Wyoming v1 document model

**HARD PRODUCT LOCK.**

```
documentRequirements[] = []
```

| Count | Value |
| --- | --- |
| Document-upload requirements | **0** |
| HSI requirements | **0** |

Not collected / not required as Case Vault documents:

- Articles of Organization
- RA consent artifact
- signature image
- passport
- CNIC
- national ID
- proof-of-address identity document
- KYC artifact

**NO FORMATION IDENTITY-DOCUMENT REQUIREMENT FOUND IN REVIEWED OFFICIAL SOURCES.** That statement is formation-pack scope only. It does not say Wyoming never requires identity verification anywhere else.

---

## 11. Articles representation

**LOCKED.**

**STRUCTURED FACTS + PROVIDER EXTERNAL PREPARATION/FILING.**

Not in v1:

- customer Articles upload
- Provider Articles Vault upload
- PDF generation
- state-form generation
- signature placement
- government PDF editing

Future 8C Provider handles external authority filing. This is consistent with the empty production document pack `gbs.case_documents.empty` remaining the global document default.

---

## 12. Registered-agent consent — source law

**LOCKED source-backed truth. Do not weaken.**

Written registered-agent consent is required.

- W.S. 17-29-201(c): Articles shall be accompanied by a written consent to appointment signed by the registered agent.
- Official Articles PDF includes **Consent to Appointment by Registered Agent**; it shall be executed by the registered agent.
- Official SOS RA instruction: that form must accompany new entity filings. **If filing online, the filer will be asked to certify that they have received a similar written consent and must keep it for future reference.**

Who signs: the **registered agent**.

Paper: the written consent **accompanies** the filing.

Online: the **filer certifies** written consent was received and **retains** it.

This lock does **not** decide whether an informal email or portal “ok” counts as written consent (section 44).

---

## 13. Registered-agent consent — v1 STRIDETO representation

**LOCKED.**

| Field | Value |
| --- | --- |
| `consentKey` | `ra_written_consent` |
| `satisfactionMode` | `provider_attestation` |
| Artifact location | `external_filer_retention` |
| `waivable` | **false** |

Meaning: the Provider attests that the written RA consent required by Wyoming was obtained and will be retained / handled in the authority filing process.

This is **not**:

- customer filing authorization
- `CaseFilingAuthorization`
- a Wyoming statutory signature
- an HSI document
- a Case Vault document

Future implementation must require an **explicit structured attestation with audit**. Provider attestation must not mean “I think the RA agreed.” Free-form consent substitution is forbidden. The Provider cannot waive the requirement.

---

## 14. Provider-as-RA

**LOCKED.**

A Provider may **not** claim to be the Wyoming registered agent merely because they provide company-formation services.

Future Provider-as-RA requires:

- capability `registered_agent`
- jurisdiction scope `j:US-WY`
- future product / evidence / protected-title wiring

**Not part of B2B** unless separately commissioned.

For v1, `ra_source = provider_as_ra` must **fail closed** unless that future capability actually exists on the exact Provider subject.

---

## 15. Organizer

Official truth:

- one or more persons may act as organizers (W.S. 17-29-201(a))
- at least one organizer signs the Articles (W.S. 17-29-203(a)(ii))
- “Organizer” means a person that acts under W.S. 17-29-201 to form a limited liability company (W.S. 17-29-102(a)(xv))
- the organizer is **not** assumed to be a member

v1 STRIDETO representation: `organizer_print_name` as a **filing-preparation fact**.

Do **not** auto-populate from customer, Provider, or Agent.

**OPEN legal question (do not resolve by code inference):** whether a given STRIDETO Provider may lawfully act as organizer or as agent for a customer, including W.S. 17-29-203(b) (“any record filed under this chapter may be signed by an agent”).

Therefore future B2B must **not** represent “Provider is organizer” unless an explicit fact/state identifies the organizer. No statutory signature is captured in STRIDETO.

---

## 16. Statutory signature

**LOCKED.** Wyoming statutory signature is **OUT OF STRIDETO V1**.

| Signature | Where it lives |
| --- | --- |
| Articles organizer signature | authority-side |
| RA consent signature | authority-side / external artifact |
| STRIDETO filing consent | **not equivalent**; B2C not started |
| Quote acceptance | **not equivalent** |
| Typed pack field | **not** automatically a statutory signature |
| Signature image | **not collected** |

W.S. 17-29-102(a)(xix) includes electronic signature in the statutory definition of “sign” **for SOS records**. That does not create a STRIDETO e-sign product.

---

## 17. Required structured facts

**LOCKED.** Use dedicated structured fact fields. Do **not** use 8A task `additional_non_sensitive_note` for addresses.

| factKey | Notes |
| --- | --- |
| `proposed_entity_name` | Customer FACT. Not a document. Not a reservation. |
| `close_llc_election` | v1 must be `false` |
| `ra_source` | `customer_individual` \| `customer_third_party` \| `provider_as_ra` (last fail-closed unless future WY RA capability exists) |
| `ra_kind` | individual or entity |
| `ra_name` | |
| `ra_registered_office_street` | Physical Wyoming street; suite included when applicable |
| `ra_registered_office_city` | |
| `ra_registered_office_state` | must be WY |
| `ra_registered_office_postal_code` | |
| `mailing_address` | |
| `principal_office_address` | |
| `entity_email` | Authority-required entity / e-service contact, not automatic account PII copy |
| `organizer_print_name` | Filing-prep; not auto-assigned |
| `filing_contact_name` | Filing-system contact, not automatic account PII copy |
| `filing_contact_phone` | |
| `ra_email` | |
| `ra_phone` | |

Do not copy STRIDETO account contact fields into the pack unless the customer or Provider explicitly supplies the filing values.

Sensitivity design: proposed name **LOW**; addresses and emails **BUSINESS_CONFIDENTIAL**; **no HSI**.

---

## 18. Optional structured facts

**LOCKED.**

| factKey | Notes |
| --- | --- |
| `ra_po_box_in_addition` | Official form: PO Box acceptable only **in addition to** a physical address |
| `ra_mailing_address_if_different` | On RAConsent form |
| `delayed_effective_date` | OPTIONAL. Not mandatory. Source-backed upper boundary: not later than the **90th day** after filing (W.S. 17-29-201(e)(i), 17-29-205(c), 17-16-123(b)). Missing value is not a blocker. Not present on the June 2021 paper Articles extract. |

---

## 19. Do not collect in v1

**LOCKED.** v1 does **not** collect:

- business purpose
- NAICS
- duration (W.S. 17-29-104(c): perpetual duration; no duration field on the official Articles form)
- member names
- manager names
- ownership percentages
- name reservation document
- identity documents
- signature images

Official Articles form has **no** member/manager field. W.S. 17-29-201(b)(iii) is Reserved. W.S. 17-29-407(a) defaults to member-managed unless articles **or** the operating agreement provide otherwise. Do not add convenience fields absent authority or product justification.

Communications-contact / key-individual records that a registered agent must keep on site (W.S. 17-28-104(d); SOS RA guidance) are **informational** RA operational duties, not v1 Articles facts.

---

## 20. Name rules

**LOCKED.**

- `proposed_entity_name` is a FACT.
- Required suffix is a **validation rule**, not a document. Official list (W.S. 17-29-108 / Articles instructions): Limited Liability Company, LLC, L.L.C., Limited Company, LC, L.C., Ltd. Liability Company, Ltd. Liability Co., Limited Liability Co.
- Name reservation is a **separate optional government service** (W.S. 17-29-109). It is **not** a v1 formation requirement.
- Name distinguishability search is a **Provider check**, not a STRIDETO guarantee of availability. Official search responsibility is on the filer.
- Restricted terms (official name guidance: education words, banking/trust words, names beginning with “A ” or special characters) are a **conditional** Provider review / paper path / `unable_to_proceed` as applicable. Encode conditions explicitly.

L3C / DAO / series designators are out of v1.

---

## 21. Registered-agent facts

**LOCKED.** Persist as facts and Provider checks, **not** uploads:

- individual vs entity eligibility (W.S. 17-28-101(a)(ii); official form)
- physical Wyoming registered office; drop box not acceptable
- PO Box / mail-forwarding / UPS-style location insufficient **as the registered office**
- suite included when the office has a suite number
- commercial RA registration check when applicable (W.S. 17-28-105)
- existing catalog rule `rule:US-WY-registered-agent` already records `physicalWyomingAddressRequired`, `poBoxInsufficient`, `dropBoxNotAcceptable` — this lock does not mutate that catalog row

---

## 22. Provider checks

**LOCKED.** Non-waivable for v1 readiness:

| checkKey | Meaning |
| --- | --- |
| `name_distinguishability_search_performed` | Filer searched per SOS name-search rules. STRIDETO does not certify availability. |
| `name_suffix_compliant` | Mechanical suffix check against the official list |
| `restricted_name_words_reviewed` | Conditional paper path / extra approval / unable_to_proceed |
| `ra_eligibility_confirmed` | Individual vs entity; physical WY office |
| `ra_written_consent_obtained_and_retained` | Satisfies `ra_written_consent` without Vault upload |
| `organizer_identified_for_external_execution` | `organizer_print_name` present; no STRIDETO signature |
| `articles_facts_complete_for_external_filing` | Mandatory facts present |
| `filing_method_selected` | `wyobiz_online` or `paper_mail` |
| `provider_not_claimed_as_wy_ra_without_capability` | `provider_as_ra` fail-closed without future WY RA capability |
| `close_llc_not_elected` | `close_llc_election === false` |

The Provider cannot mark underlying missing mandatory facts as bypassed.

---

## 23. Authority actions

**Future 8C only.** These must **not** become B2B actions or statuses:

- `file_articles_with_wy_sos`
- `pay_official_fee_externally`
- `receive_sos_filing_evidence`

B2B stops before submitted, processing, approved, registered, rejected, or authority reference.

---

## 24. `ready_for_submission` meaning

**LOCKED.**

`ready_for_submission` means only:

**STRIDETO PRE-SUBMISSION REQUIREMENTS SATISFIED.**

It does **not** mean: filed, accepted, registered, approved, government-compliant guarantee, or that the company exists.

Do not ship marketing or legal copy such as “Guaranteed Wyoming LLC”, “Fully compliant”, “Government approved”, or “Registration complete.”

---

## 25. Pack identity

**LOCKED.**

| Field | Value |
| --- | --- |
| `packId` | `gbs.requirement_pack.US-WY.LLC` |
| `packVersion` | `1` (immutable) |
| `schemaVersion` | `17d-8b2b.0` |
| `sourceSetId` | `srcset:US-WY-LLC-formation-v1` |
| `capabilityId` | `business_formation` |
| `jurisdictionId` | `j:US-WY` |
| `entityTypeId` | `et:US-WY:LLC` |
| `authorityId` | `auth:US-WY-SOS` |

This is a **filing-requirement pack**, parallel in naming to `gbs.case_documents.empty`. It is **not** a replacement of the empty **document** pack. Other entities remain on empty / unsupported / current truthful requirement state. No mass backfill.

---

## 26. Initial status and activation law

**LOCKED.**

| Field | Initial value |
| --- | --- |
| `activationStatus` | `draft` |
| `reviewStatus` | `draft` |

Implementation does **not** equal activation. No live Wyoming Case gets this pack merely because code exists.

Future server lookup may attach or use the pack only if:

- `activationStatus === active`
- **AND** `reviewStatus === reviewed`
- **AND** server-authoritative match on `capabilityId` + `jurisdictionId` + `entityTypeId`

Until then, current truthful empty / unsupported requirement behavior remains.

Client cannot select `packVersion`. Provider cannot select an easier pack.

---

## 27. Reviewed-by process

**LOCKED.** Reuse catalog review statuses. Do **not** invent an individual reviewer or store a fake lawyer name.

`reviewStatus`: `draft` | `under_review` | `reviewed` | `stale` | `superseded` | `rejected`

When reviewed, persist:

- `reviewedByRole` — `catalog_steward` | `product_owner` | `legal_counsel`
- `reviewedByProcess` — distinguish `official_source_mechanical_mapping` from `legal_interpretation_review`
- `reviewedAt`
- `sourceSetId`
- `sourceSnapshotHash`
- `approvalRef` — optional **only if a real review artifact exists**

Mechanical official-source mapping may cover form fields, fee, filing office, RA physical-address requirement, and form existence.

Legal / product interpretation remains **separate** for: Provider as organizer; Provider signing as agent; filing-authorization sufficiency; informal RA consent writings; Provider-as-RA service.

Do **not** hide unresolved legal questions behind `reviewed`.

---

## 28. Source provenance

Every requirement / rule must retain:

- `sourceId`
- title
- authority
- URL
- source type
- revision / effective date if stated
- `retrievedAt`
- `lastReviewedAt`

No unsourced rule. No automatic web-scraped law into production. Manual official-source re-check before any new pack version.

---

## 29. Snapshot and upgrade

Future **active** Case snapshots exact:

- `packId`
- `packVersion`
- `sourceSetId`
- `sourceRefs`
- fact / check / consent requirement versions

Live source updates do **not** mutate the Case.

Official source change creates a **new pack version**. Do not mutate v1 in place.

Existing Case remains on its snapshot until explicit command:

`gbs.case_requirement_pack.upgrade`

A material change may invalidate future B2C filing authorization. No silent carry-forward.

---

## 30. Waiver law

**LOCKED.**

| Requirement | Waiver |
| --- | --- |
| Mandatory official filing facts | NON-WAIVABLE |
| RA written consent | NON-WAIVABLE |
| Statutory signature | cannot be bypassed by a STRIDETO waiver |
| Future filing consent | cannot be waived by Provider |
| Security / malware scan | cannot be waived |

A STRIDETO product-only extra, if any is added later, may have a separate policy. v1 has no waivable product-only extras that replace official filing facts.

---

## 31. Zero-HSI lock

**LOCKED PROMINENTLY.**

**US-WY LLC V1 HSI REQUIREMENTS: 0**

**US-WY LLC V1 DOCUMENT UPLOAD REQUIREMENTS: 0**

B2A HSI runtime is **NOT REQUIRED FOR THIS PACK**.

Production HSI remains **OFF / NOT READY**.

Do not require HSI capability merely because B2A infrastructure exists.

---

## 32. Scanner dependency

**LOCKED.** B1 / B2A scanner dependency for Wyoming v1: **NONE**, because v1 has zero uploaded Case documents.

Do **not** enable HSI merely to make Wyoming operational.

If a later pack required any Case document upload, current production Case-document security remains fail-closed while the ordinary scanner is `not_configured`. That is why v1 is facts + Provider attestation.

Future ordinary GBS-document scanning **may** be separated from HSI encryption (MinIO + Transit) in a later explicitly approved phase. **Not B2B scope.**

---

## 33. B2C dependency

**LOCKED.**

B2C filing authorization is **not** required to:

- render the pack
- collect facts
- complete B2B fact / check readiness

Before future **actual external filing** in 8C, `CaseFilingAuthorization` will be required, bound to exact Case, exact Provider, jurisdiction / entity, pack version, and legal-text version / hash.

Quote accept remains **commercial only**.

**Do not implement B2C in B2B.**

---

## 34. 8C dependency

**8C remains NOT STARTED.**

Preferred first model: **Provider-attested manual external filing**.

Not: portal automation, credential capture, or government browser automation.

Government credentials are **forbidden** in Case artifacts, Vault documents, filing authorization, and ordinary application logs.

Draft future attestation fields (not implemented): `filingMethod`, `submittedAt`, `authority`, `filingArtifactRef` / receipt, Provider subject, pack version.

---

## 35. B2B implementation readiness

**17D-8B2B implementation readiness: READY**

**BUT ONLY FOR:**

- DRAFT
- ZERO-DOCUMENT
- ZERO-HSI
- FACTS + PROVIDER-ATTESTATION
- WYOMING LLC FORMATION PACK

**NOT READY FOR:**

- activation
- government submission
- filing consent
- statutory e-sign
- Provider-as-RA capability
- HSI

---

## 36. Remaining unresolved questions

Keep **explicitly unresolved**. These do **not** block DRAFT pack implementation. They **do** block any code that assumes answers.

1. Whether a given Provider may legally act as organizer for a customer.
2. Whether W.S. 17-29-203(b) permits the Provider to sign as agent in this product.
3. Whether future `CaseFilingAuthorization` is legally sufficient for Provider external filing.
4. Whether informal non-form writing satisfies written RA consent.
5. Provider-as-RA commercial capability / evidence / protected-title wiring for `j:US-WY`.
6. WyoBiz wizard additional fields not visible from reviewed non-authenticated official sources.

---

## 37. Future B2B implementation boundary

Future B2B **may** implement:

- source-controlled DRAFT pack
- pack registry
- pack selection law
- Case pack snapshot infrastructure
- structured formation facts
- Provider checks
- RA-consent Provider attestation state
- readiness evaluation for the DRAFT pack / test path
- customer / provider generic requirement UI
- source provenance
- review metadata
- idempotency / CAS / audit
- tests
- System / Light / Dark; 320 / 375 / 768 / 1024 / 1440; no horizontal overflow; no legal status by color only; no raw HTML

Future B2B must **NOT**:

- activate the pack
- file with Wyoming
- generate Articles
- capture statutory signature
- store an RA consent document in Vault
- enable HSI
- implement B2C consent
- start 8C
- start the existing Worker
- charge the filing fee

---

## 38. Customer and Provider workflow (design only)

Customer Case surface (not implemented): formation requirements, company information, registered agent, required filing items, readiness blockers. Plain language. No legal-jargon overload.

Provider Case surface (not implemented): required facts, missing information, RA-consent state, filing-artifact / preparation state, source / version metadata if appropriate, readiness blockers.

Provider may supplement only in the allowed `whoSupplies` lane. Provider must not impersonate the customer as the source of customer facts.

---

## 39. Threat / abuse notes

- Provider marking RA consent complete without obtaining written consent → forbidden; structured attestation + audit; still not a statutory e-sign substitute
- Provider claiming to be Wyoming RA without `registered_agent` + `j:US-WY` → fail closed
- Client requesting an arbitrary `packVersion` → rejected
- Mass-applying the Wyoming pack to other entities → forbidden
- Uploading identity documents “just in case” → forbidden by this pack
- Treating `ready_for_submission` as registration → forbidden by status semantics and copy rules

---

## 40. This lock does not start

| Item | Status |
| --- | --- |
| 17D-8B2B implementation | NOT STARTED |
| Pack activation | NO |
| 17D-8B2C | NOT STARTED |
| 17D-8C | NOT STARTED |
| Phase 18 | NOT STARTED |
| HSI production | OFF / NOT READY |
| Marketplace | OFF |
| Existing Worker | STOPPED |
| Push | NO |
| Deploy | NO |
