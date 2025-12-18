/**
 * Excel Parser for California Medi-Cal Formulary
 *
 * Parses the Medi-Cal Rx Approved NDC List Excel file
 */

const ExcelJS = require('exceljs');
const axios = require('axios');

/**
 * Download and parse California Medicaid Formulary Excel file
 * @param {string} url - Excel file URL
 * @returns {Promise<Array>} Parsed formulary records
 */
async function downloadAndParseExcel(url) {
  console.log(`[Excel Parser] Downloading: ${url}`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,  // 60 seconds
    maxContentLength: 10 * 1024 * 1024  // 10 MB max
  });

  console.log(`[Excel Parser] Downloaded ${response.data.byteLength} bytes`);

  // Parse Excel workbook with ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.data);

  // Get NDC sheet
  const sheet = workbook.getWorksheet('NDC');
  if (!sheet) {
    throw new Error('Sheet "NDC" not found in Excel file');
  }

  // Convert to array of arrays
  const allData = [];
  sheet.eachRow((row, rowNumber) => {
    const rowValues = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowValues[colNumber - 1] = cell.value;
    });
    allData.push(rowValues);
  });

  // Find the header row (contains 'Product ID')
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(10, allData.length); i++) {
    if (allData[i] && allData[i][0] === 'Product ID') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find header row with "Product ID"');
  }

  const headers = allData[headerRowIndex];
  const dataRows = allData.slice(headerRowIndex + 1);

  console.log(`[Excel Parser] Found headers at row ${headerRowIndex}, ${dataRows.length} data rows`);

  // Map data to objects with normalized field names
  const normalized = dataRows.map(row => ({
    ndc: row[0],  // Product ID
    label_name: row[1],  // Label Name
    generic_name: row[2],  // Generic Name
    prior_authorization: row[3] === 'Yes',  // Prior Authorization
    extended_duration_drug: row[4] === 'Yes',  // Extended Duration Drug
    cost_ceiling_tier: row[5],  // Cost Ceiling Tier
    non_capitated_drug: row[6] === 'Yes',  // Non Capitated Drug Indicator
    ccs_panel_authority: row[7]  // CCS Panel Authority
  }));

  // Filter out empty rows (sometimes Excel has blank rows at the end)
  const filtered = normalized.filter(row => row.ndc && row.generic_name);

  console.log(`[Excel Parser] Normalized ${filtered.length} valid records`);

  return filtered;
}

/**
 * Search formulary records
 * @param {Array} data - Parsed formulary data
 * @param {Object} params - Search parameters
 * @returns {Array} Matching records
 */
function searchFormulary(data, params = {}) {
  let results = data;

  // Filter by NDC
  if (params.ndc) {
    results = results.filter(row => row.ndc === params.ndc);
  }

  // Filter by generic name (case-insensitive partial match)
  if (params.generic_name) {
    const searchTerm = params.generic_name.toLowerCase();
    results = results.filter(row =>
      row.generic_name && row.generic_name.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by label/brand name (case-insensitive partial match)
  if (params.label_name) {
    const searchTerm = params.label_name.toLowerCase();
    results = results.filter(row =>
      row.label_name && row.label_name.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by PA requirement
  if (params.requires_pa !== undefined) {
    results = results.filter(row => row.prior_authorization === params.requires_pa);
  }

  // Filter by extended duration eligibility
  if (params.extended_duration !== undefined) {
    results = results.filter(row => row.extended_duration_drug === params.extended_duration);
  }

  // Filter by cost ceiling tier (Brand/Generic)
  if (params.tier) {
    const tierUpper = params.tier.toUpperCase();
    results = results.filter(row =>
      row.cost_ceiling_tier && row.cost_ceiling_tier.toUpperCase() === tierUpper
    );
  }

  // Limit results
  if (params.limit) {
    results = results.slice(0, params.limit);
  }

  return results;
}

module.exports = {
  downloadAndParseExcel,
  searchFormulary
};
