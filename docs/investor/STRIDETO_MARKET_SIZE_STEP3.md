# STRIDETO Market Size — Step 3

## Corrected TAM / SAM / SOM Calculation

**STATUS: READY FOR INVESTOR SLIDE — BASE CASE WITH EIGHT-COUNTRY COVERAGE QUALIFIER**

This is a documentation and calculation correction only. It does not modify product code, pricing, payment, billing, database, staging, or production behavior. All monetary values are annual USD.

## 1. Executive conclusion

The prior report violated set logic because Base SAM included Pakistan and Singapore while Base TAM excluded both countries. SAM must be selected from the matching TAM scenario, and SOM must be selected from the matching SAM scenario.

The corrected model uses the existing Step 2 population universe and classifications:

- **Core SAM:** Pakistan, United States, United Kingdom, Canada, Australia, Singapore.
- **Expansion SAM:** UAE and Saudi Arabia.
- **Current calculable TAM coverage:** **EIGHT-COUNTRY VALIDATED / PROXY-VALIDATED FRAME**. This is not a fully exhaustive worldwide employer universe.

The principal investor headline is the Base case:

```text
VALIDATED MULTI-MARKET BOTTOM-UP TAM: $424.4M
CORE SAM: $383.5M
3-YEAR SOM: $21.3K annualized revenue from 531 paying organizations
```

## 2. Set definitions and invariants

**TAM** = all eligible employer organizations in the approved scenario's validated eight-country population universe.

**SAM** = the subset of that same scenario's TAM population in the selected Core SAM geographies that STRIDETO can realistically serve.

**SOM** = the subset of that scenario's SAM expected to become paying organizations within the defined three-year horizon.

Required invariant for every scenario:

```text
SOM organizations <= SAM organizations <= TAM organizations
SOM USD <= SAM USD <= TAM USD
```

No geographic universe is mixed between scenarios. The same country population is never counted twice through OECD plus national aggregation.

## 3. Immutable inputs and population universe

Step 1 and Step 2 are immutable inputs. Population values below are copied from Step 2; ARPAs are copied from Step 1.

| Country | Organizations | Step 2 treatment | Scenario use |
|---|---:|---|---|
| Pakistan | 7,142,941 | PBS establishments; PROXY, not unique employers | Upside TAM; Core SAM when present |
| United States | 5,934,950 | Census employer companies/firms; direct employer reference | All scenarios |
| United Kingdom | 1,417,730 | Private-sector employer businesses; direct employer reference | All scenarios |
| Canada | 1,197,980 | Active enterprises with one or more employees; direct employer-enterprise reference | All scenarios |
| UAE | 1,500,000 | Active and cancelled commercial licences; PROXY, not employer count | Upside TAM; Expansion SAM when present |
| Saudi Arabia | 1,019,000 | Active enterprises; partial employer-status reference / proxy treatment | Base TAM; Expansion SAM when present |
| Australia | 999,161 | Employing actively trading businesses; direct employer reference | All scenarios |
| Singapore | 345,100 | Revenue-or-employment enterprises; PROXY, not employer-only | Upside TAM; Core SAM when present |

Population totals by scenario:

| Scenario | TAM population rule | TAM organizations |
|---|---|---:|
| Conservative | Direct employer references: United States, United Kingdom, Canada, Australia | **9,549,821** |
| Base | Conservative population plus Saudi Arabia's accepted active-enterprise proxy | **10,568,821** |
| Upside | Base population plus Pakistan, UAE, and Singapore accepted broader proxies | **19,556,862** |

The Core SAM calculation is performed only against the countries present in the corresponding TAM scenario. Therefore, Base SAM cannot include Pakistan or Singapore because those populations are not present in Base TAM.

## 4. Canonical ARPA

| Scenario | Employer ARPA |
|---|---:|
| Conservative | **$26.51** |
| Base | **$40.16** |
| Upside | **$55.98** |

Provider ARPAs remain unchanged and are not part of Core TAM, Core SAM, or SOM.

## 5. Corrected TAM

Formula: `TAM organizations × corresponding employer ARPA`.

| Scenario | TAM organizations | ARPA | TAM USD |
|---|---:|---:|---:|
| Conservative | 9,549,821 | $26.51 | **$253,165,755** ($253.2M) |
| Base | 10,568,821 | $40.16 | **$424,443,851** ($424.4M) |
| Upside | 19,556,862 | $55.98 | **$1,094,793,135** ($1.095B) |

Base and Upside include the explicitly disclosed Step 2 proxy/partial populations. They are validated multi-market scenario totals, not exhaustive worldwide employer totals.

## 6. Corrected Core SAM

Core SAM remains Pakistan, United States, United Kingdom, Canada, Australia, and Singapore. UAE and Saudi Arabia remain Expansion SAM. A country is included only where it exists in the matching TAM scenario and retains that scenario's proxy treatment.

| Scenario | Core SAM population selected from matching TAM | SAM organizations | ARPA | SAM USD |
|---|---|---:|---:|---:|
| Conservative | United States + United Kingdom + Canada + Australia | **9,549,821** | $26.51 | **$253,165,755** ($253.2M) |
| Base | United States + United Kingdom + Canada + Australia | **9,549,821** | $40.16 | **$383,520,811** ($383.5M) |
| Upside | Pakistan + United States + United Kingdom + Canada + Australia + Singapore | **17,037,862** | $55.98 | **$953,779,515** ($953.8M) |

