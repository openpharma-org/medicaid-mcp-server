# Illinois Medicaid Formulary - Data Enrichment Strategy

**Date**: 2025-12-12
**Status**: FEASIBLE with National Data Enrichment
**Updated Recommendation**: IMPLEMENT with enrichment approach

---

## Problem Identified

The Illinois Medicaid PDL Excel file (5,724 drugs, quarterly updates) contains:
- ✅ Drug names (brand names)
- ✅ Dosage forms
- ✅ PDL status (PREFERRED_WITH_PA, NON_PREFERRED)
- ❌ **NO NDC codes**
- ❌ **NO pricing data**
- ❌ **NO generic names**

**Initial Assessment**: Rejected due to inability to match drugs to NADAC pricing or other data sources.

---

## Discovery: National Data Sources Available

### 1. State Drug Utilization Data (data.medicaid.gov)

**Source**: CMS Medicaid Drug Rebate Program
**Dataset**: State Drug Utilization Data (SDUD)
**Update Frequency**: Quarterly
**Coverage**: ALL states including Illinois

**Available Data**:
- ✅ **NDC codes** (11-digit National Drug Code)
- ✅ **State** (Illinois = "IL")
- ✅ **Drug name** (Labeler Name)
- ✅ **Number of prescriptions** (utilization)
- ✅ **Total reimbursement** (dollars paid by Illinois Medicaid)
- ✅ **Units reimbursed**
- ✅ **Quarterly data** (2001-2024)

**Dataset URLs**:
- 2024: https://data.medicaid.gov/dataset/61729e5a-7aa8-448c-8903-ba3e0cd0ea3c
- 2023: https://data.medicaid.gov/dataset/d890d3a9-6b00-43fd-8b31-fcba4c8e2909
- 2022: https://data.medicaid.gov/dataset/200c2cba-e58d-4a95-aa60-14b99736808d

**Already Implemented**: YES - Our Medicaid MCP server already implements DKAN API queries for State Drug Utilization Data!

**Relevant Code**:
- Method: `get_state_drug_utilization` in `src/medicaid-api.js`
- Access: DKAN API (no large downloads needed)
- Filter: By state ("IL"), drug name, year, quarter

### 2. NADAC Pricing Database

**Source**: CMS National Average Drug Acquisition Cost
**Dataset**: NADAC (Weekly Updates)
**Coverage**: ALL drugs reimbursed by Medicaid

**Available Data**:
- ✅ **NDC codes**
- ✅ **NADAC per unit** (pricing)
- ✅ **Pricing unit** (EA, ML, GM)
- ✅ **Generic name**
- ✅ **Effective date**

**Already Implemented**: YES - Our Medicaid MCP server already has NADAC pricing!

**Relevant Code**:
- Method: `get_nadac_pricing` in `src/medicaid-api.js`
- Access: CSV download + cache (123 MB, 1.5M records)
- Match: By NDC code

---

## Enrichment Strategy

### Step 1: Base Data (Illinois PDL)
**Source**: Illinois HFS PDL Excel file
**Data**: Drug names, dosage forms, PDL status (preferred, PA requirements)

### Step 2: NDC Code Mapping (SDUD)
**Source**: State Drug Utilization Data (Illinois filtered)
**Process**:
1. Query SDUD for Illinois (state = "IL")
2. Get latest quarter (2024 Q3 or Q4)
3. Match drug names from PDL → NDC codes from SDUD
4. Store NDC mapping for Illinois drugs

**Match Quality**:
- High confidence: Exact drug name match (e.g., "OZEMPIC" in both PDL and SDUD)
- Medium confidence: Partial match with dosage form validation
- Low confidence: Generic name match (if available)

### Step 3: Pricing Enrichment (NADAC)
**Source**: NADAC pricing database
**Process**:
1. Use NDC codes from Step 2
2. Query NADAC database by NDC
3. Get NADAC per unit pricing
4. Calculate Illinois estimated reimbursement (NADAC × package size + dispensing fee)

**Dispensing Fee**: $12.12 (Illinois Medicaid dispensing fee as of 2024)

### Step 4: Data Assembly
**Final Result**: Illinois formulary with complete data
- Drug name (from IL PDL)
- NDC code (from SDUD)
- Generic name (from NADAC)
- Dosage form (from IL PDL)
- PDL status (from IL PDL)
- PA requirements (from IL PDL)
- NADAC pricing (from NADAC)
- Estimated reimbursement (calculated)
- Utilization data (from SDUD) - OPTIONAL

