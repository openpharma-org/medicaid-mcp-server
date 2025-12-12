/**
 * Test Cross-State NDC Matching
 *
 * Strategy: Use NDC codes from CA/TX/NY formularies to enrich Illinois PDL
 * Hypothesis: Same drugs appear across state formularies
 */

const fs = require('fs');
const { execSync } = require('child_process');
const { searchStateFormulary } = require('./src/medicaid-api');

async function testCrossStateMatching() {
  console.log('='.repeat(80));
  console.log('CROSS-STATE NDC MATCHING TEST');
  console.log('='.repeat(80));

  // Step 1: Load Illinois PDL
  console.log('\n[STEP 1] Loading Illinois PDL...');

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
    dosage_form = str(values[2] or '').strip()
    pdl_status = str(values[4] or values[5] or '').strip()

    if drug_name:
        drugs.append({
            'drug_name': drug_name,
            'dosage_form': dosage_form,
            'pdl_status': pdl_status
        })

print(json.dumps(drugs))
wb.close()
`;

  fs.writeFileSync('parse_pdl_full.py', pythonScript);
  const ilDrugs = JSON.parse(execSync('python3 parse_pdl_full.py', { encoding: 'utf8' }));
  console.log(`✓ Loaded ${ilDrugs.length} drugs from Illinois PDL`);

  // Step 2: Test matching against CA/TX/NY
  console.log('\n[STEP 2] Testing Cross-State Matching (Sample)...');
  console.log('-'.repeat(80));

  const testDrugs = ilDrugs.slice(0, 20); // Test first 20 drugs
  const results = {
    ca_matches: 0,
    tx_matches: 0,
    ny_matches: 0,
    total_with_ndc: 0
  };

  for (const ilDrug of testDrugs) {
    console.log(`\nTesting: ${ilDrug.drug_name}`);

    let foundNDC = false;

    // Try California
    try {
      const caResult = await searchStateFormulary({
        state: 'CA',
        label_name: ilDrug.drug_name,
        limit: 1
      });

      if (caResult.results && caResult.results.length > 0) {
        const match = caResult.results[0];
        console.log(`  ✓ CA: ${match.ndc} - ${match.label_name}`);
        results.ca_matches++;
        foundNDC = true;
      } else {
        console.log(`  ✗ CA: No match`);
      }
    } catch (error) {
      console.log(`  ✗ CA: Error - ${error.message}`);
    }

    // Try Texas
    try {
      const txResult = await searchStateFormulary({
        state: 'TX',
        label_name: ilDrug.drug_name,
        limit: 1
      });

      if (txResult.results && txResult.results.length > 0) {
        const match = txResult.results[0];
        console.log(`  ✓ TX: ${match.ndc} - ${match.label_name}`);
        results.tx_matches++;
        foundNDC = true;
      } else {
        console.log(`  ✗ TX: No match`);
      }
    } catch (error) {
      console.log(`  ✗ TX: Error - ${error.message}`);
    }

    // Try New York
    try {
      const nyResult = await searchStateFormulary({
        state: 'NY',
        label_name: ilDrug.drug_name,
        limit: 1
      });

      if (nyResult.results && nyResult.results.length > 0) {
        const match = nyResult.results[0];
        console.log(`  ✓ NY: ${match.ndc} - ${match.label_name}`);
        results.ny_matches++;
        foundNDC = true;
      } else {
        console.log(`  ✗ NY: No match`);
      }
    } catch (error) {
      console.log(`  ✗ NY: Error - ${error.message}`);
    }

    if (foundNDC) {
      results.total_with_ndc++;
    }
  }

  // Results
  console.log('\n' + '='.repeat(80));
  console.log('CROSS-STATE MATCHING RESULTS');
  console.log('='.repeat(80));

  console.log(`\nSample Size: ${testDrugs.length} IL drugs`);
  console.log(`\nMatches by State:`);
  console.log(`  - California: ${results.ca_matches} (${(results.ca_matches/testDrugs.length*100).toFixed(1)}%)`);
  console.log(`  - Texas: ${results.tx_matches} (${(results.tx_matches/testDrugs.length*100).toFixed(1)}%)`);
  console.log(`  - New York: ${results.ny_matches} (${(results.ny_matches/testDrugs.length*100).toFixed(1)}%)`);
  console.log(`\nTotal IL drugs with NDC from ANY state: ${results.total_with_ndc} (${(results.total_with_ndc/testDrugs.length*100).toFixed(1)}%)`);

  const projectedTotal = Math.round(ilDrugs.length * results.total_with_ndc / testDrugs.length);
  console.log(`\nProjected Total Enrichment:`);
  console.log(`  - ${projectedTotal} of ${ilDrugs.length} IL drugs (${(results.total_with_ndc/testDrugs.length*100).toFixed(1)}%)`);

  console.log(`\nFeasibility Assessment:`);
  const matchRate = results.total_with_ndc / testDrugs.length * 100;
  if (matchRate >= 70) {
    console.log(`  ✅ VIABLE: Cross-state matching achieves >70% coverage`);
    console.log(`  ✅ Recommendation: Implement IL using CA/TX/NY NDC codes`);
  } else if (matchRate >= 50) {
    console.log(`  ⚠️  MARGINAL: 50-70% coverage - consider implementation`);
  } else {
    console.log(`  ❌ NOT VIABLE: <50% coverage - cross-state matching insufficient`);
  }

  console.log('\n' + '='.repeat(80));
}

testCrossStateMatching().catch(error => {
  console.error('\n✗ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
