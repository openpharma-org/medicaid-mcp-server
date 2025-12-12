/**
 * Test Ohio Medicaid Formulary Implementation
 *
 * Tests search functionality with Ozempic and Trulicity
 */

const { searchStateFormulary } = require('./src/medicaid-api');

async function testOhioFormulary() {
  console.log('='.repeat(80));
  console.log('OHIO MEDICAID FORMULARY TEST');
  console.log('='.repeat(80));

  // Test 1: Search for Ozempic
  console.log('\n[TEST 1] Searching for Ozempic...');
  try {
    const ozempicResults = await searchStateFormulary({
      state: 'OH',
      label_name: 'OZEMPIC',
      limit: 10
    });

    console.log(`\n✓ Found ${ozempicResults.statistics.matching_records} Ozempic products`);
    console.log(`  Total formulary records: ${ozempicResults.statistics.total_records}`);
    console.log(`  PA required: ${ozempicResults.statistics.pa_required_count}`);
    console.log(`  Step therapy: ${ozempicResults.statistics.step_therapy_count}`);
    console.log(`  Quantity limits: ${ozempicResults.statistics.quantity_limit_count}`);

    console.log('\n  Sample Results:');
    ozempicResults.results.slice(0, 3).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.label_name}`);
      console.log(`     NDC: ${product.ndc}`);
      console.log(`     Type: ${product.is_brand ? 'Brand' : 'Generic'}`);
      console.log(`     PA Required: ${product.prior_authorization ? 'Yes' : 'No'}`);
      console.log(`     Step Therapy: ${product.step_therapy || 'None'}`);
      console.log(`     Quantity Limit: ${product.quantity_limit || 'None'}`);
    });
  } catch (error) {
    console.error(`✗ Ozempic search failed: ${error.message}`);
  }

  // Test 2: Search for Trulicity
  console.log('\n[TEST 2] Searching for Trulicity...');
  try {
    const trulicityResults = await searchStateFormulary({
      state: 'OH',
      label_name: 'TRULICITY',
      limit: 10
    });

    console.log(`\n✓ Found ${trulicityResults.statistics.matching_records} Trulicity products`);
    console.log(`  PA required: ${trulicityResults.statistics.pa_required_count}`);
    console.log(`  Step therapy: ${trulicityResults.statistics.step_therapy_count}`);
    console.log(`  Quantity limits: ${trulicityResults.statistics.quantity_limit_count}`);

    console.log('\n  Sample Results:');
    trulicityResults.results.slice(0, 3).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.label_name}`);
      console.log(`     NDC: ${product.ndc}`);
      console.log(`     Type: ${product.is_brand ? 'Brand' : 'Generic'}`);
      console.log(`     PA Required: ${product.prior_authorization ? 'Yes' : 'No'}`);
      console.log(`     Step Therapy: ${product.step_therapy || 'None'}`);
      console.log(`     Quantity Limit: ${product.quantity_limit || 'None'}`);
    });
  } catch (error) {
    console.error(`✗ Trulicity search failed: ${error.message}`);
  }

  // Test 3: Search by NDC (Ozempic 0.75mg)
  console.log('\n[TEST 3] Searching by NDC (Ozempic 0.75mg - 00002143380)...');
  try {
    const ndcResults = await searchStateFormulary({
      state: 'OH',
      ndc: '00002143380',
      limit: 5
    });

    console.log(`\n✓ Found ${ndcResults.statistics.matching_records} products`);
    if (ndcResults.results.length > 0) {
      const product = ndcResults.results[0];
      console.log('\n  Details:');
      console.log(`  Name: ${product.label_name}`);
      console.log(`  NDC: ${product.ndc}`);
      console.log(`  Type: ${product.is_brand ? 'Brand' : 'Generic'}`);
      console.log(`  PA Required: ${product.prior_authorization ? 'Yes' : 'No'}`);
      console.log(`  Step Therapy: ${product.step_therapy || 'None'}`);
      console.log(`  Quantity Limit: ${product.quantity_limit || 'None'}`);
      console.log(`  Effective Date: ${product.effective_date}`);
    }
  } catch (error) {
    console.error(`✗ NDC search failed: ${error.message}`);
  }

  // Test 4: Filter by brand drugs with PA required
  console.log('\n[TEST 4] Filtering brand drugs with PA required...');
  try {
    const paResults = await searchStateFormulary({
      state: 'OH',
      is_brand: true,
      requires_pa: true,
      limit: 5
    });

    console.log(`\n✓ Found ${paResults.statistics.matching_records} brand drugs with PA`);
    console.log(`  Total brands: ${paResults.statistics.brand_count}`);
    console.log(`  Total generics: ${paResults.statistics.generic_count}`);

    console.log('\n  Sample Results:');
    paResults.results.slice(0, 3).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.label_name}`);
      console.log(`     NDC: ${product.ndc}`);
      console.log(`     Quantity Limit: ${product.quantity_limit || 'None'}`);
    });
  } catch (error) {
    console.error(`✗ PA filter search failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testOhioFormulary().catch(error => {
  console.error('\n✗ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
