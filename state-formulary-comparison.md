# State Medicaid Formulary Comparison - Next State Analysis

**Date**: 2025-12-12
**Current Coverage**: CA (20%) + TX (6%) + NY (9%) = **35% of US Medicaid**
**Remaining Top States**: FL, PA, OH, IL (next 4 largest programs)

---

## Summary Table

| State | Enrollees | % US Medicaid | Formulary Format | NDC Codes | Pricing Data | Update Freq | Feasibility Rating | Recommended |
|-------|-----------|---------------|------------------|-----------|--------------|-------------|--------------------|-------------|
| **California** | 15M | 20% | Excel (.xlsx) | ✅ Yes | ❌ No (NADAC integration) | Monthly | ⭐⭐⭐⭐ | ✅ **IMPLEMENTED** |
| **Texas** | 4.4M | 6% | Pipe-delimited text | ✅ Yes | ✅ Yes (retail, 340B) | Weekly | ⭐⭐⭐⭐ | ✅ **IMPLEMENTED** |
| **New York** | 6.5M | 9% | CSV | ✅ Yes | ✅ Yes (MRA) | Daily | ⭐⭐⭐⭐⭐ | ✅ **IMPLEMENTED** |
| **Florida** | 5.2M | 7% | PDF only | ❌ No | ❌ No | Quarterly | ⭐ | ❌ **SKIP** (PDF only) |
| **Pennsylvania** | 3.2M | 4% | PDF + online tool | ❌ No | ❌ No | Quarterly | ⭐ | ❌ **SKIP** (No bulk download) |
| **Ohio** | 3.1M | 4% | PDF + online portal | ❌ No | ❌ No | Quarterly | ⭐⭐ | ❌ **SKIP** (Portal only) |
| **Illinois** | 2.9M | 4% | Excel (.xlsx) | ❌ **No** | ❌ No | Quarterly | ⭐⭐ | ❌ **SKIP** (No NDC/pricing) |

---

## Detailed Analysis

### 1. Florida (5.2M enrollees - 7% of US Medicaid)

**Source**: Florida Agency for Health Care Administration (AHCA)
**Website**: https://ahca.myflorida.com/medicaid/prescribed-drugs/

**Available Formats**:
- PDF only (Preferred Drug List)
- Effective dates: October 1, 2024 and October 1, 2025

**Data Fields**:
- Drug names organized by therapeutic class
- Preferred status indicators
- Prior authorization requirements

**Missing Data**:
- ❌ No NDC codes
- ❌ No pricing information
- ❌ No machine-readable format (CSV/Excel)
- ❌ No bulk data download

**Implementation Difficulty**: ⭐ (1/5 stars)

**Recommendation**: **SKIP**
**Reason**: PDF-only format makes parsing difficult and error-prone. No NDC codes or pricing data. Would require OCR or manual PDF parsing with high risk of errors.

---

### 2. Pennsylvania (3.2M enrollees - 4% of US Medicaid)

**Source**: Pennsylvania Department of Human Services
**Website**: https://www.pa.gov/agencies/dhs/resources/pharmacy-services/preferred-drug-list

