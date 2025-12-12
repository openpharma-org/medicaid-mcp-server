/**
 * Text Parser for Texas Medicaid Formulary
 *
 * Parses the Texas VDP pipe-delimited formulary file
 */

const axios = require('axios');

/**
 * Download and parse Texas Medicaid Formulary pipe-delimited text file
 * @param {string} url - Text file URL
 * @returns {Promise<Array>} Parsed formulary records
 */
async function downloadAndParseText(url) {
  console.log(`[Text Parser] Downloading: ${url}`);

  const response = await axios.get(url, {
    responseType: 'text',
    timeout: 60000,  // 60 seconds
    maxContentLength: 10 * 1024 * 1024  // 10 MB max
  });

  console.log(`[Text Parser] Downloaded ${response.data.length} characters`);

  // Split into lines
  const lines = response.data.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('Empty file or no data');
  }

  // First line is header
  const headers = lines[0].split('|');
  console.log(`[Text Parser] Found ${headers.length} columns`);

  // Parse data rows
  const dataRows = lines.slice(1);

  const normalized = dataRows.map(line => {
    const values = line.split('|');

    return {
      // Drug identification
      ndc: values[6],  // Drug_NDC
      label_name: values[7],  // Drug_Descr
      generic_name: values[0],  // Drug_Generic
      manufacturer: values[53],  // Drug_manufacturer

      // Prior authorization
      prior_authorization: values[32] === 'Yes' || values[35] === 'Yes',  // Drug_PDL_pa_required OR Drug_Clinical_pa_required
      pdl_pa_required: values[32] === 'Yes',  // Drug_PDL_pa_required
      clinical_pa_required: values[35] === 'Yes',  // Drug_Clinical_pa_required

      // Pricing (all prices in dollars)
      retail_price: parseFloat(values[36]) || null,  // Drug_Retail
      ltc_price: parseFloat(values[38]) || null,  // Drug_LTC (Long-term care)
      specialty_price: parseFloat(values[40]) || null,  // Drug_SPC (Specialty)
      vaccine_price: parseFloat(values[42]) || null,  // Drug_VAC
      price_340b: parseFloat(values[10]) || null,  // Drug_340B
      retail_price_effective_date: values[37],  // Drug_Retail_EffDate

      // Program eligibility
      medicaid_active: values[13] === 'Yes',  // Drug_Med_Code
      chip_active: values[18] === 'Yes',  // Drug_chip_code
      cshcn_active: values[22] === 'Yes',  // Drug_cshcn_code (Children with Special Health Care Needs)
      khc_active: values[27] === 'Yes',  // Drug_khc_code (Kids Health Care)
      htw_active: values[29] !== 'No',  // Drug_htw_code (Healthy Texas Women)
      htwplus_active: values[54] === 'Yes',  // Drug_HTWPLUS_code

      // Effective/end dates
      medicaid_effective_date: values[11],  // Drug_med_Effdate
      medicaid_end_date: values[12],  // Drug_med_EndDate
      chip_effective_date: values[16],  // Drug_chip_EffDate
      chip_end_date: values[17],  // Drug_chip_EndDate

      // Clinical information
      therapeutic_class: values[44],  // Drug_MKID_Desc
      legend_status: values[31],  // Drug_legend_status (Prescription Required/OTC)
      medicare_part_b: values[58] === 'Yes',  // Drug_medicare_B
      medicare_part_d: values[59] === 'Yes',  // Drug_medicare_D

      // Special use indicators
      family_planning: values[2] === 'Yes',  // Drug_limit_fp
      diabetic_supplies: values[3] === 'Yes',  // Drug_limit_ds
      larc_drug: values[50] === 'Yes',  // Drug_limit_larc (Long-Acting Reversible Contraception)
      refill_utilization: values[5],  // Drug_limit_refill (percentage, e.g., "75%")

      // Package information
      package_size: values[8],  // Drug_Pkg
      package_unit: values[9],  // Drug_Unit

      // Additional metadata
      record_id: values[45],  // ID
      create_date: values[63],  // Drug_CreateDate
      tnp_indicator: values[62]  // Drug_TNP
    };
  });

  // Filter out empty rows
  const filtered = normalized.filter(row => row.ndc && row.generic_name);

  console.log(`[Text Parser] Normalized ${filtered.length} valid records`);

  return filtered;
}

/**
 * Search Texas formulary records
 * @param {Array} data - Parsed formulary data
 * @param {Object} params - Search parameters
 * @returns {Array} Matching records
 */
function searchTexasFormulary(data, params = {}) {
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

  // Filter by PA requirement (any PA - PDL or clinical)
  if (params.requires_pa !== undefined) {
    results = results.filter(row => row.prior_authorization === params.requires_pa);
  }

  // Filter by PDL PA specifically
  if (params.pdl_pa !== undefined) {
    results = results.filter(row => row.pdl_pa_required === params.pdl_pa);
  }

  // Filter by clinical PA specifically
  if (params.clinical_pa !== undefined) {
    results = results.filter(row => row.clinical_pa_required === params.clinical_pa);
  }

  // Filter by program
  if (params.program) {
    const programUpper = params.program.toLowerCase();
    results = results.filter(row => {
      switch (programUpper) {
        case 'medicaid': return row.medicaid_active;
        case 'chip': return row.chip_active;
        case 'cshcn': return row.cshcn_active;
        case 'khc': return row.khc_active;
        case 'htw': return row.htw_active;
        case 'htwplus': return row.htwplus_active;
        default: return true;
      }
    });
  }

  // Filter by price range
  if (params.max_price !== undefined) {
    results = results.filter(row =>
      row.retail_price !== null && row.retail_price <= params.max_price
    );
  }

  if (params.min_price !== undefined) {
    results = results.filter(row =>
      row.retail_price !== null && row.retail_price >= params.min_price
    );
  }

  // Limit results
  if (params.limit) {
    results = results.slice(0, params.limit);
  }

  return results;
}

module.exports = {
  downloadAndParseText,
  searchTexasFormulary
};