The Conservative SAM equals Conservative TAM because the Conservative TAM population currently consists only of the four direct-reference markets, all of which are in Core SAM. This is a property of the current calculable frame, not an artificial haircut. Base SAM is narrower than Base TAM because Saudi Arabia is Expansion SAM. Upside SAM is narrower than Upside TAM because UAE and Saudi Arabia are Expansion SAM.

## 7. Three-year SOM model

Horizon: **three years**. The assumptions below are management assumptions, not observed market facts.

Formula: `organizations reached × activation × free-to-paid conversion × retention`, rounded to whole paying organizations after calculation.

| Scenario | Organizations reached | Activation | Free-to-paid | Retention | Paying organizations |
|---|---:|---:|---:|---:|---:|
| Conservative | 10,000 | 20% | 2% | 80% | **32** |
| Base | 50,000 | 25% | 5% | 85% | **531** |
| Upside | 150,000 | 30% | 10% | 90% | **4,050** |

| Scenario | Paying organizations | ARPA | SOM USD | SOM as % of SAM | SOM as % of TAM |
|---|---:|---:|---:|---:|---:|
| Conservative | **32** | $26.51 | **$848** | **0.000335%** | **0.000335%** |
| Base | **531** | $40.16 | **$21,325** | **0.005560%** | **0.005024%** |
| Upside | **4,050** | $55.98 | **$226,719** | **0.023771%** | **0.020709%** |

SOM is deliberately capacity-led and remains small relative to SAM. It is not enlarged to produce a larger-looking revenue headline.

## 8. Sensitivity table and validation

| Scenario | TAM orgs | SAM orgs | SAM/TAM | TAM USD | SAM USD | SOM orgs | SOM/SAM | SOM/TAM | SOM USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Conservative | 9,549,821 | 9,549,821 | **100.000000%** | $253,165,755 | $253,165,755 | 32 | 0.000335% | 0.000335% | $848 |
| Base | 10,568,821 | 9,549,821 | **90.358433%** | $424,443,851 | $383,520,811 | 531 | 0.005560% | 0.005024% | $21,325 |
| Upside | 19,556,862 | 17,037,862 | **87.119610%** | $1,094,793,135 | $953,779,515 | 4,050 | 0.023771% | 0.020709% | $226,719 |

All scenarios satisfy `0% < SAM/TAM <= 100%`, `SOM organizations <= SAM organizations <= TAM organizations`, and `SOM USD <= SAM USD <= TAM USD`.

## 9. Provider opportunity

Provider segments are excluded from Core TAM and Core SAM.

### Education & Mobility

**NOT CALCULATED.** Step 2 does not provide a defensible numeric proxy for the approved provider organization population.

### Business / Professional Services

**OPTIONAL PROXY ONLY.** Step 2's 110 SECP registered-intermediary entries remain a lower-bound proxy and are not deduplicated into a complete unique-organization population. They remain excluded from TAM, SAM, SOM, and the investor headline. Provider ARPAs are unchanged from Step 1.

Institutions and individual users are excluded: institutions are free initially and individuals are free demand-side users. Secondary/upside revenue such as featured listings, commissions, leads, consultations, and advertising is excluded.

## 10. Geographic coverage and OECD decision

Investor-safe geographic wording:

> “Validated multi-market bottom-up TAM across an eight-country validated / proxy-validated frame: Pakistan, United States, United Kingdom, Canada, UAE, Saudi Arabia, Australia, and Singapore. This is the current calculable priority-market opportunity, not a fully exhaustive worldwide employer universe.”

The OECD/global framework supports broader international expansion, but Step 2 did not numerically transcribe the OECD cells. No OECD number is added here, and no OECD-plus-national overlap is implied.

**Recommendation: B.** The eight-country validated bottom-up TAM is sufficient for the investor slide when presented with the coverage qualifier above; show OECD/global expansion separately as context. OECD numeric extraction is not required for this limited, clearly labelled headline, but would be required before calling the result a fully global TAM.

## 11. Final controls

```text
SOM organizations <= SAM organizations <= TAM organizations = PASS
SOM USD <= SAM USD <= TAM USD = PASS
SAM/TAM is > 0% and <= 100% for all scenarios = PASS
Duplicate countries = NONE
OECD + national aggregation overlap = NONE; OECD numeric total excluded
Provider proxies inside Core TAM = NO
Institutions inside Core TAM = NO
Individual users inside Core TAM = NO
Secondary/upside revenue inside Core TAM = NO
Education & Mobility = NOT CALCULATED
Business Services = OPTIONAL PROXY ONLY
Step 1 changed = NO
Step 2 changed = NO
Product changes = NO
Payment changes = NO
Database changes = NO
Staging = NO
Commit = NO
Push = NO
Production auth requested = NO
Production API calls = 0
Production writes = 0
```

**STEP 3 STATUS: READY FOR INVESTOR SLIDE**
