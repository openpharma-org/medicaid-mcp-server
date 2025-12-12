/**
 * Illinois Medicaid Formulary Enrichment
 *
 * Cross-state NDC matching strategy:
 * - Load Illinois PDL (5,729 drugs, drug names only)
 * - Match IL drug names to CA/NY/OH formularies
 * - Get NDC codes from matched drugs
 * - Enrich with NADAC pricing
 * - 51-52% estimated match rate (2,900+ of 5,729 drugs)
 * - Ohio adds unique coverage for medical devices/supplies
 */

const { getFormularyByState } = require('./datasets');
const { downloadAndParseExcel } = require('./excel-parser');
const { downloadAndParseCSV } = require('./csv-parser');
const { downloadAndParseJSON } = require('./json-parser');
const { cache } = require('./cache-manager');
const XLSX = require('xlsx');
const axios = require('axios');

/**
 * Parse Illinois PDL from raw Excel data
 * @param {Array} rows - Raw rows from Excel parser (array of arrays)
 * @returns {Array} Illinois PDL drugs (drug names, PA requirements)
 */
function parseIllinoisPDL(rows) {
  console.log(`[IL Enrichment] Parsing Illinois PDL...`);

  // IL PDL structure (from inspection):
  // Row 40 (index 39): Headers ["Drug Class", "Drug Name", "Dosage Form", "PDL Status", "", ""]
  // Row 41+ (index 40+): Drug data
  // Column A (index 0): Drug Class (only on first drug in class)
  // Column B (index 1): Drug Name
  // Column C (index 2): Dosage Form
  // Column D/E (index 3/4): PDL Status (one of these has the status)

  const drugs = [];

  // Start from row 41 (index 40) - data rows
  for (let i = 40; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;  // Skip empty/invalid rows

    // Extract fields from array (row[0]=Drug Class, row[1]=Drug Name, etc.)
    const drugName = String(row[1] || '').trim();
    const dosageForm = String(row[2] || '').trim();
    const pdlStatus = String(row[4] || row[5] || row[3] || '').trim();  // Check columns D, E, F

    if (drugName && drugName.length > 0) {
      drugs.push({
        drug_name: drugName,
        dosage_form: dosageForm,
        pdl_status: pdlStatus,
        prior_authorization: pdlStatus.toUpperCase().includes('PA') || pdlStatus.toUpperCase().includes('PRIOR')
      });
    }
  }

  console.log(`[IL Enrichment] Parsed ${drugs.length} drugs from IL PDL`);
  return drugs;
}

/**
 * Enrich Illinois drugs with NDC codes via cross-state matching
 * @param {Array} ilDrugs - Illinois PDL drugs
 * @param {Array} caFormulary - California formulary
 * @param {Array} nyFormulary - New York formulary
 * @param {Array} ohFormulary - Ohio formulary
 * @returns {Array} Enriched IL drugs with NDC codes (where available)
 */