---

## Implementation Architecture

### Option A: Real-Time Enrichment (Recommended)
**Pattern**: Similar to California (NADAC integration)

**Process**:
1. Load Illinois PDL (5,724 drugs, 222 KB) → Cache
2. On query: Filter PDL → Extract drug names
3. For each result: Query SDUD for NDC code (in-memory cache or API)
4. For each NDC: Query NADAC for pricing (already cached)
5. Return enriched results

**Performance**:
- First query: 2-3 seconds (PDL load + SDUD query + NADAC lookup)
- Subsequent queries: <200ms (all cached)

**Memory**:
- Illinois PDL: ~1 MB cached
- SDUD Illinois subset: ~10-20 MB (estimated 50K records × quarter)
- NADAC: ~200 MB (already cached)
- **Total**: ~220 MB (acceptable)

### Option B: Pre-Computed Enrichment
**Pattern**: Build enriched dataset on server startup

**Process**:
1. Load Illinois PDL (5,724 drugs)
2. Load SDUD Illinois latest quarter (~50K records)
3. Load NADAC (1.5M records)
4. Match PDL → SDUD → NADAC (one-time computation)
5. Cache enriched dataset (5,724 records with NDC + pricing)

**Performance**:
- First query: <100ms (pre-computed)
- Startup time: 30-60 seconds (one-time enrichment)

**Memory**:
- Enriched Illinois dataset: ~2-5 MB (5,724 records × rich fields)
- NADAC: ~200 MB (already loaded)
- **Total**: ~205 MB

---

## Data Quality Assessment

### Before Enrichment
- ❌ No NDC codes
- ❌ No pricing data
- ❌ Limited to PDL status only
- **Value**: LOW

### After Enrichment
- ✅ NDC codes (from SDUD)
- ✅ NADAC pricing (from NADAC)
- ✅ Generic names (from NADAC)
- ✅ PDL status (from IL PDL)
- ✅ PA requirements (from IL PDL)
- ✅ Utilization data (from SDUD) - OPTIONAL
- **Value**: HIGH

### Match Rate Estimation
**Conservative**: 70-80% of PDL drugs will match to SDUD NDC codes
**Optimistic**: 85-95% match rate (brand names are consistent)

**Reasoning**:
- SDUD contains ALL drugs reimbursed by Illinois Medicaid
- PDL contains drugs covered by Illinois Medicaid
- High overlap expected (PDL is subset of SDUD)
- Drug name matching is reliable for brand names (e.g., "OZEMPIC", "HUMIRA")

---

## Comparison to Implemented States

| Feature | California | Texas | New York | **Illinois (Enriched)** |
|---------|------------|-------|----------|-------------------------|
| **NDC Codes** | ✅ Native | ✅ Native | ✅ Native | ✅ **From SDUD** |
| **Pricing** | ✅ NADAC integration | ✅ State rates | ✅ MRA | ✅ **NADAC** |
| **PA Requirements** | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| **Update Frequency** | Monthly | Weekly | Daily | Quarterly (PDL), Weekly (NADAC) |
| **Beneficiaries** | 15M (20%) | 4.4M (6%) | 6.5M (9%) | **2.9M (4%)** |
| **Data Quality** | High | High | High | **Medium-High** |
| **Implementation** | Native + NADAC | Native | Native | **Enriched** |

**Quality Trade-off**:
- Illinois: Indirect NDC mapping (SDUD) vs direct (CA/TX/NY have NDC in formulary)
- Illinois: Match rate 70-95% vs 100% (some PDL drugs may not match SDUD)
- Illinois: Quarterly PDL updates vs Daily (NY), Weekly (TX), Monthly (CA)

**Value Proposition**:
- Adds 4% US Medicaid coverage (2.9M beneficiaries)
- Demonstrates enrichment approach (pattern for other states)
- Total coverage: **39% of US Medicaid** (CA + TX + NY + IL = 28.8M)

---

## Updated Recommendation

### IMPLEMENT Illinois with Enrichment Approach

**Reasoning**:
1. **Feasible**: National SDUD data provides NDC codes for Illinois drugs
2. **Already have tools**: SDUD and NADAC already implemented in our MCP server
3. **Valuable pattern**: Enrichment approach can be applied to other states (PA, OH, etc.)
4. **Coverage boost**: 2.9M beneficiaries (4% → total coverage 39%)
5. **Data quality**: Medium-high after enrichment (NDC + pricing via SDUD → NADAC)

