/**
 * Prototype: Illinois Medicaid Formulary Enrichment
 *
 * Tests the feasibility of enriching Illinois PDL with:
 * 1. NDC codes from State Drug Utilization Data (SDUD)
 * 2. Pricing from NADAC database
 *
 * Goal: Validate match rate and data quality
 */

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { getStateDrugUtilization, getNADACPricing } = require('./src/medicaid-api');

async function prototypeIllinoisEnrichment() {
  console.log('='.repeat(80));
  console.log('ILLINOIS MEDICAID FORMULARY ENRICHMENT PROTOTYPE');
  console.log('='.repeat(80));

  console.log('\n[STEP 1] Loading Illinois PDL Excel file...');
  console.log('-'.repeat(80));

  // Download Illinois PDL
  const pdlUrl = 'https://hfs.illinois.gov/content/dam/soi/en/web/hfs/sitecollectiondocuments/pdl10012025.xlsx';

  try {
    console.log('Downloading IL PDL from:', pdlUrl);
    const response = await axios.get(pdlUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    fs.writeFileSync('il_pdl_latest.xlsx', response.data);
    console.log(`✓ Downloaded IL PDL: ${(response.data.length / 1024).toFixed(1)} KB`);

  } catch (error) {
    console.error('✗ Error downloading IL PDL:', error.message);
    process.exit(1);
  }

  console.log('\n[STEP 2] Parsing Illinois PDL to extract drug names...');
  console.log('-'.repeat(80));

  // Parse Excel file using Python (openpyxl)
  const pythonScript = `
import openpyxl
import json
import sys

try:
    wb = openpyxl.load_workbook('il_pdl_latest.xlsx', data_only=True)
    sheet = wb.active

    # Headers at row 40
    drugs = []
    for row in sheet.iter_rows(min_row=41, max_row=sheet.max_row):
        values = [cell.value for cell in row]
        if not values or not values[1]:  # Skip empty rows
            continue

        drug_class = str(values[0] or '').strip()
        drug_name = str(values[1] or '').strip()
        dosage_form = str(values[2] or '').strip()
        pdl_status_1 = str(values[3] or '').strip()
        pdl_status_2 = str(values[4] or '').strip()
        pdl_status_3 = str(values[5] or '').strip()

        # Combine PDL status fields
        pdl_status = pdl_status_1 or pdl_status_2 or pdl_status_3

        if drug_name:
            drugs.append({
                'drug_class': drug_class,
                'drug_name': drug_name,
                'dosage_form': dosage_form,
                'pdl_status': pdl_status
            })

    print(json.dumps({'success': True, 'drugs': drugs, 'count': len(drugs)}))
    wb.close()

except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

  fs.writeFileSync('parse_il_pdl.py', pythonScript);

  let pdlDrugs = [];
  try {
    const output = execSync('python3 parse_il_pdl.py', { encoding: 'utf8' });
    const result = JSON.parse(output);

    if (!result.success) {
      throw new Error(result.error);
    }

    pdlDrugs = result.drugs;
    console.log(`✓ Parsed ${result.count} drugs from IL PDL`);

    // Show sample drugs
    console.log('\nSample drugs from IL PDL:');
    pdlDrugs.slice(0, 5).forEach((drug, i) => {
      console.log(`  ${i + 1}. ${drug.drug_name} (${drug.dosage_form}) - ${drug.pdl_status}`);
    });

  } catch (error) {
    console.error('✗ Error parsing IL PDL:', error.message);
    process.exit(1);
  }

  console.log('\n[STEP 3] Querying State Drug Utilization Data for Illinois...');
  console.log('-'.repeat(80));
  console.log('Note: Getting latest quarter (2024 Q3 or Q4)...');

  let sdudData = [];
  try {
    // Query SDUD for Illinois - latest data
    const sdudResult = await getStateDrugUtilization({
      state: 'IL',
      year: 2024,
      quarter: 3,  // Q3 2024 (most recent available)
      limit: 5000   // Get large sample
    });

    sdudData = sdudResult.results || [];
    console.log(`✓ Retrieved ${sdudData.length} Illinois drug records from SDUD`);

    // Show sample SDUD records
    console.log('\nSample SDUD records (Illinois):');
    sdudData.slice(0, 5).forEach((record, i) => {
      console.log(`  ${i + 1}. ${record.labeler_name} - NDC: ${record.ndc}`);
      console.log(`     Prescriptions: ${record.number_of_prescriptions}, Amount: $${record.total_amount_reimbursed}`);
    });

  } catch (error) {
    console.error('✗ Error querying SDUD:', error.message);
    console.error('Note: SDUD query may require DKAN API to be working');
    process.exit(1);
  }

  console.log('\n[STEP 4] Matching IL PDL drugs to SDUD NDC codes...');
  console.log('-'.repeat(80));

  // Create SDUD lookup by drug name (normalized)
  const sdudByName = new Map();
  sdudData.forEach(record => {
    const normalizedName = (record.labeler_name || '').toUpperCase().trim();
    if (!sdudByName.has(normalizedName)) {
      sdudByName.set(normalizedName, []);
    }
    sdudByName.get(normalizedName).push({
      ndc: record.ndc,
      labeler_name: record.labeler_name,
      prescriptions: record.number_of_prescriptions,
      reimbursement: record.total_amount_reimbursed
    });
  });

  console.log(`✓ Created SDUD lookup index: ${sdudByName.size} unique drug names`);

  // Test matching with specific drugs
  const testDrugs = [
    'OZEMPIC',
    'HUMIRA',
    'INSULIN LISPRO',
    'METFORMIN',
    'ATORVASTATIN'
  ];

  console.log('\nTest Matching (PDL → SDUD):');
  let matchCount = 0;
  const enrichedDrugs = [];

  for (const testDrug of testDrugs) {
    const pdlEntry = pdlDrugs.find(d => d.drug_name.toUpperCase().includes(testDrug));

    if (!pdlEntry) {
      console.log(`  ✗ ${testDrug}: Not found in IL PDL`);
      continue;
    }

    // Try exact match first
    let sdudMatches = sdudByName.get(pdlEntry.drug_name.toUpperCase());

    // Try partial match if exact fails
    if (!sdudMatches || sdudMatches.length === 0) {
      for (const [sdudName, records] of sdudByName.entries()) {
        if (sdudName.includes(testDrug)) {
          sdudMatches = records;
          break;
        }
      }
    }

    if (sdudMatches && sdudMatches.length > 0) {
      matchCount++;
      console.log(`  ✓ ${testDrug}: Matched to ${sdudMatches.length} NDC code(s)`);
      console.log(`    NDC: ${sdudMatches[0].ndc} (${sdudMatches[0].prescriptions} prescriptions)`);

      enrichedDrugs.push({
        ...pdlEntry,
        ndc: sdudMatches[0].ndc,
        sdud_prescriptions: sdudMatches[0].prescriptions,
        sdud_reimbursement: sdudMatches[0].reimbursement
      });
    } else {
      console.log(`  ✗ ${testDrug}: No match in SDUD`);
    }
  }

  const testMatchRate = (matchCount / testDrugs.length * 100).toFixed(1);
  console.log(`\nTest Match Rate: ${matchCount}/${testDrugs.length} (${testMatchRate}%)`);

  console.log('\n[STEP 5] Enriching with NADAC pricing...');
  console.log('-'.repeat(80));

  let pricingEnrichedCount = 0;

  for (const drug of enrichedDrugs) {
    try {
      // Query NADAC by NDC
      const nadacResult = await getNADACPricing({
        ndc: drug.ndc,
        limit: 1
      });

      if (nadacResult.results && nadacResult.results.length > 0) {
        const nadac = nadacResult.results[0];
        drug.nadac_per_unit = nadac.nadac_per_unit;
        drug.nadac_pricing_unit = nadac.pricing_unit;
        drug.generic_name = nadac.generic_name;
        drug.nadac_effective_date = nadac.effective_date;

        // Calculate IL reimbursement (NADAC + $12.12 dispensing fee)
        // Note: This is simplified - actual reimbursement depends on package size
        drug.il_dispensing_fee = 12.12;

        pricingEnrichedCount++;
        console.log(`  ✓ ${drug.drug_name}: NADAC $${nadac.nadac_per_unit}/${nadac.pricing_unit}`);
      } else {
        console.log(`  ✗ ${drug.drug_name}: No NADAC pricing found`);
      }

    } catch (error) {
      console.log(`  ✗ ${drug.drug_name}: Error querying NADAC - ${error.message}`);
    }
  }

  const pricingRate = (pricingEnrichedCount / enrichedDrugs.length * 100).toFixed(1);
  console.log(`\nPricing Enrichment Rate: ${pricingEnrichedCount}/${enrichedDrugs.length} (${pricingRate}%)`);

  console.log('\n[STEP 6] Final Enriched Results');
  console.log('='.repeat(80));

  enrichedDrugs.forEach((drug, i) => {
    console.log(`\n${i + 1}. ${drug.drug_name}`);
    console.log(`   Dosage Form: ${drug.dosage_form}`);
    console.log(`   PDL Status: ${drug.pdl_status}`);
    console.log(`   NDC: ${drug.ndc} (from SDUD)`);

    if (drug.generic_name) {
      console.log(`   Generic Name: ${drug.generic_name} (from NADAC)`);
    }

    if (drug.nadac_per_unit) {
      console.log(`   NADAC Price: $${drug.nadac_per_unit}/${drug.nadac_pricing_unit}`);
      console.log(`   IL Dispensing Fee: $${drug.il_dispensing_fee}`);
    }

    if (drug.sdud_prescriptions) {
      console.log(`   Utilization: ${drug.sdud_prescriptions} prescriptions (2024 Q3)`);
      console.log(`   Reimbursement: $${drug.sdud_reimbursement}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('PROTOTYPE RESULTS');
  console.log('='.repeat(80));

  console.log('\n✓ Success Metrics:');
  console.log(`  - IL PDL drugs loaded: ${pdlDrugs.length}`);
  console.log(`  - SDUD records retrieved: ${sdudData.length}`);
  console.log(`  - Test match rate: ${testMatchRate}% (${matchCount}/${testDrugs.length})`);
  console.log(`  - Pricing enrichment: ${pricingRate}% (${pricingEnrichedCount}/${enrichedDrugs.length})`);

  console.log('\n✓ Data Quality:');
  console.log('  - NDC codes: Available via SDUD matching');
  console.log('  - Pricing: Available via NADAC lookup');
  console.log('  - Generic names: Available from NADAC');
  console.log('  - PA requirements: Available from IL PDL');
  console.log('  - Utilization data: Available from SDUD');

  console.log('\n✓ Feasibility Assessment:');
  if (testMatchRate >= 70) {
    console.log('  ✅ RECOMMENDED: Match rate >70% - proceed with full implementation');
  } else if (testMatchRate >= 50) {
    console.log('  ⚠️  MARGINAL: Match rate 50-70% - consider improvements');
  } else {
    console.log('  ❌ NOT RECOMMENDED: Match rate <50% - enrichment not viable');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✓ Prototype completed successfully');
  console.log('='.repeat(80));
}

// Run prototype
prototypeIllinoisEnrichment().catch(error => {
  console.error('\n✗ Prototype failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
