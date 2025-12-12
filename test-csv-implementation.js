/**
 * Test CSV-based Medicaid MCP Implementation
 *
 * Tests the new CSV download + cache architecture
 */

const { getNADACPricing, getEnrollmentTrends, listAvailableDatasets } = require('./src/medicaid-api');

async function testNADACPricing() {
  console.log('\n=== Testing NADAC Pricing (CSV-based) ===\n');

  try {
    console.log('Test 1: Search for semaglutide pricing...');
    const result = await getNADACPricing({
      drug_name: 'semaglutide',
      limit: 5
    });

    console.log(`\nSuccess! Found ${result.meta.total_count} records (showing ${result.meta.returned_count})`);
    console.log('Cache status:', result.meta.cache_status);
    console.log('\nSample results:');
    result.data.slice(0, 3).forEach((drug, idx) => {
      console.log(`\n${idx + 1}. ${drug.ndc_description || 'N/A'}`);
      console.log(`   NDC: ${drug.ndc || 'N/A'}`);
      console.log(`   Price: $${drug.nadac_per_unit || 'N/A'} per ${drug.pricing_unit || 'unit'}`);
      console.log(`   Effective Date: ${drug.effective_date || 'N/A'}`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

async function testEnrollmentTrends() {
  console.log('\n\n=== Testing Enrollment Trends (CSV-based) ===\n');

  try {
    console.log('Test 2: Get California enrollment trends...');
    const result = await getEnrollmentTrends({
      state: 'CA',
      limit: 5
    });

    console.log(`\nSuccess! Found ${result.meta.total_count} records (showing ${result.meta.returned_count})`);
    console.log('\nSample results:');
    result.data.slice(0, 3).forEach((record, idx) => {
      console.log(`\n${idx + 1}. ${record.state || 'N/A'} - ${record.month || record.report_date || 'N/A'}`);
      console.log(`   Total Enrollment: ${record.total_enrollment || 'N/A'}`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

async function testListDatasets() {
  console.log('\n\n=== Testing List Datasets ===\n');

  try {
    const result = await listAvailableDatasets({});

    console.log(`Total datasets: ${result.meta.total_datasets}`);
    console.log(`Available datasets: ${result.meta.available_datasets}\n`);

    result.data.forEach(ds => {
      const status = ds.available ? '✓' : '✗';
      console.log(`${status} ${ds.name}`);
      console.log(`  Category: ${ds.category}`);
      console.log(`  Size: ${ds.estimated_size}, Records: ${ds.estimated_records}`);
      console.log(`  Update frequency: ${ds.update_frequency}`);
      console.log(`  Cache time: ${ds.cache_time_hours} hours\n`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('CSV-based Medicaid MCP Server Tests');
  console.log('='.repeat(70));

  await testListDatasets();
  await testNADACPricing();
  await testEnrollmentTrends();

  console.log('\n' + '='.repeat(70));
  console.log('Tests complete!');
  console.log('='.repeat(70));
}

runTests().catch(error => {
  console.error('\nFATAL ERROR:', error);
  process.exit(1);
});
