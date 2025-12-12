/**
 * Simple Illinois Enrichment Prototype
 *
 * Tests drug name matching between IL PDL and SDUD using direct API queries
 */

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');

async function simplePrototype() {
  console.log('='.repeat(80));
  console.log('ILLINOIS ENRICHMENT PROTOTYPE (Simplified)');
  console.log('='.repeat(80));

  // Step 1: Parse IL PDL
  console.log('\n[STEP 1] Parsing Illinois PDL...');

  const pythonScript = `
import openpyxl
import json

wb = openpyxl.load_workbook('il_pdl_latest.xlsx', data_only=True)
sheet = wb.active

drugs = []
for row in sheet.iter_rows(min_row=41, max_row=sheet.max_row):
    values = [cell.value for cell in row]
    if not values or not values[1]:
        continue

    drug_name = str(values[1] or '').strip()
    if drug_name:
        drugs.append(drug_name)

print(json.dumps(drugs))
wb.close()
`;

  fs.writeFileSync('parse_pdl_simple.py', pythonScript);
  const pdlDrugs = JSON.parse(execSync('python3 parse_pdl_simple.py', { encoding: 'utf8' }));
  console.log(`✓ Parsed ${pdlDrugs.length} drugs from IL PDL`);

  // Step 2: Query SDUD via DKAN API directly
  console.log('\n[STEP 2] Querying State Drug Utilization Data (Illinois, 2024 Q4)...');

  const sdudUrl = 'https://data.medicaid.gov/api/1/datastore/query/61729e5a-7aa8-448c-8903-ba3e0cd0ea3c/0';
  const sdudQuery = {
    conditions: [
      { property: 'state', value: 'IL', operator: '=' }
    ],
    limit: 5000,
    offset: 0
  };

  try {
    const response = await axios.post(sdudUrl, sdudQuery, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const sdudRecords = response.data.results || [];
    console.log(`✓ Retrieved ${sdudRecords.length} Illinois drug records from SDUD`);

    // Create lookup by drug name (use product_name field)
    const sdudByName = new Map();
    sdudRecords.forEach(record => {
      const name = (record.product_name || '').toUpperCase().trim();
      if (!name) return;

      if (!sdudByName.has(name)) {
        sdudByName.set(name, []);
      }
      sdudByName.get(name).push({
        ndc: record.ndc,
        product_name: record.product_name,
        prescriptions: record.number_of_prescriptions,
        reimbursement: record.total_amount_reimbursed
      });
    });

    console.log(`✓ Created lookup index: ${sdudByName.size} unique drug names`);

    // Step 3: Test matching
    console.log('\n[STEP 3] Testing Drug Name Matching...');
    console.log('-'.repeat(80));

    const testDrugs = ['OZEMPIC', 'HUMIRA', 'INSULIN LISPRO', 'METFORMIN', 'ATORVASTATIN'];
    let matchCount = 0;

    for (const testDrug of testDrugs) {
      const pdlEntry = pdlDrugs.find(d => d.toUpperCase().includes(testDrug));

      if (!pdlEntry) {
        console.log(`  ✗ ${testDrug}: Not in IL PDL`);
        continue;
      }

      // Try exact match
      let matches = sdudByName.get(pdlEntry.toUpperCase());

      // Try partial match
      if (!matches) {
        for (const [sdudName, records] of sdudByName.entries()) {
          if (sdudName.includes(testDrug)) {
            matches = records;
            break;
          }
        }
      }

      if (matches && matches.length > 0) {
        matchCount++;
        console.log(`  ✓ ${testDrug}:`);
        console.log(`     PDL name: ${pdlEntry}`);
        console.log(`     SDUD NDC: ${matches[0].ndc}`);
        console.log(`     Prescriptions: ${matches[0].prescriptions}`);
      } else {
        console.log(`  ✗ ${testDrug}: No SDUD match`);
      }
    }

    const matchRate = (matchCount / testDrugs.length * 100).toFixed(1);
    console.log(`\n✓ Match Rate: ${matchCount}/${testDrugs.length} (${matchRate}%)`);

    // Step 4: Full dataset matching estimate
    console.log('\n[STEP 4] Estimating Full Dataset Match Rate...');
    console.log('-'.repeat(80));

    let fullMatchCount = 0;
    const sampleSize = Math.min(100, pdlDrugs.length);

    for (let i = 0; i < sampleSize; i++) {
      const pdlDrug = pdlDrugs[i].toUpperCase();

      // Try exact match
      if (sdudByName.has(pdlDrug)) {
        fullMatchCount++;
        continue;
      }

      // Try partial match (first 3 words)
      const firstWords = pdlDrug.split(' ').slice(0, 3).join(' ');
      let found = false;
      for (const sdudName of sdudByName.keys()) {
        if (sdudName.includes(firstWords)) {
          fullMatchCount++;
          found = true;
          break;
        }
      }
    }

    const estimatedMatchRate = (fullMatchCount / sampleSize * 100).toFixed(1);
    console.log(`✓ Sample Match Rate: ${fullMatchCount}/${sampleSize} (${estimatedMatchRate}%)`);
    console.log(`✓ Projected total matches: ~${Math.round(pdlDrugs.length * fullMatchCount / sampleSize)} of ${pdlDrugs.length} drugs`);

    // Results
    console.log('\n' + '='.repeat(80));
    console.log('PROTOTYPE RESULTS');
    console.log('='.repeat(80));

    console.log('\n✓ Data Loaded:');
    console.log(`  - IL PDL drugs: ${pdlDrugs.length}`);
    console.log(`  - SDUD records (IL, 2024 Q3): ${sdudRecords.length}`);
    console.log(`  - Unique SDUD drug names: ${sdudByName.size}`);

    console.log('\n✓ Matching Performance:');
    console.log(`  - Test drugs match rate: ${matchRate}%`);
    console.log(`  - Sample match rate: ${estimatedMatchRate}%`);

    console.log('\n✓ Feasibility Assessment:');
    if (estimatedMatchRate >= 70) {
      console.log('  ✅ RECOMMENDED: Match rate ≥70% - proceed with full implementation');
      console.log('  ✅ Illinois enrichment is VIABLE');
    } else if (estimatedMatchRate >= 50) {
      console.log('  ⚠️  MARGINAL: Match rate 50-70% - consider improvements');
    } else {
      console.log('  ❌ NOT RECOMMENDED: Match rate <50% - enrichment not viable');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n✗ Error querying SDUD:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

simplePrototype().catch(error => {
  console.error('\n✗ Prototype failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
