/**
 * CSV Parser for New York Medicaid Formulary
 *
 * Parses standard CSV format from eMedNY
 * Source: https://docs.emedny.org/ReimbursableDrugs/MedReimbDrugsFormulary.csv
 */

const axios = require('axios');

/**
 * Download and parse New York Medicaid formulary CSV
 * @param {string} url - CSV download URL
 * @returns {Promise<Array>} Normalized formulary data
 */
async function downloadAndParseCSV(url) {
  console.log('[CSV Parser] Downloading NY Medicaid formulary...');

  const response = await axios.get(url, {
    responseType: 'text',
    timeout: 60000,  // 60 seconds
    maxContentLength: 10 * 1024 * 1024  // 10 MB max
  });

  console.log('[CSV Parser] Download complete, parsing CSV...');

  // Split into lines
  const lines = response.data.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty or malformed');
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  console.log(`[CSV Parser] Found ${headers.length} columns`);

  // Column indices (based on NY Medicaid CSV structure)
  const COL_TYPE = 0;           // TYPE (BND, GEN)
  const COL_NDC = 1;            // NDC
  const COL_MRA_COST = 2;       // MRA COST
  const COL_ALT_COST = 3;       // ALTERNATE COST
  const COL_DESCRIPTION = 4;    // DESCRIPTION
  const COL_PA = 5;             // PA (Prior Authorization code)
  const COL_LABELER = 6;        // LABELER (manufacturer)
  const COL_BASIS_MRA = 7;      // BASIS OF MRA (ML, EA)
  const COL_OTC = 8;            // OTC IND
  const COL_GENERIC = 9;        // GENERIC NAME
  const COL_RX_TYPE = 10;       // RX TYPE
  const COL_EFFECTIVE = 11;     // EFFECTIVE DATE
  const COL_MAX_QTY = 12;       // MAXIMUM QUANTITIES
  const COL_PREFERRED = 13;     // PREFERRED DRUG CODE
  const COL_AGE_RANGE = 14;     // AGE RANGE
  const COL_REFILLS = 15;       // REFILLS ALLOWED

  // Parse data rows
  const dataRows = lines.slice(1);
  const normalized = [];

  for (let i = 0; i < dataRows.length; i++) {
    const line = dataRows[i];
    const values = parseCSVLine(line);

    if (values.length < 16) {
      console.warn(`[CSV Parser] Skipping malformed row ${i + 2}: insufficient columns`);
      continue;
    }

    // Extract NDC and generic name
    const ndc = (values[COL_NDC] || '').trim();
    const genericName = (values[COL_GENERIC] || '').trim();

    // Skip rows without NDC or generic name
    if (!ndc || !genericName) {
      continue;
    }

    // Parse pricing
    const mraCost = parseFloat(values[COL_MRA_COST]) || null;
    const altCost = parseFloat(values[COL_ALT_COST]) || null;

    // Parse PA code
    const paCode = (values[COL_PA] || '').trim();
    const requiresPA = paCode !== '0' && paCode !== '';

    // Parse preferred status
    const preferredCode = (values[COL_PREFERRED] || '').trim();
    const isPreferred = preferredCode === 'Y';

    // Parse quantity limits
    const maxQuantity = parseFloat(values[COL_MAX_QTY]) || null;

    // Parse type (Brand vs Generic)
    const type = (values[COL_TYPE] || '').trim();

    normalized.push({
      // Core fields
      ndc: ndc,
      label_name: (values[COL_DESCRIPTION] || '').trim(),
      generic_name: genericName,
      manufacturer: (values[COL_LABELER] || '').trim(),

      // Drug type
      drug_type: type,  // BND (Brand) or GEN (Generic)
      is_brand: type === 'BND',
      is_generic: type === 'GEN',

      // Pricing (MRA = Maximum Reimbursable Amount)
      mra_cost: mraCost,
      mra_per_unit: mraCost,  // Alias for consistency
      alternate_cost: altCost,
      pricing_unit: (values[COL_BASIS_MRA] || '').trim(),  // ML, EA

      // Access restrictions
      prior_authorization: requiresPA,
      pa_code: paCode,  // G, 0, or other codes
      preferred_drug: isPreferred,
      preferred_code: preferredCode,  // Y, X, or blank

      // Clinical information
      otc_indicator: (values[COL_OTC] || '').trim(),
      rx_type: (values[COL_RX_TYPE] || '').trim(),
      age_range: (values[COL_AGE_RANGE] || '').trim(),

      // Quantity management
      maximum_quantity: maxQuantity,
      refills_allowed: parseInt(values[COL_REFILLS]) || null,

      // Administrative
      effective_date: (values[COL_EFFECTIVE] || '').trim()
    });
  }

  console.log(`[CSV Parser] Parsed ${normalized.length} valid formulary records`);

  return normalized;
}

/**
 * Parse a CSV line handling quoted fields with commas
 * @param {string} line - CSV line
 * @returns {Array<string>} Parsed values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push last value
  values.push(current.trim());

  return values;
}

module.exports = {
  downloadAndParseCSV
};
