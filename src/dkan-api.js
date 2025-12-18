/**
 * DKAN API Query Functions
 *
 * Alternative to CSV downloads - query data directly via DKAN API
 * Works for large datasets (drug utilization, drug rebate) without downloading entire files
 */

const axios = require('axios');

/**
 * Query DKAN datastore API
 * @param {string} datasetId - Dataset UUID
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Query results
 */
async function queryDKAN(datasetId, params = {}) {
  const url = `https://data.medicaid.gov/api/1/datastore/query/${datasetId}/0`;

  try {
    // Build query parameters
    const queryParams = {
      limit: params.limit || 100,
      offset: params.offset || 0
    };

    // Add filters if provided
    // Note: DKAN uses URL parameters for simple queries
    if (params.state) {
      // Will filter in results since DKAN filter syntax unclear
    }

    const response = await axios.get(url, {
      params: queryParams,
      timeout: 30000
    });

    return {
      results: response.data.results || [],
      count: response.data.count || 0,
      schema: response.data.schema || {}
    };

  } catch (error) {
    throw new Error(`DKAN API error: ${error.message}`);
  }
}

/**
 * Query drug utilization data via DKAN API
 */
async function queryDrugUtilization(params) {
  const datasetId = '61729e5a-7aa8-448c-8903-ba3e0cd0ea3c'; // 2024 drug utilization

  // Fetch larger batch for client-side filtering
  // Since we can't filter server-side, fetch more records and filter locally
  const fetchLimit = 5000;  // Fetch 5000 records, filter to user's limit
  const userLimit = params.limit || 100;

  const response = await queryDKAN(datasetId, {
    limit: fetchLimit,
    offset: params.offset || 0
  });

  let results = response.results;

  // Client-side filtering (since DKAN filter syntax unclear)
  if (params.state) {
    const stateUpper = params.state.toUpperCase();
    results = results.filter(r => r.state === stateUpper);
  }

  if (params.drug_name) {
    const drugLower = params.drug_name.toLowerCase();
    results = results.filter(r =>
      (r.product_name || '').toLowerCase().includes(drugLower)
    );
  }

  if (params.ndc) {
    results = results.filter(r => r.ndc === params.ndc);
  }

  if (params.year) {
    results = results.filter(r => r.year == params.year);
  }

  if (params.quarter) {
    results = results.filter(r => r.quarter == params.quarter);
  }

  // Limit results to user's requested limit
  results = results.slice(0, userLimit);

  return {
    data: results.map(r => ({
      state: r.state,
      ndc: r.ndc,
      product_name: r.product_name,
      labeler_code: r.labeler_code,
      year: parseInt(r.year),
      quarter: parseInt(r.quarter),
      units_reimbursed: parseFloat(r.units_reimbursed) || 0,
      number_of_prescriptions: parseInt(r.number_of_prescriptions) || 0,
      total_amount_reimbursed: parseFloat(r.total_amount_reimbursed) || 0,
      medicaid_amount_reimbursed: parseFloat(r.medicaid_amount_reimbursed) || 0,
      utilization_type: r.utilization_type
    })),
    meta: {
      total_count: response.count,
      returned_count: results.length,
      query_type: 'drug_utilization',
      source: 'DKAN API'
    }
  };
}

/**
 * Query drug rebate program data via DKAN API
 */
