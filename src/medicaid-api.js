/**
 * Medicaid API Implementation
 *
 * CSV-based data retrieval from data.medicaid.gov
 * Uses in-memory caching with TTL for performance
 */

const { cache } = require('./cache-manager');
const { getDataset, getFormularyByState } = require('./datasets');
const { downloadAndParseExcel, searchFormulary } = require('./excel-parser');
const { downloadAndParseText, searchTexasFormulary } = require('./text-parser');
const { downloadAndParseCSV } = require('./csv-parser');
const { downloadAndParseJSON, searchOhioFormulary } = require('./json-parser');
const { getEnrichedIllinoisFormulary, searchIllinoisFormulary } = require('./illinois-enrichment');
const {
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
} = require('./utils');

/**
 * Get NADAC data (downloads and caches CSV)
 */
async function getNADACData() {
  const dataset = getDataset('nadac');

  if (!dataset.downloadUrl) {
    throw new Error('NADAC CSV download URL not configured');
  }

  return cache.get('NADAC', async () => {
    return cache.downloadAndParseCSV(dataset.downloadUrl, 'NADAC');
  }, dataset.cacheTime);
}

/**
 * Get Enrollment data (downloads and caches CSV)
 */
async function getEnrollmentData() {
  const dataset = getDataset('enrollment');

  if (!dataset.downloadUrl) {
    throw new Error('Enrollment CSV download URL not configured');
  }

  return cache.get('ENROLLMENT', async () => {
    return cache.downloadAndParseCSV(dataset.downloadUrl, 'Enrollment');
  }, dataset.cacheTime);
}

/**
 * Get NADAC pricing data
 */
async function getNADACPricing(params) {
  const dataset = getDataset('nadac');
  const allData = await getNADACData();

  // Filter data based on parameters
  let filtered = allData;

  // Filter by NDC code (exact match)
  if (params.ndc_code) {
    const ndc = params.ndc_code.replace(/-/g, ''); // Remove dashes
    filtered = filtered.filter(row => {
      const rowNdc = (row['NDC'] || '').replace(/-/g, '');
      return rowNdc === ndc;
    });
  }

  // Filter by drug name (case-insensitive partial match)
  if (params.drug_name) {
    const searchTerm = params.drug_name.toLowerCase();
    filtered = filtered.filter(row => {
      const description = (row['NDC Description'] || '').toLowerCase();
      return description.includes(searchTerm);
    });
  }

  // Filter by date
  if (params.price_date) {
    filtered = filtered.filter(row => {
      const effectiveDate = row['Effective Date'] || '';
      return effectiveDate === params.price_date;
    });
  }

  // Pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  // Parse and format
  const parsed = parseNADACData(paginated);

  return formatResponse(parsed, {
    dataset: dataset.name,
    total_count: filtered.length,
    returned_count: paginated.length,
    effective_date: params.price_date || 'latest',
    query_type: 'nadac_pricing',
    cache_status: 'loaded from cache'
  });
}

/**
 * Compare drug pricing across time or multiple drugs
 */
async function compareDrugPricing(params) {
  const dataset = getDataset('nadac');
  const allData = await getNADACData();

  const ndc_codes = params.ndc_codes || [];
  const drug_names = params.drug_names || [];

  if (ndc_codes.length === 0 && drug_names.length === 0) {
    throw new Error('Either ndc_codes or drug_names must be provided');
  }

  let filtered = allData;

  // Filter by date range
  if (params.start_date && params.end_date) {
    filtered = filtered.filter(row => {
      const effectiveDate = row['Effective Date'] || '';
      return effectiveDate >= params.start_date && effectiveDate <= params.end_date;
    });
  }

  // Filter by NDC codes
  if (ndc_codes.length > 0) {
    const normalizedCodes = ndc_codes.map(ndc => ndc.replace(/-/g, ''));
    filtered = filtered.filter(row => {
      const rowNdc = (row['NDC'] || '').replace(/-/g, '');
      return normalizedCodes.includes(rowNdc);
    });
  }

  // Filter by drug names
  if (drug_names.length > 0) {
    const searchTerms = drug_names.map(name => name.toLowerCase());
    filtered = filtered.filter(row => {
      const description = (row['NDC Description'] || '').toLowerCase();
      return searchTerms.some(term => description.includes(term));
    });
  }

  // Sort by date
  filtered.sort((a, b) => {
    const dateA = a['Effective Date'] || '';
    const dateB = b['Effective Date'] || '';
    return dateB.localeCompare(dateA); // Descending
  });

  // Pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  const parsed = parseNADACData(paginated);

  return formatResponse(parsed, {
    dataset: dataset.name,
    total_count: filtered.length,
    returned_count: paginated.length,
    date_range: {
      start: params.start_date,
      end: params.end_date
    },
    query_type: 'drug_pricing_comparison'
  });
}

