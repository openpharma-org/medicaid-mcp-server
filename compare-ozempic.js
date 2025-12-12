/**
 * Compare Ozempic formulary data across California and Texas
 */

const { searchStateFormulary } = require('./src/medicaid-api');

async function compareOzempic() {
  console.log('='.repeat(80));
  console.log('OZEMPIC (Semaglutide) Formulary Comparison: California vs Texas');
  console.log('='.repeat(80));

  try {
    // Get California Ozempic data
    const caResults = await searchStateFormulary({
      state: 'CA',
      label_name: 'ozempic',
      limit: 100
    });

    // Get Texas Ozempic data
    const txResults = await searchStateFormulary({
      state: 'TX',
      label_name: 'ozempic',
      limit: 100
    });

    console.log('\n## COVERAGE SUMMARY\n');
    console.log('California:');
    console.log('  - Total Ozempic products: ' + caResults.statistics.matching_records);
    console.log('  - PA required: ' + caResults.statistics.pa_required_count + ' products');
    console.log('  - Brand tier: ' + caResults.statistics.brand_count);
    console.log('  - Generic tier: ' + caResults.statistics.generic_count);
    console.log('  - Extended duration eligible: ' + caResults.statistics.extended_duration_count);

    console.log('\nTexas:');
    console.log('  - Total Ozempic products: ' + txResults.statistics.matching_records);
    console.log('  - PA required: ' + txResults.statistics.pa_required_count + ' products');
    console.log('    * PDL PA: ' + txResults.statistics.pdl_pa_required_count);
    console.log('    * Clinical PA: ' + txResults.statistics.clinical_pa_required_count);
    console.log('  - Medicaid active: ' + txResults.statistics.medicaid_active_count);
    console.log('  - CHIP active: ' + txResults.statistics.chip_active_count);
    if (txResults.statistics.avg_retail_price) {
      console.log('  - Average retail price: $' + txResults.statistics.avg_retail_price);
    }

    console.log('\n' + '='.repeat(80));
    console.log('## DETAILED PRODUCT COMPARISON\n');

    // Create a map of CA products by NDC
    const caMap = new Map();
    caResults.results.forEach(p => {
      caMap.set(p.ndc, p);
    });

    // Create a map of TX products by NDC
    const txMap = new Map();
    txResults.results.forEach(p => {
      txMap.set(p.ndc, p);
    });

    // Find all unique NDCs
    const allNDCs = new Set([...caMap.keys(), ...txMap.keys()]);

    console.log('| NDC | Product | CA PA | CA Tier | TX PA | TX Price | TX 340B |');
    console.log('|-----|---------|-------|---------|-------|----------|---------|');

    allNDCs.forEach(ndc => {
      const ca = caMap.get(ndc);
      const tx = txMap.get(ndc);

      const productName = (ca?.label_name || tx?.label_name || '').substring(0, 30);
      const caPa = ca ? (ca.prior_authorization ? 'Yes' : 'No') : 'N/A';
      const caTier = ca?.cost_ceiling_tier || 'N/A';
      const txPa = tx ? (tx.pdl_pa_required ? 'PDL' : tx.clinical_pa_required ? 'Clinical' : 'No') : 'N/A';
      const txPrice = tx?.retail_price ? '$' + tx.retail_price.toFixed(2) : 'N/A';
      const tx340b = tx?.price_340b ? '$' + tx.price_340b.toFixed(2) : 'N/A';

      console.log(`| ${ndc} | ${productName} | ${caPa} | ${caTier} | ${txPa} | ${txPrice} | ${tx340b} |`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('## KEY FINDINGS\n');

    // Calculate differences
    let paOnlyInCA = 0;
    let paOnlyInTX = 0;
    let paBothStates = 0;
    let paNeither = 0;

    allNDCs.forEach(ndc => {
      const ca = caMap.get(ndc);
      const tx = txMap.get(ndc);
      const caPaReq = ca?.prior_authorization || false;
      const txPaReq = tx?.prior_authorization || false;

      if (caPaReq && txPaReq) paBothStates++;
      else if (caPaReq && !txPaReq) paOnlyInCA++;
      else if (!caPaReq && txPaReq) paOnlyInTX++;
      else paNeither++;
    });

    console.log('Prior Authorization Differences:');
    console.log('  - PA required in BOTH states: ' + paBothStates + ' products');
    console.log('  - PA required ONLY in California: ' + paOnlyInCA + ' products');
    console.log('  - PA required ONLY in Texas: ' + paOnlyInTX + ' products');
    console.log('  - PA required in NEITHER state: ' + paNeither + ' products');

    console.log('\nAccess Restrictions:');
    if (paOnlyInTX > paOnlyInCA) {
      console.log('  ⚠️  Texas has MORE restrictive PA requirements than California');
    } else if (paOnlyInCA > paOnlyInTX) {
      console.log('  ⚠️  California has MORE restrictive PA requirements than Texas');
    } else {
      console.log('  ✓ Both states have similar PA requirements');
    }

    console.log('\nPricing Insights (Texas only):');
    if (txResults.results.length > 0) {
      const prices = txResults.results.map(p => p.retail_price).filter(p => p !== null);
      const price340b = txResults.results.map(p => p.price_340b).filter(p => p !== null);

      if (prices.length > 0) {
        const avgRetail = (prices.reduce((a,b) => a+b, 0) / prices.length).toFixed(2);
        const minRetail = Math.min(...prices).toFixed(2);
        const maxRetail = Math.max(...prices).toFixed(2);

        console.log('  - Average retail price: $' + avgRetail);
        console.log('  - Price range: $' + minRetail + ' - $' + maxRetail);

        if (price340b.length > 0) {
          const avg340b = (price340b.reduce((a,b) => a+b, 0) / price340b.length).toFixed(2);
          const discount = ((1 - avg340b / avgRetail) * 100).toFixed(1);
          console.log('  - Average 340B price: $' + avg340b + ' (' + discount + '% discount)');
        }
      }
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

compareOzempic();
