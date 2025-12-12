/**
 * Medicaid API Implementation
 *
 * CSV-based data retrieval from data.medicaid.gov
 * Uses in-memory caching with TTL for performance
 */

const { cache } = require('./cache-manager');
const { getDataset } = require('./datasets');
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

module.exports = {
  getNADACPricing,
  compareDrugPricing,
  getEnrollmentTrends,
  compareStateEnrollment,
  getDrugRebateInfo,
  listAvailableDatasets,
  searchDatasets
};
