/**
 * JSON Parser for Ohio Medicaid Formulary
 *
 * Handles JSON-formatted state formulary files (specifically Ohio SPBM)
 */

const axios = require('axios');

/**
 * Download and parse JSON formulary file
 * @param {string} url - URL to JSON file
 * @returns {Promise<Array>} Parsed formulary data
 */
async function downloadAndParseJSON(url) {
  try {
    console.log(`[JSON Parser] Downloading from ${url}...`);
    const response = await axios.get(url, {
      timeout: 120000,  // 2 minutes timeout (34 MB file)
      maxContentLength: 50 * 1024 * 1024,  // 50 MB max
      responseType: 'json'
    });

    console.log(`[JSON Parser] Downloaded ${(JSON.stringify(response.data).length / 1024 / 1024).toFixed(2)} MB`);

    // Ohio formulary is array of drug objects
    if (!Array.isArray(response.data)) {
      throw new Error('Expected JSON array, got ' + typeof response.data);
    }

    console.log(`[JSON Parser] Parsed ${response.data.length} records`);
    return response.data;

  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to download JSON: HTTP ${error.response.status} ${error.response.statusText}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Download timeout after 2 minutes');
    } else {
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

/**
 * Search Ohio formulary data
 * @param {Array} data - Parsed Ohio formulary data
 * @param {Object} params - Search parameters
 * @returns {Array} Filtered results with standardized field names
 */
function searchOhioFormulary(data, params) {
  let filtered = data;

  // Filter by NDC
  if (params.ndc) {
    const normalizedNDC = params.ndc.replace(/-/g, '');
    filtered = filtered.filter(row => {
      const rowNDC = (row.NDC || '').replace(/-/g, '');
      return rowNDC.includes(normalizedNDC);
    });
  }

  // Filter by generic name (search in label name - Ohio doesn't have separate generic field)
  if (params.generic_name) {
    const searchTerm = params.generic_name.toLowerCase();
    filtered = filtered.filter(row =>
      (row.NDC_LABEL_NAME || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by label/brand name
  if (params.label_name) {
    const searchTerm = params.label_name.toLowerCase();
    filtered = filtered.filter(row =>
      (row.NDC_LABEL_NAME || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by prior authorization requirement
  if (params.requires_pa !== undefined) {
    filtered = filtered.filter(row =>
      (row.PRIOR_AUTHORIZATION1 === 'Y') === params.requires_pa
    );
  }

  // Filter by step therapy requirement
  if (params.step_therapy !== undefined) {
    filtered = filtered.filter(row => {
      const hasStepTherapy = row.STEP_THERAPY && row.STEP_THERAPY.trim() !== '';
      return hasStepTherapy === params.step_therapy;
    });
  }

  // Filter by quantity limit presence
  if (params.has_quantity_limit !== undefined) {
    filtered = filtered.filter(row => {
      const hasQL = row.QUANTITY_LIMIT && row.QUANTITY_LIMIT.trim() !== '';
      return hasQL === params.has_quantity_limit;
    });
  }

  // Filter by brand vs generic
  if (params.is_brand !== undefined) {
    filtered = filtered.filter(row =>
      (row.GENERIC_BRAND === 'BRAND') === params.is_brand
    );
  }

  // Filter by OTC status
  if (params.otc !== undefined) {
    filtered = filtered.filter(row =>
      (row.OTC === 'Y') === params.otc
    );
  }

  // Apply limit
  const limit = params.limit || 100;
  const sliced = filtered.slice(0, limit);

  // Standardize field names to match other states
  return sliced.map(row => ({
    // Standard fields (used across all states)
    ndc: row.NDC,
    label_name: row.NDC_LABEL_NAME,
    generic_name: row.NDC_LABEL_NAME,  // Ohio doesn't have separate generic field
    is_brand: row.GENERIC_BRAND === 'BRAND',
    is_generic: row.GENERIC_BRAND === 'GENERIC',
    prior_authorization: row.PRIOR_AUTHORIZATION1 === 'Y',

    // Ohio-specific fields
    tier: row.DRUG_TIER || null,
    step_therapy: row.STEP_THERAPY || null,
    quantity_limit: row.QUANTITY_LIMIT || null,
    is_otc: row.OTC === 'Y',

    // Metadata
    formulary_name: row.Formulary_Name,
    formulary_version: row.Formulary_Version,
    effective_date: row.Formulary_Effective_Date,

    // Raw data (for debugging/advanced use)
    _raw: row
  }));
}

module.exports = {
  downloadAndParseJSON,
  searchOhioFormulary
};