/**
 * Get enrollment trends over time
 */
async function getEnrollmentTrends(params) {
  const dataset = getDataset('enrollment');
  const allData = await getEnrollmentData();

  let filtered = allData;

  // Filter by state
  if (params.state) {
    const stateUpper = params.state.toUpperCase();
    filtered = filtered.filter(row => {
      const state = (row['State Abbreviation'] || '').toUpperCase();
      return state === stateUpper;
    });
  }

  // Filter by date range (using Reporting Period YYYYMM format)
  if (params.start_date && params.end_date) {
    // Convert YYYY-MM-DD to YYYYMM for comparison
    const startPeriod = params.start_date.replace(/-/g, '').substring(0, 6);
    const endPeriod = params.end_date.replace(/-/g, '').substring(0, 6);

    filtered = filtered.filter(row => {
      const reportPeriod = row['Reporting Period'] || '';
      return reportPeriod >= startPeriod && reportPeriod <= endPeriod;
    });
  }

  // Filter by enrollment type
  if (params.enrollment_type) {
    // This depends on the actual column names in the enrollment CSV
    // Will need to map enrollment_type to actual columns
  }

  // Sort by date (Reporting Period YYYYMM format)
  filtered.sort((a, b) => {
    const periodA = a['Reporting Period'] || '';
    const periodB = b['Reporting Period'] || '';
    return periodA.localeCompare(periodB); // Ascending for trends
  });

  // Pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  const parsed = parseEnrollmentData(paginated);

  return formatResponse(parsed, {
    dataset: dataset.name,
    total_count: filtered.length,
    returned_count: paginated.length,
    state: params.state || 'all',
    date_range: {
      start: params.start_date,
      end: params.end_date
    },
    query_type: 'enrollment_trends'
  });
}

/**
 * Compare state enrollment data
 */
async function compareStateEnrollment(params) {
  const dataset = getDataset('enrollment');
  const allData = await getEnrollmentData();

  const states = params.states || [];
  if (states.length === 0) {
    throw new Error('states parameter is required');
  }

  let filtered = allData;

  // Filter by states
  const statesUpper = states.map(s => s.toUpperCase());
  filtered = filtered.filter(row => {
    const state = (row['State Abbreviation'] || '').toUpperCase();
    return statesUpper.includes(state);
  });

  // Filter by month (if specified, convert YYYY-MM to YYYYMM)
  if (params.month) {
    const monthPeriod = params.month.replace(/-/g, ''); // Convert "2024-09" to "202409"
    filtered = filtered.filter(row => {
      const reportPeriod = row['Reporting Period'] || '';
      return reportPeriod === monthPeriod;
    });
  }

  // Group by state
  const grouped = groupByState(filtered);

  return formatResponse(grouped, {
    dataset: dataset.name,
    states: states,
    month: params.month || 'latest',
    query_type: 'state_enrollment_comparison'
  });
}

/**
 * Get drug rebate information
 * NOTE: Not implemented yet - need CSV download URL
 */
async function getDrugRebateInfo(params) {
  const dataset = getDataset('drug_pricing', 'rebate');

  if (!dataset.downloadUrl) {
    throw new Error('Drug rebate data not yet implemented - CSV download URL needed');
  }

  // TODO: Implement when CSV URL is available
  throw new Error('Drug rebate data coming in Phase 2');
}

/**
 * List available datasets
 */
async function listAvailableDatasets(params) {
  const { listDatasets } = require('./datasets');
  const datasets = listDatasets();

  const available = datasets.map(ds => ({
    name: ds.name,
    category: ds.category,
    update_frequency: ds.update_frequency,
    description: ds.description,
    estimated_size: ds.estimatedSize,
    estimated_records: ds.estimatedRecords,
    available: !!ds.downloadUrl,
    cache_time_hours: ds.cacheTime / (60 * 60 * 1000)
  }));

  return formatResponse(available, {
    total_datasets: datasets.length,
    available_datasets: available.filter(ds => ds.available).length,
    query_type: 'list_datasets'
  });
}

/**
 * Generic dataset search (advanced)
 */
async function searchDatasets(params) {
  const datasetId = params.dataset_id;
  if (!datasetId) {
    throw new Error('dataset_id parameter is required');
  }

  // Map dataset_id to known datasets
  const { getDataset } = require('./datasets');

  if (datasetId === 'nadac' || datasetId === 'drug_pricing') {
    return getNADACPricing(params);
  } else if (datasetId === 'enrollment') {
    return getEnrollmentTrends(params);
  } else {
    throw new Error(`Unknown dataset_id: ${datasetId}`);
  }
}

