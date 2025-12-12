/**
 * Test Unified State Formulary functionality
 * Tests California (Excel) and Texas (pipe-delimited text)
 */

const { searchStateFormulary } = require('./src/medicaid-api');

async function testUnifiedFormulary() {
  console.log('='.repeat(70));
  console.log('Unified State Formulary Test');
  console.log('='.repeat(70));

  try {
    // Test 1: California - semaglutide search
    console.log('\n1. Testing California formulary: semaglutide');
    const caTest = await searchStateFormulary({
      state: 'CA',
      generic_name: 'semaglutide',
      limit: 3
    });

    console.log(`State: ${caTest.state_name} (${caTest.state})`);
    console.log(`Dataset: ${caTest.dataset}`);
    console.log(`Total records in formulary: ${caTest.statistics.total_records.toLocaleString()}`);
    console.log(`Matching records: ${caTest.statistics.matching_records}`);
    console.log(`PA required: ${caTest.statistics.pa_required_count}`);
    console.log(`Extended duration: ${caTest.statistics.extended_duration_count}`);
    console.log('\nSample results:');
    caTest.results.slice(0, 2).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.label_name}`);
      console.log(`     NDC: ${r.ndc}, PA: ${r.prior_authorization ? 'Yes' : 'No'}, Tier: ${r.cost_ceiling_tier}`);
    });

    // Test 2: Texas - semaglutide search
    console.log('\n\n2. Testing Texas formulary: semaglutide');
    const txTest = await searchStateFormulary({
      state: 'TX',
      generic_name: 'semaglutide',
      limit: 3
    });

    console.log(`State: ${txTest.state_name} (${txTest.state})`);
    console.log(`Dataset: ${txTest.dataset}`);
    console.log(`Total records in formulary: ${txTest.statistics.total_records.toLocaleString()}`);
    console.log(`Matching records: ${txTest.statistics.matching_records}`);
    console.log(`PA required: ${txTest.statistics.pa_required_count}`);
    console.log(`  - PDL PA: ${txTest.statistics.pdl_pa_required_count}`);
    console.log(`  - Clinical PA: ${txTest.statistics.clinical_pa_required_count}`);
    console.log(`Medicaid active: ${txTest.statistics.medicaid_active_count}`);
    console.log(`CHIP active: ${txTest.statistics.chip_active_count}`);
    if (txTest.statistics.avg_retail_price) {
      console.log(`Avg retail price: $${txTest.statistics.avg_retail_price}`);
    }
    console.log('\nSample results:');
    txTest.results.slice(0, 2).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.label_name}`);
      console.log(`     NDC: ${r.ndc}`);
      console.log(`     PA: ${r.prior_authorization ? 'Yes' : 'No'} (PDL: ${r.pdl_pa_required ? 'Yes' : 'No'}, Clinical: ${r.clinical_pa_required ? 'Yes' : 'No'})`);
      console.log(`     Retail: $${r.retail_price}, 340B: $${r.price_340b}`);
      console.log(`     Medicaid: ${r.medicaid_active ? 'Active' : 'Inactive'}, CHIP: ${r.chip_active ? 'Active' : 'Inactive'}`);
    });

    // Test 3: Texas pricing filter
    console.log('\n\n3. Testing Texas pricing filter: GLP-1 drugs under $200');
    const txPriceTest = await searchStateFormulary({
      state: 'TX',
      generic_name: 'dulaglutide',
      max_price: 500,
      limit: 5
    });

    console.log(`Found ${txPriceTest.statistics.matching_records} dulaglutide products under $500`);
    if (txPriceTest.results.length > 0) {
      console.log('\nSample:');
      txPriceTest.results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.label_name} - $${r.retail_price}`);
      });
    }

    // Test 4: Compare PA requirements across states
    console.log('\n\n4. Comparing PA requirements across states for insulin');
    const caInsulin = await searchStateFormulary({
      state: 'CA',
      generic_name: 'insulin',
      requires_pa: true,
      limit: 100
    });
    const txInsulin = await searchStateFormulary({
      state: 'TX',
      generic_name: 'insulin',
      requires_pa: true,
      limit: 100
    });

    console.log(`California: ${caInsulin.statistics.pa_required_count} insulin products require PA`);
    console.log(`Texas: ${txInsulin.statistics.pa_required_count} insulin products require PA`);

    // Test 5: NDC lookup (TRULICITY 1.5mg)
    console.log('\n\n5. Testing NDC lookup across both states: 00002143480 (TRULICITY)');
    const caNDC = await searchStateFormulary({
      state: 'CA',
      ndc: '00002143480'
    });
    const txNDC = await searchStateFormulary({
      state: 'TX',
      ndc: '00002143480'
    });

    console.log(`\nCalifornia:`);
    if (caNDC.results.length > 0) {
      const drug = caNDC.results[0];
      console.log(`  Found: ${drug.label_name}`);
      console.log(`  Generic: ${drug.generic_name}`);
      console.log(`  PA Required: ${drug.prior_authorization ? 'Yes' : 'No'}`);
      console.log(`  Tier: ${drug.cost_ceiling_tier}`);
    } else {
      console.log(`  Not found in California formulary`);
    }

    console.log(`\nTexas:`);
    if (txNDC.results.length > 0) {
      const drug = txNDC.results[0];
      console.log(`  Found: ${drug.label_name}`);
      console.log(`  Generic: ${drug.generic_name}`);
      console.log(`  PA Required: ${drug.prior_authorization ? 'Yes' : 'No'} (PDL: ${drug.pdl_pa_required ? 'Yes' : 'No'}, Clinical: ${drug.clinical_pa_required ? 'Yes' : 'No'})`);
      console.log(`  Retail Price: $${drug.retail_price}`);
      console.log(`  340B Price: $${drug.price_340b}`);
      console.log(`  Therapeutic Class: ${drug.therapeutic_class}`);
    } else {
      console.log(`  Not found in Texas formulary`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✓ All unified formulary tests completed successfully');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testUnifiedFormulary();
