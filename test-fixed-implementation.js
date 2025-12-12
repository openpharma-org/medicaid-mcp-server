/**
 * Test fixed CSV implementation with correct column mappings
 */

const { getNADACPricing, getEnrollmentTrends } = require('./src/medicaid-api');

async function testNADAC() {
  console.log('\n=== Test 1: NADAC Pricing (ibuprofen) ===\n');

  try {
    const result = await getNADACPricing({
      drug_name: 'ibuprofen',
      limit: 5
    });

    console.log(`✓ Found ${result.meta.total_count} records (showing ${result.meta.returned_count})`);
    console.log(`Cache: ${result.meta.cache_status}\n`);

    result.data.slice(0, 3).forEach((drug, idx) => {
      console.log(`${idx + 1}. ${drug.description}`);
      console.log(`   NDC: ${drug.ndc}`);
      console.log(`   Price: $${drug.nadac_per_unit} per ${drug.pricing_unit}`);
      console.log(`   Effective Date: ${drug.effective_date}\n`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

async function testEnrollment() {
  console.log('\n=== Test 2: California Enrollment Trends ===\n');

  try {
    const result = await getEnrollmentTrends({
      state: 'CA',
      start_date: '2023-01-01',
      end_date: '2024-12-31',
      limit: 10
    });

    console.log(`✓ Found ${result.meta.total_count} records (showing ${result.meta.returned_count})`);
    console.log(`State: ${result.meta.state}`);
    console.log(`Date range: ${result.meta.date_range.start} to ${result.meta.date_range.end}\n`);

    result.data.slice(0, 5).forEach((record, idx) => {
      console.log(`${idx + 1}. Period: ${record.reporting_period || record.period || 'N/A'}`);
      console.log(`   State: ${record.state_name || record.state || 'N/A'}`);
      console.log(`   Total Enrollment: ${record.total_medicaid_chip_enrollment || 'N/A'}\n`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

async function testSpecificNDC() {
  console.log('\n=== Test 3: Specific NDC Code ===\n');

  try {
    // Use an NDC from the sample data we saw: 24385005452 (nasal decongestant)
    const result = await getNADACPricing({
      ndc_code: '24385005452',
      limit: 5
    });

    console.log(`✓ Found ${result.meta.total_count} records`);

    if (result.data.length > 0) {
      const drug = result.data[0];
      console.log(`\nDrug: ${drug.description}`);
      console.log(`NDC: ${drug.ndc}`);
      console.log(`Price: $${drug.nadac_per_unit} per ${drug.pricing_unit}`);
      console.log(`Effective Date: ${drug.effective_date}`);
      console.log(`OTC: ${drug.otc || 'N/A'}`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('Fixed CSV-based Medicaid MCP Tests');
  console.log('='.repeat(70));

  await testNADAC();
  await testEnrollment();
  await testSpecificNDC();

  console.log('\n' + '='.repeat(70));
  console.log('All tests complete!');
  console.log('='.repeat(70));
}

run().catch(error => {
  console.error('\nFATAL:', error);
  process.exit(1);
});