/**
 * Get state formulary data (downloads and caches based on format)
 * @param {string} state - State code (CA, TX)
 * @returns {Promise<Array>} Parsed formulary records
 */
async function getStateFormularyData(state) {
  const dataset = getFormularyByState(state);

  if (!dataset.downloadUrl) {
    throw new Error(`${state} Formulary download URL not configured`);
  }

  // Illinois uses cross-state enrichment strategy
  if (state.toUpperCase() === 'IL') {
    return getEnrichedIllinoisFormulary();
  }

  const cacheKey = `${state}_FORMULARY`;

  return cache.get(cacheKey, async () => {
    if (dataset.accessMethod === 'excel') {
      return downloadAndParseExcel(dataset.downloadUrl);
    } else if (dataset.accessMethod === 'text') {
      return downloadAndParseText(dataset.downloadUrl);
    } else if (dataset.accessMethod === 'csv') {
      return downloadAndParseCSV(dataset.downloadUrl);
    } else if (dataset.accessMethod === 'json') {
      return downloadAndParseJSON(dataset.downloadUrl);
    } else {
      throw new Error(`Unsupported access method: ${dataset.accessMethod}`);
    }
  }, dataset.cacheTime);
}

/**
 * Search New York Medicaid Formulary
 * @param {Array} data - Parsed NY formulary data
 * @param {Object} params - Search parameters
 * @returns {Array} Filtered results
 */
