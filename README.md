# Unofficial Medicaid MCP Server

> Model Context Protocol (MCP) server for Medicaid public data access via data.medicaid.gov and state formularies

## Features

### State Formulary Coverage
Access Medicaid formularies for 5 states covering 43% of US Medicaid beneficiaries (32M of 74M):
- **California** - 40K drugs with NDC codes, prior authorization requirements, tier-based pricing
- **New York** - 37K drugs with MRA pricing, daily updates, preferred drug lists
- **Ohio** - 76K drugs with comprehensive step therapy and quantity limit data
- **Texas** - 4.7K drugs with multi-program pricing (Medicaid, CHIP, specialty programs)
- **Illinois** - 5.7K drugs with intelligent cross-state NDC enrichment (61.7% coverage)

### Pricing & Utilization Data
- **NADAC Drug Pricing** - National average drug acquisition costs (1.5M NDCs, weekly updates)
- **Federal Upper Limits** - Generic drug maximum reimbursement (2.1M records, monthly updates)
- **Drug Rebate Program** - Manufacturer product information and rebate agreements (~3M records)
- **State Drug Utilization** - Prescription volume by state, drug, and quarter (5.3M records)
- **Enrollment Trends** - Monthly Medicaid/CHIP enrollment by state (all 50 states + territories)

### Technical Features
- **Hybrid Architecture** - Optimized data access: in-memory caching for small datasets, streaming API for large datasets
- **Automatic Pricing Integration** - Formulary queries auto-enrich with NADAC pricing data
- **Intelligent Enrichment** - Illinois formulary enhanced via cross-state NDC matching (CA/NY/OH sources)

## Usage

```json
{
  "mcpServers": {
    "medicaid": {
      "command": "node",
      "args": ["/path/to/medicaid-mcp-server/build/index.js"]
    }
  }
}
```

## API Reference

### Unified Tool: `medicaid_info`

The server provides a single tool with multiple methods:

#### State Formulary Search

```javascript
{
  "method": "search_state_formulary",
  "state": "CA",  // CA, NY, OH, TX, IL
  "label_name": "OZEMPIC",
  "limit": 10
}
```

**Parameters:**
- `state` (required): State code (CA, NY, OH, TX, IL)
- `label_name`: Brand/trade name
- `generic_name`: Generic drug name
- `ndc`: 11-digit NDC code
- `requires_pa`: Prior authorization filter (true/false)
- `has_ndc`: Filter for drugs with NDC codes (Illinois only)
- `limit`: Max results (default: 10)

**State-Specific Parameters:**

California:
- `tier`: Cost ceiling tier ("Brand" or "Generic")
- `extended_duration`: Extended duration eligibility (true/false)

Texas:
- `pdl_pa`: PDL prior authorization (true/false)
- `clinical_pa`: Clinical prior authorization (true/false)
- `program`: Program filter (medicaid, chip, cshcn, etc.)
- `max_price` / `min_price`: Price range filters

New York:
- `preferred`: Preferred drug status (true/false)
- `is_brand`: Brand vs generic filter (true/false)
- `max_price` / `min_price`: MRA cost range

#### Drug Pricing

```javascript
{
  "method": "get_nadac_pricing",
  "drug_name": "ibuprofen",
  "limit": 10
}
```

**Parameters:**
- `drug_name`: Drug name (fuzzy match)
- `ndc`: Specific 11-digit NDC code
- `limit`: Max results (default: 10)

#### Enrollment Trends

```javascript
{
  "method": "get_enrollment_trends",
  "state": "CA",
  "start_date": "2023-01-01",
  "end_date": "2024-12-31"
}
```

#### Federal Upper Limits

```javascript
{
  "method": "get_federal_upper_limits",
  "ingredient": "NYSTATIN",
  "limit": 10
}
```

#### Drug Rebate Information

```javascript
{
  "method": "get_drug_rebate_info",
  "drug_name": "ozempic",  // or labeler_name: "novo nordisk"
  "limit": 10
}
```

#### State Drug Utilization

```javascript
{
  "method": "get_drug_utilization",
  "state": "CA",
  "drug_name": "OZEMPIC",
  "year": 2024,
  "quarter": 4,
  "limit": 10
}
```

## Architecture

The server uses a hybrid data access strategy optimized for performance and memory efficiency:

**Cached Datasets** - Small, frequently accessed data loaded into memory:
- State formularies (CA, NY, OH, TX, IL) - Excel/CSV/JSON/Text parsing with TTL-based refresh
- NADAC pricing (123 MB) - Weekly CSV download, cached for fast lookups
- State enrollment (3.6 MB) - Monthly snapshots, cached for trend analysis

**Streaming API** - Large datasets queried on-demand via CMS DKAN API:
- Federal Upper Limits (196 MB, 2.1M records)
- Drug Rebate Program (291 MB, ~3M records)
- State Drug Utilization (192 MB, 5.3M records)

**Memory Footprint**: ~215 MB total for cached datasets, minimal for API queries

### Performance Characteristics

| Dataset | Access Method | Typical Response Time |
|---------|---------------|----------------------|
| State Formularies | In-memory cache | <100ms |
| NADAC Pricing | In-memory cache | <100ms (20-30s initial load) |
| State Enrollment | In-memory cache | <50ms |
| Federal Upper Limits | DKAN API streaming | 1-2s |
| Drug Rebate Program | DKAN API streaming | 1-2s |
| State Drug Utilization | DKAN API streaming | 1-2s |

## Data Sources

| Dataset | Update Frequency | Coverage | Authority |
|---------|-----------------|----------|-----------|
| NADAC | Weekly | 1.5M NDC codes | CMS |
| State Formularies | Daily-Monthly | 43% of US Medicaid | State agencies |
| Federal Upper Limits | Monthly | 2.1M records | CMS |
| Drug Rebate | Quarterly | ~3M records | CMS |
| Drug Utilization | Quarterly | 5.3M records | CMS |
| Enrollment | Monthly | All states | CMS |

## Query Examples

### State Formulary Search with Automatic Pricing

```javascript
// Find GLP-1 drugs in California
{
  "method": "search_state_formulary",
  "state": "CA",
  "generic_name": "semaglutide",
  "limit": 10
}
// Returns formulary data with automatic NADAC pricing integration
```

### Multi-State Enrollment Comparison

```javascript
{
  "method": "compare_state_enrollment",
  "states": ["CA", "TX", "NY", "FL"],
  "month": "2024-09"
}
```

### Cross-State NDC Enrichment

```javascript
// Illinois formulary with intelligent enrichment
{
  "method": "search_state_formulary",
  "state": "IL",
  "label_name": "OZEMPIC",
  "limit": 10
}
// Returns IL formulary enriched with NDC codes from CA/NY/OH (61.7% coverage)
```

## Use Cases

**Market Access & Strategy**
- State formulary coverage analysis and prioritization
- Prior authorization landscape mapping
- Competitive tier placement assessment

**Pricing Intelligence**
- NADAC price trend analysis and forecasting
- Multi-state pricing comparisons
- Rebate program eligibility verification

**Policy & Economics**
- Medicaid expansion impact analysis
- State enrollment forecasting and growth trends
- Utilization pattern analysis by geography

**Limitations**
- Provider-level utilization data not available (use Medicare MCP for provider analytics)
- Individual beneficiary claims require CMS Data Use Agreement (T-MSIS/TAF)
- No HCPCS procedure-level analysis (state-level aggregate data only)
