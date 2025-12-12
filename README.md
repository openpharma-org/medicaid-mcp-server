# Medicaid MCP Server

Model Context Protocol (MCP) server for Medicaid public data access via data.medicaid.gov.

## Architecture: Hybrid CSV + DKAN API

**Background**: CMS migrated from Socrata SODA API to DKAN platform. DKAN provides both CSV downloads and a query API.

**Strategy**:
- **Small datasets (<50 MB)**: CSV download + in-memory cache (NADAC, Enrollment)
- **Large datasets (>100 MB)**: DKAN API queries (Drug Rebate, Drug Utilization, Federal Upper Limits)

**How it works (CSV mode)**:
1. **First query**: Downloads CSV → Parses → Caches → Filters → Returns results
2. **Subsequent queries**: Filters cached data → Returns results (<100ms)

**How it works (DKAN API mode)**:
1. **Every query**: Fetches 100-5000 records via API → Client-side filters → Returns results (1-2s)
2. **No large downloads**, **no memory issues**, **works regardless of file growth**

### Performance

**CSV-cached datasets**:
| Dataset | Size | Records | First Query | Subsequent Queries | Memory |
|---------|------|---------|-------------|-------------------|--------|
| NADAC | 123 MB | 1.5M | 20-30s | <100ms | ~200 MB |
| Enrollment | 3.6 MB | 10K | 1-2s | <50ms | ~5 MB |

**DKAN API datasets**:
| Dataset | Size | Records | All Queries | Memory |
|---------|------|---------|-------------|--------|
| Federal Upper Limits | 196 MB | 2.1M | 1-2s | ~5 MB |
| Drug Rebate | 291 MB | ~3M+ | 1-2s | ~5 MB |
| Drug Utilization | 192 MB | 5.3M | 1-2s | ~5 MB |

**Cache TTL**: 24 hours for NADAC (weekly updates), 7 days for enrollment (monthly updates)

**Total Memory**: ~210 MB (CSV datasets only, DKAN API uses minimal memory)

## Installation

```bash
cd /Users/joan.saez-pons/code/medicaid-mcp-server
npm install
```

## Usage

### As MCP Server

Configure in Claude Code or other MCP clients:

```json
{
  "mcpServers": {
    "medicaid-mcp": {
      "command": "node",
      "args": ["/Users/joan.saez-pons/code/medicaid-mcp-server/src/index.js"]
    }
  }
}
```

### Via Python (in agentic-os)

```python
from mcp.servers.medicaid_mcp import medicaid_info

# Get NADAC pricing for ibuprofen
result = medicaid_info(
    method='get_nadac_pricing',
    drug_name='ibuprofen',
    limit=10
)

# Get California enrollment trends
result = medicaid_info(
    method='get_enrollment_trends',
    state='CA',
    start_date='2023-01-01',
    end_date='2024-12-31'
)
```

## Available Methods

### Phase 1 (Implemented & Tested ✓)

1. **get_nadac_pricing** - Drug pricing lookup by NDC or name
   ```javascript
   {
     "method": "get_nadac_pricing",
     "drug_name": "ibuprofen",
     "limit": 10
   }
   ```

2. **compare_drug_pricing** - Multi-drug or temporal comparison
   ```javascript
   {
     "method": "compare_drug_pricing",
     "ndc_codes": ["00904530909"],
     "start_date": "2023-01-01",
     "end_date": "2024-12-31"
   }
   ```

3. **get_enrollment_trends** - State enrollment over time
   ```javascript
   {
     "method": "get_enrollment_trends",
     "state": "CA",
     "start_date": "2023-01-01",
     "end_date": "2024-12-31"
   }
   ```

4. **compare_state_enrollment** - Multi-state comparison
   ```javascript
   {
     "method": "compare_state_enrollment",
     "states": ["CA", "TX", "NY", "FL"],
     "month": "2024-09"
   }
   ```

5. **list_available_datasets** - Show available datasets
   ```javascript
   {
     "method": "list_available_datasets"
   }
   ```

6. **search_datasets** - Generic dataset search
   ```javascript
   {
     "method": "search_datasets",
     "dataset_id": "nadac",
     "drug_name": "ibuprofen"
   }
   ```

### Phase 2 & 3 (Implemented ✓)

7. **get_federal_upper_limits** - FUL pricing lookup (DKAN API)
   ```javascript
   {
     "method": "get_federal_upper_limits",
     "ingredient": "NYSTATIN",
     "limit": 10
   }
   ```

8. **get_drug_rebate_info** - Rebate program data (DKAN API)
   ```javascript
   {
     "method": "get_drug_rebate_info",
     "ndc": "00002143380",
     "limit": 10
   }
   ```