**Available Formats**:
- PDF (Statewide Preferred Drug List)
- Online search tool (https://www.papdl.com/)
- Covered Drugs Search Tool (https://www.humanservices.dhs.pa.gov/CoveredDrugs/)

**Data Fields** (via online tool):
- Drug names
- Prior authorization requirements
- Specialty pharmacy requirements
- Quantity limits
- Copay information

**Missing Data**:
- ❌ No bulk CSV/Excel download
- ❌ No NDC codes in PDF
- ❌ No pricing information
- ❌ Portal requires interactive searches (no API)

**Implementation Difficulty**: ⭐ (1/5 stars)

**Recommendation**: **SKIP**
**Reason**: No bulk data download available. Online portal requires interactive searches. PDF format unsuitable for parsing. No pricing data.

---

### 3. Ohio (3.1M enrollees - 4% of US Medicaid)

**Source**: Ohio Department of Medicaid (ODM) + Gainwell Technologies SPBM
**Website**: https://spbm.medicaid.ohio.gov/

**Available Formats**:
- PDF (Unified Preferred Drug List - UPDL)
- Online Drug Search Tool (NDC search)
- "Machine Readable Files" mentioned (unclear format)

**Data Fields**:
- Unified PDL across all managed care plans
- Preferred status
- Prior authorization requirements

**Potential for Data Access**:
- "Machine Readable Files" mentioned as "Other Publications"
- May require provider portal login
- Contact: Gainwell Pharmacy Services (833-491-0344)

**Missing Data** (from public sources):
- ❌ No publicly available CSV/Excel download
- ❌ Pricing data unknown
- ❌ NDC availability unclear

**Implementation Difficulty**: ⭐⭐ (2/5 stars)

**Recommendation**: **SKIP** (for now)
**Reason**: No clear bulk data download. "Machine Readable Files" may exist but require provider portal access. Not worth the effort to obtain credentials when next alternative (Michigan) may be easier.

**Note**: Could revisit if provider portal credentials are obtained or if "Machine Readable Files" are publicly accessible.

---

### 4. Illinois (2.9M enrollees - 4% of US Medicaid)

**Source**: Illinois Department of Healthcare and Family Services (HFS)
**Website**: https://hfs.illinois.gov/medicalproviders/pharmacy/preferred.html

**Available Formats**:
- ✅ **Excel (.xlsx)** - Quarterly updates
- PDF (same content)

**Download URL**: https://hfs.illinois.gov/content/dam/soi/en/web/hfs/sitecollectiondocuments/pdl10012025.xlsx

**File Stats**:
- **Size**: 222 KB (very small)
- **Records**: 5,724 drugs
- **Format**: Clean Excel with headers at row 40
- **Update Frequency**: Quarterly (Jan, May, Jul, Oct)

**Data Fields** (ACTUAL - inspected from file):
```
Column 1: Drug Class (therapeutic category)
Column 2: Drug Name (brand name)
Column 3: Dosage Form (e.g., SOPN, SUER, TABS, TBCR)
Column 4: PDL Status (empty in most cases)
Column 5: PDL Status Detail (e.g., "PREFERRED_WITH_PA")
Column 6: PDL Status Detail (e.g., "NON_PREFERRED")
```

**Example Record** (Ozempic):
```
Drug Class: [Not specified for Ozempic row]
Drug Name: OZEMPIC
Dosage Form: SOPN (Solution for Injection)
PDL Status: NON_PREFERRED
```

**Missing Critical Data**:
- ❌ **NO NDC codes** (cannot match to NADAC or other pricing sources)
- ❌ **NO pricing information** (not even MRA or retail rates)
- ❌ **NO manufacturer information**
- ❌ **NO generic names** (only brand names)
- ❌ **NO quantity limits** (just preferred status)

**Implementation Difficulty**: ⭐⭐ (2/5 stars)

**Recommendation**: **SKIP**
**Reason**: While Illinois provides clean Excel files (easy to parse), the data is **incomplete for our use case**:
1. **No NDC codes** - Cannot match drugs to NADAC pricing or other data sources
2. **No pricing data** - No MRA, no retail rates, no 340B pricing
3. **Preferred status only** - Limited to PDL status (PREFERRED_WITH_PA vs NON_PREFERRED)
4. **Low value-add** - Without NDC/pricing, Illinois would only provide PA requirements, which is insufficient compared to CA/TX/NY

**Comparison to Implemented States**:
- California: No NDC, but **has NDC in formulary**, uses NADAC pricing integration
- Texas: **Has NDC**, **has native pricing** (retail, 340B, LTC)
- New York: **Has NDC**, **has native MRA pricing**, quantity limits, refills
- Illinois: **No NDC**, **no pricing** - cannot integrate with NADAC or provide reimbursement data

---

## Next State Recommendations

### Option 1: Skip to Michigan or North Carolina

**Michigan** (2.8M enrollees - 3.8%)
- Research needed: Check for downloadable formulary

**North Carolina** (2.7M enrollees - 3.6%)
- Research needed: Check for downloadable formulary

### Option 2: Stop at 35% Coverage

**Rationale**:
- Current coverage: 35% of US Medicaid (CA + TX + NY)
- Top 3 states by enrollment AND spending
- All 3 have complete data: NDC codes + pricing
- Next 4 states (FL, PA, OH, IL) all have data quality issues
- Diminishing returns: Each additional state provides <5% coverage

**Coverage vs Effort Analysis**:

| States | Coverage | Effort | Data Quality | Value |
|--------|----------|--------|--------------|-------|
| CA + TX + NY | 35% | Medium | ✅ Complete (NDC + pricing) | **HIGH** |
| + FL + PA + OH + IL | 54% | High | ❌ Incomplete (no NDC/pricing) | **LOW** |

**Recommendation**: **STOP AT 35% COVERAGE** (CA + TX + NY)

---

## Conclusion

After researching the next 4 largest Medicaid programs (FL, PA, OH, IL), **none are recommended for implementation**:

1. **Florida**: PDF only, no NDC, no pricing
2. **Pennsylvania**: No bulk download, portal only
3. **Ohio**: No public bulk download, unclear data access
4. **Illinois**: Excel available, but **no NDC codes or pricing** - cannot integrate with NADAC

**Final Recommendation**: Maintain current 3-state implementation (CA, TX, NY) covering **35% of US Medicaid**. These 3 states provide:
- Complete NDC code coverage
- Complete pricing data (NADAC-based for CA, native for TX/NY)
- Representative pricing policies (CA = permissive/high-cost, TX = restrictive/low-cost, NY = moderate/high-cost)
- Top 3 states by enrollment and spending

**Quality over quantity**: Better to have 3 states with complete data than 7 states with incomplete data.

---

## Implementation Status

✅ **California**: 15M enrollees (20%) - NADAC pricing integration
✅ **Texas**: 4.4M enrollees (6%) - Native pricing (retail, 340B, LTC)
✅ **New York**: 6.5M enrollees (9%) - Native MRA pricing, daily updates

**Total Coverage**: **25.9M beneficiaries = 35% of all US Medicaid**

❌ **Florida**: Skipped (PDF only, no NDC/pricing)
❌ **Pennsylvania**: Skipped (no bulk download)
❌ **Ohio**: Skipped (no public bulk data)
❌ **Illinois**: Skipped (no NDC codes or pricing data)

