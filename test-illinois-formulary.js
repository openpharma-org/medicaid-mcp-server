/**
 * Test Illinois Medicaid Formulary Implementation
 *
 * Tests cross-state enrichment with Ozempic, Trulicity, Humira
 */

const { searchStateFormulary } = require('./src/medicaid-api');

async function testIllinoisFormulary() {
  console.log('='.repeat(80));
  console.log('ILLINOIS MEDICAID FORMULARY TEST (Cross-State Enrichment)');
  console.log('='.repeat(80));

  // Test 1: Search for Ozempic
  console.log('\n[TEST 1] Searching for Ozempic...');
  try {
    const ozempicResults = await searchStateFormulary({
      state: 'IL',
      label_name: 'OZEMPIC',
      limit: 10
    });

    console.log(`\n✓ Found ${ozempicResults.statistics.matching_records} Ozempic products`);
    console.log(`  Total formulary records: ${ozempicResults.statistics.total_records}`);
    console.log(`  Enrichment rate: ${ozempicResults.statistics.enrichment_rate}`);
    console.log(`  With NDC: ${ozempicResults.statistics.with_ndc_count}`);
    console.log(`  Without NDC: ${ozempicResults.statistics.without_ndc_count}`);
    console.log(`  CA source: ${ozempicResults.statistics.ca_source_count}`);
    console.log(`  NY source: ${ozempicResults.statistics.ny_source_count}`);
    console.log(`  High confidence: ${ozempicResults.statistics.high_confidence_count}`);

    console.log('\n  Sample Results:');
    ozempicResults.results.slice(0, 3).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.label_name || product.drug_name}`);
      console.log(`     IL Drug Name: ${product.drug_name}`);
      console.log(`     NDC: ${product.ndc || 'Not available'}`);
      console.log(`     NDC Source: ${product.ndc_source || 'None'}`);
      console.log(`     Match Confidence: ${product.match_confidence}`);
      console.log(`     PA Required: ${product.prior_authorization ? 'Yes' : 'No'}`);
    });
  } catch (error) {
    console.error(`✗ Ozempic search failed: ${error.message}`);
    console.error(error.stack);
  }

  // Test 2: Search for Trulicity
  console.log('\n[TEST 2] Searching for Trulicity...');
  try {
    const trulicityResults = await searchStateFormulary({
      state: 'IL',
      label_name: 'TRULICITY',
      limit: 10
    });

    console.log(`\n✓ Found ${trulicityResults.statistics.matching_records} Trulicity products`);
    console.log(`  Enrichment rate: ${trulicityResults.statistics.enrichment_rate}`);
    console.log(`  PA required: ${trulicityResults.statistics.pa_required_count}`);

    console.log('\n  Sample Results:');
    trulicityResults.results.slice(0, 3).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.label_name || product.drug_name}`);
      console.log(`     NDC: ${product.ndc || 'Not available'}`);
      console.log(`     NDC Source: ${product.ndc_source || 'None'}`);
      console.log(`     Match Confidence: ${product.match_confidence}`);
    });
  } catch (error) {
    console.error(`✗ Trulicity search failed: ${error.message}`);
    console.error(error.stack);
  }

  // Test 3: Search for Humira
  console.log('\n[TEST 3] Searching for Humira...');
  try {
    const humiraResults = await searchStateFormulary({
      state: 'IL',
      label_name: 'HUMIRA',
      limit: 10
    });

    console.log(`\n✓ Found ${humiraResults.statistics.matching_records} Humira products`);
    console.log(`  Enrichment rate: ${humiraResults.statistics.enrichment_rate}`);

    console.log('\n  Sample Results:');
    humiraResults.results.slice(0, 3).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.label_name || product.drug_name}`);
      console.log(`     NDC: ${product.ndc || 'Not available'}`);
      console.log(`     NDC Source: ${product.ndc_source || 'None'}`);
    });
  } catch (error) {
    console.error(`✗ Humira search failed: ${error.message}`);
    console.error(error.stack);
  }

  // Test 4: Filter drugs with NDC available
  console.log('\n[TEST 4] Filtering drugs with NDC codes available...');
  try {
    const withNDCResults = await searchStateFormulary({
      state: 'IL',
      has_ndc: true,
      limit: 10
    });

    console.log(`\n✓ Found ${withNDCResults.statistics.matching_records} drugs with NDC`);
    console.log(`  Total enriched: ${withNDCResults.statistics.with_ndc_count}`);
    console.log(`  Overall enrichment: ${withNDCResults.statistics.enrichment_rate}`);

    console.log('\n  Sample Results:');
    withNDCResults.results.slice(0, 5).forEach((product, idx) => {
      console.log(`  ${idx + 1}. ${product.drug_name} (${product.ndc_source})`);
    });
  } catch (error) {
    console.error(`✗ NDC filter failed: ${error.message}`);
    console.error(error.stack);
  }

  // Test 5: Overall statistics
  console.log('\n[TEST 5] Overall Illinois Formulary Statistics...');
  try {
    const allResults = await searchStateFormulary({
      state: 'IL',
      limit: 1  // Just need stats
    });

    console.log(`\n✓ Illinois Medicaid PDL Stats:`);
    console.log(`  Total drugs in IL PDL: ${allResults.statistics.total_records}`);
    console.log(`  Drugs with NDC codes: ${allResults.statistics.total_records > 0 ?
      Math.round(allResults.statistics.total_records * parseFloat(allResults.statistics.enrichment_rate) / 100) : 0}`);
    console.log(`  Enrichment rate: ${allResults.statistics.enrichment_rate}`);
    console.log(`  CA as NDC source: ${allResults.statistics.ca_source_count || 'N/A'}`);
    console.log(`  NY as NDC source: ${allResults.statistics.ny_source_count || 'N/A'}`);
  } catch (error) {
    console.error(`✗ Stats retrieval failed: ${error.message}`);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testIllinoisFormulary().catch(error => {
  console.error('\n✗ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