function enrichIllinoisWithCrossStateNDC(ilDrugs, caFormulary, nyFormulary, ohFormulary) {
  console.log(`[IL Enrichment] Starting cross-state NDC matching...`);
  console.log(`  - IL drugs: ${ilDrugs.length}`);
  console.log(`  - CA formulary: ${caFormulary.length} drugs`);
  console.log(`  - NY formulary: ${nyFormulary.length} drugs`);
  console.log(`  - OH formulary: ${ohFormulary.length} drugs`);

  // Create lookup maps for CA and NY (by drug name, uppercase)
  const caMap = new Map();
  caFormulary.forEach(drug => {
    const name = (drug.label_name || drug.generic_name || '').toUpperCase().trim();
    if (name) {
      if (!caMap.has(name)) {
        caMap.set(name, []);
      }
      caMap.get(name).push(drug);
    }
  });

  const nyMap = new Map();
  nyFormulary.forEach(drug => {
    const name = (drug.label_name || drug.generic_name || '').toUpperCase().trim();
    if (name) {
      if (!nyMap.has(name)) {
        nyMap.set(name, []);
      }
      nyMap.get(name).push(drug);
    }
  });

  const ohMap = new Map();
  ohFormulary.forEach(drug => {
    const name = (drug.NDC_LABEL_NAME || '').toUpperCase().trim();
    if (name) {
      if (!ohMap.has(name)) {
        ohMap.set(name, []);
      }
      ohMap.get(name).push({
        ndc: drug.NDC,
        label_name: drug.NDC_LABEL_NAME,
        generic_name: drug.NDC_LABEL_NAME
      });
    }
  });

  console.log(`  - CA unique names: ${caMap.size}`);
  console.log(`  - NY unique names: ${nyMap.size}`);
  console.log(`  - OH unique names: ${ohMap.size}`);

  // Match IL drugs to CA/NY
  let matchCount = 0;
  const enriched = ilDrugs.map(ilDrug => {
    const ilName = ilDrug.drug_name.toUpperCase().trim();

    // Try exact match in CA
    let caMatch = caMap.get(ilName);
    if (caMatch && caMatch.length > 0) {
      matchCount++;
      return {
        ...ilDrug,
        ndc: caMatch[0].ndc,
        generic_name: caMatch[0].generic_name,
        label_name: caMatch[0].label_name,
        ndc_source: 'CA',
        match_confidence: 'high'
      };
    }

    // Try exact match in NY
    let nyMatch = nyMap.get(ilName);
    if (nyMatch && nyMatch.length > 0) {
      matchCount++;
      return {
        ...ilDrug,
        ndc: nyMatch[0].ndc,
        generic_name: nyMatch[0].generic_name,
        label_name: nyMatch[0].label_name,
        ndc_source: 'NY',
        match_confidence: 'high'
      };
    }

    // Try exact match in OH
    let ohMatch = ohMap.get(ilName);
    if (ohMatch && ohMatch.length > 0) {
      matchCount++;
      return {
        ...ilDrug,
        ndc: ohMatch[0].ndc,
        generic_name: ohMatch[0].generic_name,
        label_name: ohMatch[0].label_name,
        ndc_source: 'OH',
        match_confidence: 'high'
      };
    }

    // Try partial match (first 3 words) for multi-word drugs
    const firstWords = ilName.split(' ').slice(0, 3).join(' ');
    if (firstWords.length > 0) {
      for (const [caName, caDrugs] of caMap.entries()) {
        if (caName.startsWith(firstWords) || firstWords.startsWith(caName.split(' ').slice(0, 3).join(' '))) {
          matchCount++;
          return {
            ...ilDrug,
            ndc: caDrugs[0].ndc,
            generic_name: caDrugs[0].generic_name,
            label_name: caDrugs[0].label_name,
            ndc_source: 'CA',
            match_confidence: 'medium'
          };
        }
      }

      for (const [nyName, nyDrugs] of nyMap.entries()) {
        if (nyName.startsWith(firstWords) || firstWords.startsWith(nyName.split(' ').slice(0, 3).join(' '))) {
          matchCount++;
          return {
            ...ilDrug,
            ndc: nyDrugs[0].ndc,
            generic_name: nyDrugs[0].generic_name,
            label_name: nyDrugs[0].label_name,
            ndc_source: 'NY',
            match_confidence: 'medium'
          };
        }
      }

      for (const [ohName, ohDrugs] of ohMap.entries()) {
        if (ohName.startsWith(firstWords) || firstWords.startsWith(ohName.split(' ').slice(0, 3).join(' '))) {
          matchCount++;
          return {
            ...ilDrug,
            ndc: ohDrugs[0].ndc,
            generic_name: ohDrugs[0].generic_name,
            label_name: ohDrugs[0].label_name,
            ndc_source: 'OH',
            match_confidence: 'medium'
          };
        }
      }
    }

    // No match - return drug without NDC
    return {
      ...ilDrug,
      ndc: null,
      generic_name: null,
      label_name: ilDrug.drug_name,
      ndc_source: null,
      match_confidence: 'none'
    };
  });

  const matchRate = (matchCount / ilDrugs.length * 100).toFixed(1);
  console.log(`[IL Enrichment] Cross-state matching complete:`);
  console.log(`  - Matched: ${matchCount} / ${ilDrugs.length} (${matchRate}%)`);
  console.log(`  - No match: ${ilDrugs.length - matchCount} drugs`);

  return enriched;
}