9. **get_state_drug_utilization** - Utilization by state (DKAN API)
   ```javascript
   {
     "method": "get_state_drug_utilization",
     "state": "CA",
     "drug_name": "OZEMPIC",
     "year": 2024,
     "quarter": 4,
     "limit": 10
   }
   ```

10. **search_state_formulary** - Unified state formulary search (CA, TX)
    ```javascript
    {
      "method": "search_state_formulary",
      "state": "CA",  // or "TX"
      "generic_name": "semaglutide",
      "requires_pa": false,
      "limit": 10
    }
    ```

    **California-specific parameters**:
    - `tier` - Cost ceiling tier ("Brand" or "Generic")
    - `extended_duration` - Extended duration eligibility (true/false)

    **Texas-specific parameters**:
    - `pdl_pa` - PDL prior authorization (true/false)
    - `clinical_pa` - Clinical prior authorization (true/false)
    - `program` - Program filter ("medicaid", "chip", "cshcn", "khc", "htw", "htwplus")
    - `max_price` - Maximum retail price
    - `min_price` - Minimum retail price

11. **search_california_formulary** - California formulary (backward compatibility)
    ```javascript
    {
      "method": "search_california_formulary",
      "generic_name": "semaglutide",
      "requires_pa": false,
      "tier": "Brand",
      "limit": 10
    }
    ```
    **Note**: Deprecated - Use `search_state_formulary` with `state: "CA"` instead

## Data Sources

| Dataset | Update Frequency | Size | Records | Access Method | Status |
|---------|-----------------|------|---------|---------------|--------|
| NADAC (drug pricing) | Weekly | 123 MB | 1.5M | CSV + cache | ✓ Available |
| Enrollment snapshot | Monthly | 3.6 MB | 10K | CSV + cache | ✓ Available |
| Federal upper limits | Monthly | 196 MB | 2.1M | DKAN API | ✓ Available |
| Drug rebate program | Quarterly | 291 MB | ~3M | DKAN API | ✓ Available |
| Drug utilization | Quarterly | 192 MB | 5.3M | DKAN API | ✓ Available |
| **California Medicaid formulary** | **Monthly** | **1.7 MB** | **40K** | **Excel + cache** | **✓ Available** |
| **Texas Medicaid formulary** | **Weekly** | **1.63 MB** | **4.7K** | **Text + cache** | **✓ Available** |

**Architecture**: Hybrid approach - CSV/Excel/Text for small datasets (<50 MB), DKAN API for large datasets (>100 MB). This avoids memory issues while maintaining fast queries.

**Coverage**: California (15M beneficiaries - 20% of US Medicaid) + Texas (4.4M beneficiaries - 6% of US Medicaid) = **27% of all US Medicaid beneficiaries**.

## Testing

```bash
# Test CSV implementation (ibuprofen pricing, CA enrollment)
node test-fixed-implementation.js

# Test unified state formulary (California + Texas)
node test-unified-formulary.js

# Test California formulary only
node test-ca-formulary.js

# Inspect CSV column structure
node inspect-csv-columns.js

# List available datasets
node test-csv-implementation.js
```

## Key Differences from Medicare MCP

| Feature | Medicare MCP | Medicaid MCP |
|---------|--------------|--------------|
| **Granularity** | Provider + procedure level | State-level aggregates |
| **Data Source** | CMS.gov Socrata API | DKAN CSV downloads |
| **Query Speed** | Real-time API calls | Cache-based (fast after first load) |
| **Use Cases** | Clinical utilization analysis | Policy analysis, market access |
| **Provider Data** | Yes (NPI, specialty, procedures) | No (state aggregates only) |

## Use Cases

✅ **Market access strategy** - State coverage prioritization
✅ **Drug pricing intelligence** - NADAC trends, comparisons
✅ **Enrollment forecasting** - Growth trends by state
✅ **Policy impact assessment** - Expansion effects

❌ **NOT for**:
- Provider-level utilization (use Medicare MCP)
- Beneficiary-level claims (requires T-MSIS/TAF DUA)
- Procedure-level analysis (no HCPCS data)

## Architecture Details

### CSV Download Flow

```
User Query: medicaid_info(method='get_nadac_pricing', drug_name='ibuprofen')
    ↓
Check Cache
    ├─ HIT → Filter cached data → Return results (<100ms)
    │
    └─ MISS
        ↓
        Download CSV from download.medicaid.gov (20s for NADAC)
        ↓
        Parse CSV to JSON (5s for 1.5M records)
        ↓
        Store in memory with TTL
        ↓
        Filter parsed data
        ↓
        Return results

Next Query (within cache TTL)
    ↓
Cache HIT → Filter → Return (<100ms)
```