async function queryDrugRebate(params) {
  const datasetId = '0ad65fe5-3ad3-5d79-a3f9-7893ded7963a'; // Drug rebate

  // Fetch larger batch for client-side filtering since we can't filter server-side
  const fetchLimit = params.drug_name || params.labeler_name ? 5000 : (params.limit || 100);

  const response = await queryDKAN(datasetId, {
    limit: fetchLimit,
    offset: params.offset || 0
  });

  let results = response.results;

  // Client-side filtering
  if (params.ndc) {
    const normalizedNdc = params.ndc.replace(/-/g, '');
    results = results.filter(r => (r.ndc || '').replace(/-/g, '') === normalizedNdc);
  }

  if (params.drug_name) {
    const drugLower = params.drug_name.toLowerCase();
    results = results.filter(r =>
      (r.fda_product_name || '').toLowerCase().includes(drugLower)
    );
  }

  if (params.labeler_name) {
    const labelerLower = params.labeler_name.toLowerCase();
    results = results.filter(r =>
      (r.labeler_name || '').toLowerCase().includes(labelerLower)
    );
  }

  // Limit to user's requested limit
  const userLimit = params.limit || 100;
  results = results.slice(0, userLimit);

  return {
    data: results.map(r => ({
      ndc: r.ndc,
      fda_product_name: r.fda_product_name,
      labeler_name: r.labeler_name,
      labeler_code: r.labeler_code,
      drug_category: r.drug_category,
      drug_type_indicator: r.drug_type_indicator,
      fda_approval_date: r.fda_approval_date,
      market_date: r.market_date,
      termination_date: r.termination_date,
      unit_type: r.unit_type,
      units_per_pkg_size: r.units_per_pkg_size,
      fda_therapeutic_equivalence_code: r.fda_therapeutic_equivalence_code,
      clotting_factor_indicator: r.clotting_factor_indicator,
      pediatric_indicator: r.pediatric_indicator,
      year: r.year,
      quarter: r.quarter
    })),
    meta: {
      total_count: response.count,
      returned_count: results.length,
      query_type: 'drug_rebate',
      source: 'DKAN API'
    }
  };
}

/**
 * Query Federal Upper Limits via DKAN API
 */
async function queryFederalUpperLimits(params) {
  const datasetId = 'ce4cf49b-a21b-5a53-bbc3-509414940847'; // Federal Upper Limits

  // Fetch larger batch for client-side filtering
  const fetchLimit = 5000;
  const userLimit = params.limit || 100;

  const response = await queryDKAN(datasetId, {
    limit: fetchLimit,
    offset: params.offset || 0
  });

  let results = response.results;

  // Client-side filtering
  if (params.ingredient) {
    const ingredientUpper = params.ingredient.toUpperCase();
    results = results.filter(r =>
      (r.Ingredient || r.ingredient || '').toUpperCase().includes(ingredientUpper)
    );
  }

  if (params.ndc) {
    results = results.filter(r => (r.NDC || r.ndc) === params.ndc);
  }

  if (params.strength) {
    const strengthUpper = params.strength.toUpperCase();
    results = results.filter(r =>
      (r.Strength || r.strength || '').toUpperCase().includes(strengthUpper)
    );
  }

  if (params.dosage) {
    const dosageUpper = params.dosage.toUpperCase();
    results = results.filter(r =>
      (r.Dosage || r.dosage || '').toUpperCase().includes(dosageUpper)
    );
  }

  if (params.year) {
    results = results.filter(r => (r.Year || r.year) == params.year);
  }

  if (params.month) {
    results = results.filter(r => (r.Month || r.month) == params.month);
  }

  // Limit results to user's requested limit
  results = results.slice(0, userLimit);

  return {
    data: results.map(r => ({
      product_group: r['Product Group'] || r.product_group,
      ingredient: r.Ingredient || r.ingredient,
      strength: r.Strength || r.strength,
      dosage: r.Dosage || r.dosage,
      route: r.Route || r.route,
      mdr_unit_type: r['MDR Unit Type'] || r.mdr_unit_type,
      weighted_avg_amps: parseFloat(r['Weighted Average of AMPs'] || r.weighted_avg_amps) || 0,
      aca_ful: parseFloat(r['ACA FUL'] || r.aca_ful) || 0,
      package_size: r['Package Size'] || r.package_size,
      ndc: r.NDC || r.ndc,
      a_rated: r['A-Rated'] || r.a_rated,
      multiplier: r['Multiplier Greater Than 175 Percent of Weighted Avg of AMPs'] || r.multiplier,
      year: parseInt(r.Year || r.year),
      month: parseInt(r.Month || r.month)
    })),
    meta: {
      total_count: response.count,
      returned_count: results.length,
      query_type: 'federal_upper_limits',
      source: 'DKAN API'
    }
  };
}

module.exports = {
  queryDKAN,
  queryDrugUtilization,
  queryDrugRebate,
  queryFederalUpperLimits
};
