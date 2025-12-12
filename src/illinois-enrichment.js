/**
 * Illinois Medicaid Formulary Enrichment
 *
 * Cross-state NDC matching strategy:
 * - Load Illinois PDL (5,723 drugs, drug names only)
 * - Match IL drug names to CA/NY formularies
 * - Get NDC codes from matched drugs
 * - Enrich with NADAC pricing
 * - 65% match rate (3,720 of 5,723 drugs)
 */

const { getFormularyByState } = require('./datasets');
const { downloadAndParseExcel } = require('./excel-parser');
const { downloadAndParseCSV } = require('./csv-parser');
const { cache } = require('./cache-manager');

/**
 * Parse Illinois PDL from raw Excel data
 * @param {Array} rows - Raw rows from Excel parser
 * @returns {Array} Illinois PDL drugs (drug names, PA requirements)
 */
function parseIllinoisPDL(rows) {
  console.log(`[IL Enrichment] Parsing Illinois PDL...`);

  // IL PDL structure (from previous analysis):
  // Row 41 onward: drug data
  // Column B (index 1): Drug Name
  // Column C (index 2): Dosage Form
  // Column E/F (index 4/5): PDL Status

  const drugs = [];

  // IL PDL file has headers and content starting around row 40
  for (let i = 40; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;  // Skip empty rows

    // Extract fields (row is object with column headers as keys)
    const drugName = String(row['Drug Name'] || row['B'] || row[Object.keys(row)[1]] || '').trim();
    const dosageForm = String(row['Dosage Form'] || row['C'] || row[Object.keys(row)[2]] || '').trim();
    const pdlStatus = String(row['PDL Status'] || row['E'] || row['F'] || row[Object.keys(row)[4]] || row[Object.keys(row)[5]] || '').trim();

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
 * @returns {Array} Enriched IL drugs with NDC codes (where available)
 */
function enrichIllinoisWithCrossStateNDC(ilDrugs, caFormulary, nyFormulary) {
  console.log(`[IL Enrichment] Starting cross-state NDC matching...`);
  console.log(`  - IL drugs: ${ilDrugs.length}`);
  console.log(`  - CA formulary: ${caFormulary.length} drugs`);
  console.log(`  - NY formulary: ${nyFormulary.length} drugs`);

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

  console.log(`  - CA unique names: ${caMap.size}`);
  console.log(`  - NY unique names: ${nyMap.size}`);

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
 * Get enriched Illinois formulary data
 * @returns {Promise<Array>} Illinois formulary enriched with CA/NY NDC codes
 */
async function getEnrichedIllinoisFormulary() {
  const ilDataset = getFormularyByState('IL');
  const caDataset = getFormularyByState('CA');
  const nyDataset = getFormularyByState('NY');

  return cache.get('IL_ENRICHED_FORMULARY', async () => {
    // Step 1: Load Illinois PDL using existing Excel parser
    console.log(`[IL Enrichment] Downloading Illinois PDL from ${ilDataset.downloadUrl}...`);
    const ilRawData = await downloadAndParseExcel(ilDataset.downloadUrl);
    const ilDrugs = parseIllinoisPDL(ilRawData);

    // Step 2: Load CA and NY formularies (from cache if available)
    const caFormulary = await cache.get('CA_FORMULARY', async () => {
      return downloadAndParseExcel(caDataset.downloadUrl);
    }, caDataset.cacheTime);

    const nyFormulary = await cache.get('NY_FORMULARY', async () => {
      return downloadAndParseCSV(nyDataset.downloadUrl);
    }, nyDataset.cacheTime);

    // Step 3: Enrich IL drugs with cross-state NDC matching
    const enriched = enrichIllinoisWithCrossStateNDC(ilDrugs, caFormulary, nyFormulary);

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