### Field Mapping

The server automatically maps CSV column names to consistent field names:

**NADAC CSV**:
- `NDC Description` → `description`
- `NDC` → `ndc`
- `NADAC Per Unit` → `nadac_per_unit`
- `Effective Date` → `effective_date`
- `Pricing Unit` → `pricing_unit`

**Enrollment CSV**:
- `State Abbreviation` → `state`
- `State Name` → `state_name`
- `Reporting Period` → `reporting_period` (YYYYMM format)
- `Total Medicaid and CHIP Enrollment` → `total_medicaid_chip_enrollment`

### Cache Manager

Located: `src/cache-manager.js`

Features:
- In-memory data storage with TTL
- Download progress tracking (10% increments)
- CSV parsing (handles quoted fields with commas)
- Cache statistics and health monitoring

## Real-World Test Results

### NADAC Pricing (Ibuprofen)
```
First query: 20 seconds (download + parse 123 MB)
Total records: 1,497,925 (all drugs in NADAC database)
Ibuprofen records: 13,361 products
Sample result:
  - CHILDREN IBUPROFEN 100 MG/5 ML
  - NDC: 00904530909
  - Price: $0.02421 per ML
  - Effective Date: 12/20/2023

Second query: <100ms (from cache)
```

### California Enrollment Trends
```
First query: ~150ms (download + parse 3.6 MB)
Total records: 10,098 (all states, all months)
California records: 48 monthly snapshots
Sample result:
  - Period: 202301 (Jan 2023)
  - State: California
  - Total Enrollment: 14,122,814
  - Medicaid: 13,256,478
  - CHIP: 866,336

Second query: <50ms (from cache)
```

## Phase 3 Status - COMPLETED ✓

### What Changed from Initial Plan

**Original plan**: SQLite backend for large datasets
**Final solution**: DKAN API queries (simpler, faster, no SQLite needed!)

### Implementation ✓

- [x] Found CSV URLs for all 5 datasets
- [x] Discovered DKAN query API endpoint
- [x] Implemented DKAN API queries for 3 large datasets:
  - Federal Upper Limits (196 MB, 2.1M records)
  - Drug Rebate (291 MB, ~3M records)
  - Drug Utilization (192 MB, 5.3M records)
- [x] Tested with real queries (NYSTATIN, California Ozempic, etc.)
- [x] Updated architecture to hybrid CSV + DKAN API

### Why DKAN API Instead of SQLite?

**User feedback**: "using sqlite is an overkill for mcp"

**DKAN API advantages**:
- ✅ No large downloads (fetch 100-5000 records at a time)
- ✅ Minimal memory (~5 MB vs 1-4 GB for CSV parsing)
- ✅ Consistent query speed (1-2s, no slow first query)
- ✅ Simpler architecture (no SQLite dependency)
- ✅ Scales forever (file size growth irrelevant)

## Future Enhancements

### Phase 4 (Optimizations)

1. **Server-side DKAN filtering**: Investigate DKAN filter syntax to reduce client-side filtering
2. **Incremental CSV updates**: Only download if file changed (ETag/Last-Modified headers)
3. **Compression**: gzip cached CSV data to reduce memory footprint (~50% reduction)
4. **Pre-warming**: Load CSV cache on server startup for zero-latency first queries
5. **Background refresh**: Update cache without blocking queries
6. **Pagination helpers**: Better offset/limit handling for large DKAN result sets

## Architecture Summary

From actual testing on 2025-12-11 and 2025-12-12:

| Dataset | CSV Size | Records | Access Method | Memory | Query Speed |
|---------|----------|---------|---------------|--------|-------------|
| NADAC | 123 MB | 1,497,925 | CSV + cache | ~200 MB | 20-30s first, <100ms after |
| Enrollment | 3.6 MB | 10,098 | CSV + cache | ~5 MB | 1-2s first, <50ms after |
| Federal Upper Limits | 196 MB | 2,085,934 | DKAN API | ~5 MB | 1-2s always |
| Drug Rebate | 291 MB | ~3M+ | DKAN API | ~5 MB | 1-2s always |
| Drug Utilization | 192 MB | 5,284,306 | DKAN API | ~5 MB | 1-2s always |

**Total Memory**: ~215 MB (2 CSV datasets + 3 DKAN API datasets)
**Total Disk**: Negligible (no large downloads for DKAN datasets)

## License

MIT

## Author

OpenPharma Organization
