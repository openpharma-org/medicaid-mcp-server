#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const {
  getNADACPricing,
  compareDrugPricing,
  getEnrollmentTrends,
  compareStateEnrollment,
  getDrugRebateInfo,
  listAvailableDatasets,
  searchDatasets
} = require('./medicaid-api.js');

const server = new Server(
  {
    name: 'medicaid-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'medicaid_info',
        description: 'Unified tool for Medicaid data operations: access enrollment trends, drug pricing (NADAC), quality measures, and program performance from data.medicaid.gov via Socrata SODA API. Provides state-level aggregates (NOT provider-level like Medicare).',
        inputSchema: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: [
                'get_nadac_pricing',
                'compare_drug_pricing',
                'get_enrollment_trends',
                'compare_state_enrollment',
                'get_drug_rebate_info',
                'list_available_datasets',
                'search_datasets'
              ],
              description: 'The operation to perform: get_nadac_pricing (NADAC drug pricing lookup), compare_drug_pricing (multi-drug or temporal comparison), get_enrollment_trends (state monthly enrollment), compare_state_enrollment (multi-state comparison), get_drug_rebate_info (rebate program data), list_available_datasets (dataset catalog), search_datasets (custom SoQL query)',
              examples: ['get_nadac_pricing', 'get_enrollment_trends', 'compare_state_enrollment']
            },
            state: {
              type: 'string',
              description: 'State abbreviation (e.g., "CA", "TX", "NY") - required for get_enrollment_trends',
              examples: ['CA', 'TX', 'NY', 'FL', 'PA']
            },
            states: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of state abbreviations for compare_state_enrollment',
              examples: [['CA', 'TX', 'NY'], ['FL', 'PA', 'IL']]
            },
            ndc_code: {
              type: 'string',
              description: 'National Drug Code (11-digit) for get_nadac_pricing',
              examples: ['00002-7510-01', '00169-7501-11']
            },
            drug_name: {
              type: 'string',
              description: 'Drug name (partial match supported) for get_nadac_pricing or get_drug_rebate_info',
              examples: ['semaglutide', 'insulin', 'metformin']
            },
            price_date: {
              type: 'string',
              description: 'Specific pricing date (YYYY-MM-DD) for get_nadac_pricing - defaults to latest',
              examples: ['2024-12-11', '2024-01-01']
            },
            start_date: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD) for time-range queries',
              examples: ['2023-01-01', '2024-01-01']
            },
            end_date: {
              type: 'string',
              description: 'End date (YYYY-MM-DD) for time-range queries',
              examples: ['2024-12-01', '2024-12-31']
            },
            enrollment_type: {
              type: 'string',
              enum: ['total', 'medicaid', 'chip', 'adult', 'child'],
              description: 'Type of enrollment data for enrollment methods',
              examples: ['total', 'medicaid', 'chip']
            },
            month: {
              type: 'string',
              description: 'Specific month (YYYY-MM) for compare_state_enrollment',
              examples: ['2024-09', '2024-01']
            },
            ndc_codes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of NDC codes for compare_drug_pricing',
              examples: [['00002-7510-01', '00169-7501-11']]
            },
            drug_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of drug names for compare_drug_pricing',
              examples: [['semaglutide', 'dulaglutide']]
            },
            labeler_name: {
              type: 'string',
              description: 'Manufacturer name for get_drug_rebate_info',
              examples: ['Novo Nordisk', 'Pfizer']
            },
            rebate_year: {
              type: 'integer',
              description: 'Year for get_drug_rebate_info',
              examples: [2024, 2023]
            },
            dataset_id: {
              type: 'string',
              description: 'Dataset identifier for search_datasets',
              examples: ['99315a95-37ac-4eee-946a-3c523b4c481e']
            },
            where_clause: {
              type: 'string',
              description: 'SoQL WHERE clause for search_datasets',
              examples: ["state='CA' AND year=2024"]
            },
            limit: {
              type: 'integer',
              description: 'Maximum results to return (default: 100, max: 5000)',
              examples: [100, 500, 1000]
            },
            offset: {
              type: 'integer',
              description: 'Pagination offset (default: 0)',
              examples: [0, 100, 200]
            }
          },
          required: ['method'],
          additionalProperties: false
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== 'medicaid_info') {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const { method, ...params } = args;

    let result;

    switch (method) {
      case 'get_nadac_pricing':
        result = await getNADACPricing(params);
        break;

      case 'compare_drug_pricing':
        result = await compareDrugPricing(params);
        break;

      case 'get_enrollment_trends':
        result = await getEnrollmentTrends(params);
        break;

      case 'compare_state_enrollment':
        result = await compareStateEnrollment(params);
        break;

      case 'get_drug_rebate_info':
        result = await getDrugRebateInfo(params);
        break;

      case 'list_available_datasets':
        result = await listAvailableDatasets();
        break;

      case 'search_datasets':
        result = await searchDatasets(params);
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            method: args.method,
            params: args
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Medicaid MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
