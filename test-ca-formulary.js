/**
 * Test California Medicaid Formulary functionality
 */

const { searchCaliforniaFormulary } = require('./src/medicaid-api');

async function testFormulary() {
  console.log('='.repeat(70));
  console.log('California Medicaid Formulary Test');
  console.log('='.repeat(70));

  try {
    // Test 1: Search by generic name (OZEMPIC/semaglutide)
    console.log('\n1. Testing generic name search: semaglutide');
    const test1 = await searchCaliforniaFormulary({
      generic_name: 'semaglutide',
      limit: 5
    });

    console.log(`Found ${test1.statistics.matching_records} records`);
    console.log(`PA required: ${test1.statistics.pa_required_count}`);
    console.log(`Extended duration: ${test1.statistics.extended_duration_count}`);
    console.log('\nSample results:');
    test1.results.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.label_name}`);
      console.log(`     NDC: ${r.ndc}`);
      console.log(`     PA Required: ${r.prior_authorization ? 'Yes' : 'No'}`);
      console.log(`     Tier: ${r.cost_ceiling_tier}`);
    });

    // Test 2: Search drugs requiring PA
    console.log('\n\n2. Testing PA requirement filter');
    const test2 = await searchCaliforniaFormulary({
      generic_name: 'insulin',
      requires_pa: true,
      limit: 5
    });

    console.log(`Found ${test2.statistics.matching_records} insulin products requiring PA`);
    if (test2.results.length > 0) {
      console.log('\nSample:');
      test2.results.slice(0, 2).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.generic_name} - ${r.label_name}`);
      });
    }

    // Test 3: Search by NDC
    console.log('\n\n3. Testing NDC search: 00002143380 (TRULICITY)');
    const test3 = await searchCaliforniaFormulary({
      ndc: '00002143380'
    });

    if (test3.results.length > 0) {
      const drug = test3.results[0];
      console.log(`Found: ${drug.label_name}`);
      console.log(`Generic: ${drug.generic_name}`);
      console.log(`PA Required: ${drug.prior_authorization ? 'Yes' : 'No'}`);
      console.log(`Extended Duration: ${drug.extended_duration_drug ? 'Yes' : 'No'}`);
      console.log(`Tier: ${drug.cost_ceiling_tier}`);
    } else {
      console.log('NDC not found in formulary');
    }

    // Test 4: Overall statistics
    console.log('\n\n4. Overall formulary statistics');
    const test4 = await searchCaliforniaFormulary({ limit: 100000 });
    console.log(`Total NDCs: ${test4.statistics.total_records.toLocaleString()}`);
    console.log(`Unique generic drugs: ${test4.statistics.unique_generic_drugs.toLocaleString()}`);
    console.log(`Requiring PA: ${test4.statistics.pa_required_count.toLocaleString()} (${(test4.statistics.pa_required_count/test4.statistics.total_records*100).toFixed(1)}%)`);
    console.log(`Extended duration eligible: ${test4.statistics.extended_duration_count.toLocaleString()} (${(test4.statistics.extended_duration_count/test4.statistics.total_records*100).toFixed(1)}%)`);
    console.log(`Brand NDCs: ${test4.statistics.brand_count.toLocaleString()}`);
    console.log(`Generic NDCs: ${test4.statistics.generic_count.toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('✓ All tests completed successfully');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFormulary();