**Risks**:
- Match rate uncertainty (70-95% estimated)
- Indirect NDC mapping may miss some drugs
- Quarterly PDL updates (less frequent than CA/TX/NY)

**Mitigation**:
- Start with conservative 70% match rate assumption
- Validate match quality with test queries (e.g., Ozempic, Humira)
- Document unmatched drugs and provide feedback to Illinois HFS
- Consider quarterly SDUD refresh to maintain NDC mapping accuracy

---

## Implementation Plan

### Phase 1: Prototype & Validation (2-3 hours)
1. Load Illinois PDL Excel file
2. Query SDUD for Illinois (state = "IL", latest quarter)
3. Match PDL drug names → SDUD NDC codes (test with Ozempic, Humira, Insulin)
4. Query NADAC for matched NDC codes
5. Calculate match rate and data quality metrics

### Phase 2: Integration (3-4 hours)
1. Add Illinois dataset configuration to `src/datasets.js`
2. Create `enrichIllinoisFormulary()` function in `src/medicaid-api.js`
3. Implement drug name → NDC matching logic
4. Implement NADAC pricing integration
5. Add `searchIllinoisFormulary()` function with enrichment

### Phase 3: Testing & Documentation (2-3 hours)
1. Create `test-il-formulary.js` test suite
2. Test queries: Ozempic, GLP-1s, insulin, statins
3. Validate match rates and pricing accuracy
4. Update README.md with Illinois coverage
5. Document enrichment approach for future state implementations

**Total Effort**: 7-10 hours (vs 3-4 hours for native implementation)

**Trade-off**: 2x implementation effort for 4% coverage boost + reusable enrichment pattern

---

## Alternative: Stop at 35% Coverage (Rejected)

**Initial Recommendation**: Stop at CA + TX + NY (35% coverage)

**Why Rejected**:
- Illinois data CAN be enriched with national sources
- Enrichment approach is reusable for other states (PA, OH, MI, NC)
- 4% coverage boost is non-trivial (2.9M beneficiaries)
- Demonstrates MCP server's data integration capabilities

**Revised Strategy**: Implement Illinois as proof-of-concept for enrichment approach

---

## Next States After Illinois

If Illinois enrichment succeeds, the same approach can be applied to:

### Pennsylvania (3.2M - 4%)
- **PDL**: PDF or portal (need to investigate Excel/CSV availability)
- **NDC**: From SDUD (same approach as Illinois)
- **Pricing**: From NADAC (same approach as Illinois)
- **Estimated Match Rate**: 70-85%

### Ohio (3.1M - 4%)
- **PDL**: Portal + "Machine Readable Files" (need provider credentials)
- **NDC**: From SDUD (if PDL has drug names)
- **Pricing**: From NADAC
- **Estimated Match Rate**: 70-85%

### Michigan (2.8M - 3.8%)
- **PDL**: Need to research
- **NDC**: From SDUD
- **Pricing**: From NADAC
- **Estimated Match Rate**: 70-85%

**Potential Total Coverage**: CA + TX + NY + IL + PA + OH + MI = **47-50% of US Medicaid**

---

## Conclusion

**Illinois implementation is FEASIBLE and RECOMMENDED** using national data enrichment:

1. ✅ Illinois PDL provides drug names and PA requirements
2. ✅ State Drug Utilization Data provides NDC codes for Illinois drugs
3. ✅ NADAC database provides pricing for all NDC codes
4. ✅ Both SDUD and NADAC already implemented in our MCP server
5. ✅ Enrichment approach is reusable for other states

**Updated Coverage Projection**:
- Current: CA + TX + NY = 35% (25.9M beneficiaries)
- With Illinois: CA + TX + NY + IL = **39% (28.8M beneficiaries)**
- With enrichment pattern: Potential to reach **47-50% coverage** (7 states)

**Quality vs Quantity**:
- Direct implementation (CA, TX, NY): 35% coverage, 100% data quality
- Enriched implementation (+ IL): 39% coverage, 85% avg data quality
- **Optimal**: Both approaches (native where possible, enriched where needed)

---

## Action Items

1. ✅ Research Illinois data sources (COMPLETED)
2. ✅ Identify enrichment strategy (COMPLETED)
3. ⏭️ Prototype Illinois enrichment (NEXT STEP)
4. ⏭️ Validate match rates and data quality
5. ⏭️ Full implementation if prototype succeeds
6. ⏭️ Document enrichment pattern for future states
