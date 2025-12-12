# New York Medicaid Formulary - Feasibility Analysis

**Date**: 2025-12-12
**State**: New York (2nd largest Medicaid program)
**Source**: eMedNY (New York State Medicaid)

---

## Data Source

**URL**: https://docs.emedny.org/ReimbursableDrugs/MedReimbDrugsFormulary.csv

**Official Site**: https://www.emedny.org/info/formfile.aspx

**Update Frequency**: Daily (file timestamp in URL: `?12122025`)

---

## File Characteristics

| Attribute | Value |
|-----------|-------|
| **File Size** | 4.97 MB |
| **Format** | CSV (comma-delimited) |
| **Total Records** | 37,687 drugs |
| **Brand Drugs** | 4,620 (12.3%) |
| **Generic Drugs** | 21,114 (56.1%) |
| **Column Count** | 16 fields |
| **Encoding** | UTF-8 |
| **Header Row** | Yes (line 1) |

---

## Column Structure

| Index | Column Name | Example Value | Notes |
|-------|-------------|---------------|-------|
| 1 | TYPE | BND, GEN | Brand or Generic |
| 2 | NDC | 00169-4181-13 | 11-digit NDC code |
| 3 | MRA COST | 322.3760500 | **Maximum Reimbursable Amount** (dollars) |
| 4 | ALTERNATE COST | 0.6209100 | Secondary pricing tier |
| 5 | DESCRIPTION | OZEMPIC 0.25-0.5 MG/DOSE PEN | Product name |
| 6 | PA | G, 0 | Prior Authorization code |
| 7 | LABELER | NOVO NORDISK | Manufacturer |
| 8 | BASIS OF MRA | ML, EA | Pricing unit (per ML, per Each) |
| 9 | OTC IND | (blank) | Over-the-counter indicator |
| 10 | GENERIC NAME | SEMAGLUTIDE | Generic drug name |
| 11 | RX TYPE | 01 | Prescription type code |
| 12 | EFFECTIVE DATE | 12/12/2025 | Last updated date |
| 13 | MAXIMUM QUANTITIES | 9.000 | Quantity limits |
| 14 | PREFERRED DRUG CODE | Y, X | Preferred drug list status |
| 15 | AGE RANGE | 000-999 | Age eligibility range |
| 16 | REFILLS ALLOWED | 11 | Number of refills permitted |

---

## Key Data Features

### ✅ PRICING DATA INCLUDED (MAJOR ADVANTAGE!)

**MRA COST** (Maximum Reimbursable Amount):
- New York publishes **actual reimbursement rates** (not just tiers like California)
- Updated **DAILY** (most frequent of all 3 states!)
- Pricing by unit (ML, EA) similar to NADAC

**Example - Ozempic 1 mg/dose**:
- MRA Cost: **$322.34 per ML**
- Basis: ML (per milliliter)
- 3 mL pen = $322.34 × 3 = **$967.02 per pen**

**Comparison**:
- New York: $967.02 per pen (native pricing)
- California: $911.58 per pen (NADAC + $10.05 dispensing fee)
- Texas: $325.88 per pen (64% cheaper than NY!)

### Prior Authorization System

**PA Codes**:
- `G` = General PA required
- `0` = No PA required
- Other codes may exist (need full documentation)

**Ozempic PA Status**: `G` (PA required) - Similar to Texas, unlike California

### Preferred Drug List

**Codes**:
- `Y` = Preferred
- `X` = Non-preferred but covered
- Blank = Unknown status

**Ozempic Status**: `Y` (Preferred) - Despite requiring PA

---

## Implementation Difficulty: ⭐⭐⭐⭐⭐ (EASIEST YET!)

### Why 5 Stars (Easiest Implementation):

1. **Clean CSV Format**
   - Standard comma-delimited (no special parsing needed)
   - Clear column headers
   - No newlines in headers (unlike California Excel)
   - No complex delimiters (unlike Texas pipes)

2. **Native Pricing Included**
   - MRA Cost = actual reimbursement rate
   - No need for NADAC integration (unlike California)
   - Already in dollars per unit
   - Most transparent pricing of all 3 states

3. **Rich Metadata**
   - Manufacturer names
   - Quantity limits
   - Age restrictions
   - Refill policies
   - Preferred status

4. **Daily Updates**
   - More current than CA (monthly) or TX (weekly)
   - Date-stamped in URL for tracking

5. **Moderate Size**
   - 4.97 MB (manageable like CA and TX)
   - 37,687 records (larger dataset = better coverage)

### Comparison to Other States:

| State | Format | Difficulty | Pricing Data | Updates | Parser Needed |
|-------|--------|-----------|--------------|---------|---------------|
| California | Excel | ⭐⭐⭐⭐ | NO (need NADAC) | Monthly | xlsx + array indexing |
| Texas | Pipe-delimited | ⭐⭐⭐⭐ | YES (native) | Weekly | Custom split parser |
| **New York** | **CSV** | **⭐⭐⭐⭐⭐** | **YES (native)** | **Daily** | **Standard CSV** |

