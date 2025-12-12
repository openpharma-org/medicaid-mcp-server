/**
 * Utility functions for Medicaid MCP Server
 * - SoQL query builder
 * - Response parsers
 * - Date formatters
 */

/**
 * Build SoQL query parameters
 */
function buildSoQLQuery(params) {
  const queryParams = {};

  // WHERE clause
  if (params.where_clause) {
    queryParams.$where = params.where_clause;
  } else {
    // Build WHERE clause from individual filters
    const conditions = [];

    if (params.state) {
      conditions.push(`state='${params.state}'`);
    }

    if (params.ndc_code) {
      conditions.push(`ndc='${params.ndc_code}'`);
    }

    if (params.drug_name) {
      // Case-insensitive search for drug names
      conditions.push(`ndc_description like '%${params.drug_name}%'`);
    }

    if (params.effective_date || params.price_date) {
      const date = params.effective_date || params.price_date;
      conditions.push(`effective_date='${date}'`);
    }

    if (params.month) {
      // For enrollment data - month format is typically a column
      conditions.push(`reporting_month='${params.month}'`);
    }

    if (params.year) {
      conditions.push(`year=${params.year}`);
    }

    if (conditions.length > 0) {
      queryParams.$where = conditions.join(' AND ');
    }
  }

  // SELECT fields
  if (params.select_fields && params.select_fields.length > 0) {
    queryParams.$select = params.select_fields.join(',');
  }

  // ORDER BY
  if (params.order_by) {
    queryParams.$order = params.order_by;
  }

  // LIMIT
  if (params.limit) {
    queryParams.$limit = params.limit;
  } else {
    queryParams.$limit = 100; // Default
  }

  // OFFSET
  if (params.offset) {
    queryParams.$offset = params.offset;
  }

  return queryParams;
}

/**
 * Format date range for queries
 */
function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return null;
  }

  const conditions = [];

  if (startDate) {
    conditions.push(`effective_date >= '${startDate}'`);
  }

  if (endDate) {
    conditions.push(`effective_date <= '${endDate}'`);
  }

  return conditions.join(' AND ');
}

/**
 * Parse enrollment data response
 * Maps CSV column names to consistent field names
 */
function parseEnrollmentData(data) {
  return data.map(record => ({
    state: record['State Abbreviation'],
    state_name: record['State Name'],
    reporting_period: record['Reporting Period'], // YYYYMM format
    state_expanded_medicaid: record['State Expanded Medicaid'],
    total_medicaid_chip_enrollment: parseFloat(record['Total Medicaid and CHIP Enrollment']?.replace(/,/g, '') || 0),
    total_medicaid_enrollment: parseFloat(record['Total Medicaid Enrollment']?.replace(/,/g, '') || 0),
    total_chip_enrollment: parseFloat(record['Total CHIP Enrollment']?.replace(/,/g, '') || 0),
    total_adult_enrollment: parseFloat(record['Total Adult Medicaid Enrollment']?.replace(/,/g, '') || 0),
    medicaid_chip_child_enrollment: parseFloat(record['Medicaid and CHIP Child Enrollment']?.replace(/,/g, '') || 0)
  }));
}

/**
 * Parse NADAC pricing data response
 * Maps CSV column names to consistent field names
 */
function parseNADACData(data) {
  return data.map(record => ({
    ndc: record['NDC'],
    description: record['NDC Description'],
    nadac_per_unit: parseFloat(record['NADAC Per Unit']) || 0,
    pricing_unit: record['Pricing Unit'],
    pharmacy_type_indicator: record['Pharmacy Type Indicator'],
    otc: record['OTC'],
    effective_date: record['Effective Date'],
    explanation_code: record['Explanation Code'],
    classification_for_rate_setting: record['Classification for Rate Setting'],
    corresponding_generic_nadac: record['Corresponding Generic Drug NADAC Per Unit']
      ? parseFloat(record['Corresponding Generic Drug NADAC Per Unit'])
      : null,
    corresponding_generic_drug_effective_date: record.corresponding_generic_drug_effective_date || null
  }));
}

/**
 * Parse drug rebate data response
 */
function parseDrugRebateData(data) {
  return data.map(record => ({
    ndc: record.ndc,
    labeler_name: record.labeler_name,
    product_name: record.product_name,
    fda_approval_date: record.fda_approval_date,
    units_reimbursed: parseFloat(record.units_reimbursed) || 0,
    number_of_prescriptions: parseFloat(record.number_of_prescriptions) || 0,
    total_amount_reimbursed: parseFloat(record.total_amount_reimbursed) || 0,
    medicaid_amount_reimbursed: parseFloat(record.medicaid_amount_reimbursed) || 0,
    non_medicaid_amount_reimbursed: parseFloat(record.non_medicaid_amount_reimbursed) || 0,
    quarter: record.quarter,
    year: record.year
  }));
}

/**
 * Calculate growth rate between two values
 */
function calculateGrowthRate(current, previous) {
  if (!previous || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Group data by state for comparisons
 */
function groupByState(data) {
  const grouped = {};

  data.forEach(record => {
    const state = record.state || record.stateabbr;
    if (!grouped[state]) {
      grouped[state] = [];
    }
    grouped[state].push(record);
  });

  return grouped;
}

/**
 * Get latest date from dataset
 */
function getLatestDate() {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Get date N months ago
 */
function getDateMonthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

/**
 * Validate state code
 */
function validateStateCode(state) {
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  if (!state) {
    return false;
  }

  return validStates.includes(state.toUpperCase());
}

/**
 * Format response with metadata
 */
function formatResponse(data, metadata = {}) {
  return {
    data,
    meta: {
      total_count: data.length,
      ...metadata
    }
  };
}

module.exports = {
  buildSoQLQuery,
  formatDateRange,
  parseEnrollmentData,
  parseNADACData,
  parseDrugRebateData,
  calculateGrowthRate,
  groupByState,
  getLatestDate,
  getDateMonthsAgo,
  validateStateCode,
  formatResponse
};