function searchNewYorkFormulary(data, params) {
  let filtered = data;

  // Filter by NDC
  if (params.ndc) {
    const normalizedNDC = params.ndc.replace(/-/g, '');
    filtered = filtered.filter(row => {
      const rowNDC = (row.ndc || '').replace(/-/g, '');
      return rowNDC.includes(normalizedNDC);
    });
  }

  // Filter by generic name
  if (params.generic_name) {
    const searchTerm = params.generic_name.toLowerCase();
    filtered = filtered.filter(row =>
      (row.generic_name || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by label/brand name
  if (params.label_name) {
    const searchTerm = params.label_name.toLowerCase();
    filtered = filtered.filter(row =>
      (row.label_name || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by prior authorization requirement
  if (params.requires_pa !== undefined) {
    filtered = filtered.filter(row =>
      row.prior_authorization === params.requires_pa
    );
  }

  // Filter by preferred drug status
  if (params.preferred !== undefined) {
    filtered = filtered.filter(row =>
      row.preferred_drug === params.preferred
    );
  }

  // Filter by brand vs generic
  if (params.is_brand !== undefined) {
    filtered = filtered.filter(row =>
      row.is_brand === params.is_brand
    );
  }

  // Filter by MRA cost range
  if (params.max_price !== undefined) {
    filtered = filtered.filter(row =>
      row.mra_cost !== null && row.mra_cost <= params.max_price
    );
  }

  if (params.min_price !== undefined) {
    filtered = filtered.filter(row =>
      row.mra_cost !== null && row.mra_cost >= params.min_price
    );
  }

  // Apply limit
  const limit = params.limit || 100;
  return filtered.slice(0, limit);
}

/**
 * Search State Medicaid Formulary (unified method for all states)
 * @param {Object} params - Search parameters
 * @param {string} params.state - State code (CA, TX, NY, OH, IL) - REQUIRED
 * @param {string} params.ndc - NDC code filter
 * @param {string} params.generic_name - Generic name filter
 * @param {string} params.label_name - Brand/label name filter
 * @param {boolean} params.requires_pa - Prior authorization filter
 * @param {boolean} params.preferred - Preferred drug filter (NY only)
 * @param {number} params.limit - Result limit (default: 100)
 * @returns {Promise<Object>} Search results with statistics
 */
async function searchStateFormulary(params = {}) {
  if (!params.state) {
    throw new Error('state parameter is required (e.g., "CA", "TX", "NY")');
  }

  const stateUpper = params.state.toUpperCase();
  const dataset = getFormularyByState(stateUpper);
  const data = await getStateFormularyData(stateUpper);

  let results;

  // Use state-specific search function based on data structure
  if (stateUpper === 'CA') {
    results = searchFormulary(data, {
      ndc: params.ndc,
      generic_name: params.generic_name,
      label_name: params.label_name,
      requires_pa: params.requires_pa,
      extended_duration: params.extended_duration,
      tier: params.tier,
      limit: params.limit || 100
    });

    // AUTO-JOIN NADAC PRICING FOR CALIFORNIA
    // California doesn't publish pricing in formulary, so we enrich with NADAC data
    if (results.length > 0) {
      try {
        // Get NADAC data for all NDCs in results
        const nadacData = await getNADACData();

        // Create NADAC lookup map (use most recent record for each NDC)
        const nadacMap = new Map();
        nadacData.forEach(record => {
          const ndc = (record['NDC'] || '').replace(/-/g, '');
          const existing = nadacMap.get(ndc);
          const effectiveDate = record['Effective Date'] || '';

          if (!existing || effectiveDate > existing.effective_date) {
            nadacMap.set(ndc, {
              nadac_per_unit: parseFloat(record['NADAC Per Unit']) || null,
              pricing_unit: record['Pricing Unit'] || null,
              effective_date: effectiveDate,
              package_size: record['Package Size'] || null,
              description: record['NDC Description'] || null
            });
          }
        });

        // Enrich California results with NADAC pricing
        const caDispensingFee = 10.05; // High volume pharmacy
        results = results.map(product => {
          const ndc = (product.ndc || '').replace(/-/g, '');
          const nadac = nadacMap.get(ndc);

          if (nadac && nadac.nadac_per_unit) {
            // Try to determine package size from description
            const description = product.label_name || nadac.description || '';
            let packageSize = 1.0; // Default

            // Parse package size from description (e.g., "1.5 ML", "3 ML")
            const mlMatch = description.match(/([\d.]+)\s*ML/i);
            if (mlMatch) {
              packageSize = parseFloat(mlMatch[1]);
            }

            // Calculate California Medicaid reimbursement
            const estimatedReimbursement = (nadac.nadac_per_unit * packageSize) + caDispensingFee;

            return {
              ...product,
              // NADAC pricing fields
              nadac_per_unit: nadac.nadac_per_unit,
              nadac_pricing_unit: nadac.pricing_unit,
              nadac_effective_date: nadac.effective_date,
              nadac_package_size: packageSize,
              // California Medicaid calculated pricing
              ca_estimated_reimbursement: parseFloat(estimatedReimbursement.toFixed(2)),
              ca_dispensing_fee: caDispensingFee,
              pricing_notes: 'CA reimbursement = (NADAC per unit × package size) + dispensing fee'
            };
          }

          return product; // No NADAC data available for this NDC
        });
      } catch (error) {
        console.warn('[NADAC Integration] Failed to enrich CA formulary with pricing:', error.message);
        // Continue without pricing data rather than failing the entire request
      }
    }

  } else if (stateUpper === 'TX') {
    results = searchTexasFormulary(data, {
      ndc: params.ndc,
      generic_name: params.generic_name,
      label_name: params.label_name,
      requires_pa: params.requires_pa,
      pdl_pa: params.pdl_pa,
      clinical_pa: params.clinical_pa,
      program: params.program,
      max_price: params.max_price,
      min_price: params.min_price,
      limit: params.limit || 100
    });
  } else if (stateUpper === 'NY') {
    // New York formulary search
    results = searchNewYorkFormulary(data, {
      ndc: params.ndc,
      generic_name: params.generic_name,
      label_name: params.label_name,
      requires_pa: params.requires_pa,
      preferred: params.preferred,
      is_brand: params.is_brand,
      max_price: params.max_price,
      min_price: params.min_price,
      limit: params.limit || 100
    });
  } else if (stateUpper === 'OH') {
    // Ohio formulary search
    results = searchOhioFormulary(data, {
      ndc: params.ndc,
      generic_name: params.generic_name,
      label_name: params.label_name,
      requires_pa: params.requires_pa,
      step_therapy: params.step_therapy,
      has_quantity_limit: params.has_quantity_limit,
      is_brand: params.is_brand,
      otc: params.otc,
      limit: params.limit || 100
    });
  } else if (stateUpper === 'IL') {
    // Illinois formulary search (enriched with CA/NY NDC codes)
    results = searchIllinoisFormulary(data, {
      ndc: params.ndc,
      generic_name: params.generic_name,
      label_name: params.label_name,
      requires_pa: params.requires_pa,
      match_confidence: params.match_confidence,
      has_ndc: params.has_ndc,
      limit: params.limit || 100
    });
  } else {
    throw new Error(`Search not implemented for state: ${stateUpper}`);
  }

  // Calculate state-specific statistics
  let stats = {
    total_records: data.length,
    matching_records: results.length,
    unique_generic_drugs: new Set(results.map(r => r.generic_name)).size,
    pa_required_count: results.filter(r => r.prior_authorization).length
  };

  // Add CA-specific stats
  if (stateUpper === 'CA') {
    stats.extended_duration_count = results.filter(r => r.extended_duration_drug).length;
    stats.brand_count = results.filter(r => r.cost_ceiling_tier === 'Brand').length;
    stats.generic_count = results.filter(r => r.cost_ceiling_tier === 'Generic').length;
    stats.with_pricing_count = results.filter(r => r.nadac_per_unit !== undefined).length;

    // Calculate average pricing for products with NADAC data
    const productsWithPricing = results.filter(r => r.ca_estimated_reimbursement !== undefined);
    if (productsWithPricing.length > 0) {
      stats.avg_ca_reimbursement = (
        productsWithPricing.reduce((sum, r) => sum + r.ca_estimated_reimbursement, 0) /
        productsWithPricing.length
      ).toFixed(2);
      stats.avg_nadac_per_unit = (
        productsWithPricing.reduce((sum, r) => sum + r.nadac_per_unit, 0) /
        productsWithPricing.length
      ).toFixed(2);
    }
  }

  // Add TX-specific stats
  if (stateUpper === 'TX') {
    stats.medicaid_active_count = results.filter(r => r.medicaid_active).length;
    stats.chip_active_count = results.filter(r => r.chip_active).length;
    stats.pdl_pa_required_count = results.filter(r => r.pdl_pa_required).length;
    stats.clinical_pa_required_count = results.filter(r => r.clinical_pa_required).length;
    stats.avg_retail_price = results.filter(r => r.retail_price !== null).length > 0
      ? (results.filter(r => r.retail_price !== null).reduce((sum, r) => sum + r.retail_price, 0) /
         results.filter(r => r.retail_price !== null).length).toFixed(2)
      : null;
  }

  // Add NY-specific stats
  if (stateUpper === 'NY') {
    stats.brand_count = results.filter(r => r.is_brand).length;
    stats.generic_count = results.filter(r => r.is_generic).length;
    stats.preferred_count = results.filter(r => r.preferred_drug).length;
    stats.with_pricing_count = results.filter(r => r.mra_cost !== null).length;

    // Calculate average MRA pricing
    const productsWithPricing = results.filter(r => r.mra_cost !== null);
    if (productsWithPricing.length > 0) {
      stats.avg_mra_cost = (
        productsWithPricing.reduce((sum, r) => sum + r.mra_cost, 0) /
        productsWithPricing.length
      ).toFixed(2);
    }
  }

  // Add OH-specific stats
  if (stateUpper === 'OH') {
    stats.brand_count = results.filter(r => r.is_brand).length;
    stats.generic_count = results.filter(r => r.is_generic).length;
    stats.step_therapy_count = results.filter(r => r.step_therapy !== null).length;
    stats.quantity_limit_count = results.filter(r => r.quantity_limit !== null).length;
    stats.otc_count = results.filter(r => r.is_otc).length;
  }

  // Add IL-specific stats (cross-state enrichment metrics)
  if (stateUpper === 'IL') {
    stats.with_ndc_count = results.filter(r => r.ndc !== null).length;
    stats.without_ndc_count = results.filter(r => r.ndc === null).length;
    stats.enrichment_rate = ((stats.with_ndc_count / results.length) * 100).toFixed(1) + '%';
    stats.ca_source_count = results.filter(r => r.ndc_source === 'CA').length;
    stats.ny_source_count = results.filter(r => r.ndc_source === 'NY').length;
    stats.high_confidence_count = results.filter(r => r.match_confidence === 'high').length;
    stats.medium_confidence_count = results.filter(r => r.match_confidence === 'medium').length;
  }

  return {
    state: stateUpper,
    state_name: stateUpper === 'CA' ? 'California' : stateUpper === 'TX' ? 'Texas' : stateUpper === 'NY' ? 'New York' : stateUpper === 'OH' ? 'Ohio' : stateUpper === 'IL' ? 'Illinois' : stateUpper,
    dataset: dataset.name,
    query_params: params,
    statistics: stats,
    results: results
  };
}

/**
 * Search California Medicaid Formulary (backward compatibility wrapper)
 * @deprecated Use searchStateFormulary({ state: 'CA', ... }) instead
 */
async function searchCaliforniaFormulary(params = {}) {
  return searchStateFormulary({ ...params, state: 'CA' });
}

module.exports = {
  getNADACPricing,
  compareDrugPricing,
  getEnrollmentTrends,
  compareStateEnrollment,
  getDrugRebateInfo,
  searchStateFormulary,
  searchCaliforniaFormulary,  // Backward compatibility
  listAvailableDatasets,
  searchDatasets
};