---

## Coverage Impact

**New York Medicaid Stats**:
- **Enrollees**: ~6.5 million (2nd largest state program)
- **% of US Medicaid**: ~9% of all beneficiaries
- **Annual Spending**: $82 billion (2nd highest)

**Combined Coverage with CA + TX**:
- California: 15M (20%)
- Texas: 4.4M (6%)
- New York: 6.5M (9%)
- **TOTAL**: 25.9M beneficiaries = **35% of all US Medicaid**

---

## Sample Data - Ozempic Pricing

```csv
TYPE, NDC, MRA COST, ALTERNATE COST, DESCRIPTION, PA, LABELER, BASIS OF MRA, OTC IND, GENERIC NAME, RX TYPE, EFFECTIVE DATE, MAXIMUM QUANTITIES, PREFERRED DRUG CODE, AGE RANGE, REFILLS ALLOWED
BND,00169-4181-13,322.3760500,,OZEMPIC 0.25-0.5 MG/DOSE PEN,G,NOVO NORDISK,ML,,SEMAGLUTIDE,01,12/12/2025,9.000,Y,000-999,11
BND,00169-4130-01,322.3348600,,OZEMPIC 1 MG/DOSE (4 MG/3 ML),G,NOVO NORDISK,ML,,SEMAGLUTIDE,01,12/12/2025,9.000,Y,000-999,11
BND,00169-4130-13,322.3348600,,OZEMPIC 1 MG/DOSE (4 MG/3 ML),G,NOVO NORDISK,ML,,SEMAGLUTIDE,01,12/12/2025,9.000,Y,000-999,11
```

**Analysis**:
- MRA Cost: $322.34 per ML
- Maximum Quantity: 9.0 ML per prescription
- PA Required: Yes (code `G`)
- Preferred Status: Yes (code `Y`)
- Age Range: All ages (000-999)
- Refills: 11 allowed

---

## Implementation Recommendations

### ✅ PROCEED WITH IMPLEMENTATION

**Rationale**:
1. Clean CSV format = minimal code complexity
2. Native pricing = no external data source needed
3. Daily updates = most current data
4. Large coverage = 9% of US Medicaid
5. Rich metadata = valuable clinical/policy insights

### Implementation Steps:

1. **Add NY dataset to datasets.js**:
```javascript
NEW_YORK_MEDICAID_FORMULARY: {
  id: 'ny-medicaid-formulary',
  state: 'NY',
  downloadUrl: 'https://docs.emedny.org/ReimbursableDrugs/MedReimbDrugsFormulary.csv',
  name: 'New York Medicaid Pharmacy List of Reimbursable Drugs',
  category: 'formulary',
  update_frequency: 'daily',
  description: 'New York Medicaid formulary with NDC codes, MRA pricing, PA requirements, and quantity limits (covers 6.5M beneficiaries - 9% of all Medicaid)',
  cacheTime: 24 * 60 * 60 * 1000,  // 24 hours (daily updates)
  estimatedSize: '4.97 MB',
  estimatedRecords: '37,687',
  accessMethod: 'csv'
}
```

2. **Create CSV parser (csv-parser.js)** - use standard CSV library
3. **Add NY support to searchStateFormulary()** - same pattern as CA/TX
4. **Create test file** - compare NY vs CA vs TX for Ozempic
5. **Update README.md** - add NY to coverage table

### Unified Method Extension:

```javascript
// searchStateFormulary() will support:
searchStateFormulary({
  state: 'NY',
  generic_name: 'semaglutide',
  requires_pa: true,
  preferred: true,
  limit: 10
})
```

**No NADAC integration needed** - NY has native pricing!

---

## Expected Benefits

1. **Price Transparency Comparison**:
   - Compare NY (MRA) vs CA (NADAC) vs TX (retail/340B)
   - Identify state pricing disparities
   - Understand reimbursement methodologies

2. **Access Comparison**:
   - NY: PA required + preferred
   - CA: No PA + brand tier
   - TX: Clinical PA + active

3. **Market Intelligence**:
   - 35% US Medicaid coverage with 3 states
   - Top 3 states by enrollment and spending
   - Representative policies (restrictive NY/TX vs permissive CA)

---

## Conclusion

**Rating**: ⭐⭐⭐⭐⭐ (5/5 stars - EASIEST IMPLEMENTATION)

**Recommendation**: **IMPLEMENT IMMEDIATELY**

New York Medicaid formulary is the cleanest data source of the three states analyzed:
- Standard CSV (no complex parsing)
- Native pricing (no external integration)
- Daily updates (most current)
- Rich metadata (16 fields)
- Large coverage (6.5M beneficiaries)

This will bring total coverage to **35% of US Medicaid** with the top 3 states by enrollment and spending.