/**
 * Download and parse Illinois PDL Excel file
 * @param {string} url - Illinois PDL Excel URL
 * @returns {Promise<Array>} Raw Illinois PDL rows
 */
async function downloadIllinoisPDL(url) {
  console.log(`[IL Enrichment] Downloading Illinois PDL from ${url}...`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,  // 60 seconds
    maxContentLength: 10 * 1024 * 1024  // 10 MB max
  });

  console.log(`[IL Enrichment] Downloaded ${response.data.byteLength} bytes`);

  // Parse Excel workbook
  const workbook = XLSX.read(response.data, { type: 'buffer' });

  // Get "Published PDL" sheet
  const sheetName = 'Published PDL';
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" not found in Illinois PDL Excel file`);
  }

  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (row-based)
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,  // Return as array of arrays
    defval: ''
  });

  console.log(`[IL Enrichment] Parsed ${rows.length} rows from Illinois PDL`);
  return rows;
}

/**
 * Get enriched Illinois formulary data
 * @returns {Promise<Array>} Illinois formulary enriched with CA/NY/OH NDC codes
 */
async function getEnrichedIllinoisFormulary() {
  const ilDataset = getFormularyByState('IL');
  const caDataset = getFormularyByState('CA');
  const nyDataset = getFormularyByState('NY');
  const ohDataset = getFormularyByState('OH');

  return cache.get('IL_ENRICHED_FORMULARY', async () => {
    // Step 1: Load Illinois PDL (raw Excel rows)
    const ilRawData = await downloadIllinoisPDL(ilDataset.downloadUrl);
    const ilDrugs = parseIllinoisPDL(ilRawData);

    // Step 2: Load CA, NY, and OH formularies (from cache if available)
    const caFormulary = await cache.get('CA_FORMULARY', async () => {
      return downloadAndParseExcel(caDataset.downloadUrl);
    }, caDataset.cacheTime);

    const nyFormulary = await cache.get('NY_FORMULARY', async () => {
      return downloadAndParseCSV(nyDataset.downloadUrl);
    }, nyDataset.cacheTime);

    const ohFormulary = await cache.get('OH_FORMULARY', async () => {
      return downloadAndParseJSON(ohDataset.downloadUrl);
    }, ohDataset.cacheTime);

    // Step 3: Enrich IL drugs with cross-state NDC matching
    const enriched = enrichIllinoisWithCrossStateNDC(ilDrugs, caFormulary, nyFormulary, ohFormulary);

    return enriched;
  }, ilDataset.cacheTime);
}

/**
 * Search Illinois formulary (enriched with CA/NY NDC codes)
 * @param {Array} data - Enriched Illinois formulary
 * @param {Object} params - Search parameters
 * @returns {Array} Filtered results
 */
function searchIllinoisFormulary(data, params) {
  let filtered = data;

  // Filter by NDC (only matches drugs with NDC codes)
  if (params.ndc) {
    const normalizedNDC = params.ndc.replace(/-/g, '');
    filtered = filtered.filter(row => {
      if (!row.ndc) return false;
      const rowNDC = (row.ndc || '').replace(/-/g, '');
      return rowNDC.includes(normalizedNDC);
    });
  }

  // Filter by generic name
  if (params.generic_name) {
    const searchTerm = params.generic_name.toLowerCase();
    filtered = filtered.filter(row =>
      (row.generic_name || row.drug_name || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by label/brand name
  if (params.label_name) {
    const searchTerm = params.label_name.toLowerCase();
    filtered = filtered.filter(row =>
      (row.label_name || row.drug_name || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by prior authorization requirement
  if (params.requires_pa !== undefined) {
    filtered = filtered.filter(row =>
      row.prior_authorization === params.requires_pa
    );
  }

  // Filter by match confidence (high, medium, none)
  if (params.match_confidence) {
    filtered = filtered.filter(row =>
      row.match_confidence === params.match_confidence
    );
  }

  // Filter by NDC availability
  if (params.has_ndc !== undefined) {
    filtered = filtered.filter(row =>
      (row.ndc !== null) === params.has_ndc
    );
  }

  // Apply limit
  const limit = params.limit || 100;
  return filtered.slice(0, limit);
}

module.exports = {
  getEnrichedIllinoisFormulary,
  searchIllinoisFormulary
};
