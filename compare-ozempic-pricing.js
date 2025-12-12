/**
 * Compare Ozempic pricing across California and Texas with NADAC data
 */

const { searchStateFormulary } = require('./src/medicaid-api');
const { getNADACPricing } = require('./src/medicaid-api');

async function compareOzempicPricing() {
  console.log('='.repeat(80));
  console.log('OZEMPIC PRICING COMPARISON: California vs Texas vs NADAC');
  console.log('='.repeat(80));

  try {
    // Get NADAC pricing (national benchmark)
    console.log('\n[1/3] Fetching NADAC pricing data...');
    const nadacResult = await getNADACPricing({
      drug_name: 'OZEMPIC',
      limit: 100
    });

    // Get California formulary
    console.log('[2/3] Fetching California formulary...');
    const caResults = await searchStateFormulary({
      state: 'CA',
      label_name: 'ozempic',
      limit: 100
    });

    // Get Texas formulary
    console.log('[3/3] Fetching Texas formulary...');
    const txResults = await searchStateFormulary({
      state: 'TX',
      label_name: 'ozempic',
      limit: 100
    });

    console.log('\n' + '='.repeat(80));
    console.log('PRICING DATA SOURCES');
    console.log('='.repeat(80));
    console.log('\nNADAC (National Average Drug Acquisition Cost):');
    console.log('  - Federal benchmark updated weekly by CMS');
    console.log('  - Represents pharmacy acquisition cost (wholesale)');
    console.log('  - Used by most state Medicaid programs as pricing base');
    console.log('  - Records found: ' + nadacResult.data.length);

    console.log('\nCalifornia Medi-Cal Pricing Formula:');
    console.log('  - Reimbursement = NADAC + Dispensing Fee');
    console.log('  - Dispensing Fee (July 2025): $10.05 (high volume) or $13.20 (low volume)');
    console.log('  - NO state-specific pricing in formulary file');
    console.log('  - Formulary only shows: PA status, tier (Brand/Generic)');

    console.log('\nTexas Medicaid Pricing:');
    console.log('  - State publishes actual reimbursement rates weekly');
    console.log('  - Includes: Retail, LTC, Specialty, 340B prices');
    console.log('  - Records found: ' + txResults.statistics.matching_records);

    console.log('\n' + '='.repeat(80));
    console.log('DETAILED PRICING COMPARISON (per ML)');
    console.log('='.repeat(80));
    console.log('');

    // Build maps
    const nadacMap = new Map();
    nadacResult.data.forEach(record => {
      // Get most recent for each NDC
      const existing = nadacMap.get(record.ndc);
      if (!existing || record.effective_date > existing.effective_date) {
        nadacMap.set(record.ndc, record);
      }
    });

    const caMap = new Map();
    caResults.results.forEach(p => caMap.set(p.ndc, p));

    const txMap = new Map();
    txResults.results.forEach(p => txMap.set(p.ndc, p));

    // Get unique NDCs
    const allNDCs = new Set([...nadacMap.keys(), ...caMap.keys(), ...txMap.keys()]);

    console.log('| NDC | Product | NADAC | CA Est.* | TX Retail | TX 340B |');
    console.log('|-----|---------|-------|----------|-----------|---------|');

    const caDispensingFee = 10.05; // High volume pharmacy
    const comparisons = [];

    allNDCs.forEach(ndc => {
      const nadac = nadacMap.get(ndc);
      const ca = caMap.get(ndc);
      const tx = txMap.get(ndc);

      if (!nadac) return; // Skip if no NADAC data

      const productName = (nadac?.description || ca?.label_name || tx?.label_name || '').substring(0, 35);
      const nadacPerML = parseFloat(nadac.nadac_per_unit);

      // California estimated reimbursement per pen
      // Ozempic pens are 1.5 ML or 3 ML - need to calculate per pen
      const penSize = productName.includes('1.5 ML') ? 1.5 : 3.0;
      const caEstimatedPerPen = (nadacPerML * penSize) + caDispensingFee;

      // Texas prices (already per pen/unit)
      const txRetailPerML = tx?.retail_price || null;
      const tx340bPerML = tx?.price_340b || null;

      const nadacStr = '$' + nadacPerML.toFixed(2);
      const caEstStr = '$' + caEstimatedPerPen.toFixed(2);
      const txRetailStr = txRetailPerML ? '$' + txRetailPerML.toFixed(2) : 'N/A';
      const tx340bStr = tx340bPerML ? '$' + tx340bPerML.toFixed(2) : 'N/A';

      console.log(`| ${ndc} | ${productName} | ${nadacStr} | ${caEstStr} | ${txRetailStr} | ${tx340bStr} |`);

      comparisons.push({
        ndc,
        product: productName,
        nadac_per_ml: nadacPerML,
        ca_estimated_per_pen: caEstimatedPerPen,
        tx_retail_per_ml: txRetailPerML,
        tx_340b_per_ml: tx340bPerML,
        pen_size: penSize
      });
    });

    console.log('\n*CA Estimated = (NADAC per ML × pen size) + $10.05 dispensing fee');

    console.log('\n' + '='.repeat(80));
    console.log('KEY FINDINGS');
    console.log('='.repeat(80));

    // Calculate averages
    const validComparisons = comparisons.filter(c => c.tx_retail_per_ml !== null);

    if (validComparisons.length > 0) {
      const avgNADAC = validComparisons.reduce((sum, c) => sum + c.nadac_per_ml, 0) / validComparisons.length;
      const avgTXRetail = validComparisons.reduce((sum, c) => sum + c.tx_retail_per_ml, 0) / validComparisons.length;
      const avgTX340B = validComparisons.reduce((sum, c) => sum + (c.tx_340b_per_ml || 0), 0) / validComparisons.length;

      console.log('\n1. Average Acquisition Cost Comparison (per ML):');
      console.log('   NADAC (wholesale):        $' + avgNADAC.toFixed(2));
      console.log('   Texas Retail:             $' + avgTXRetail.toFixed(2) + ' (+' + ((avgTXRetail/avgNADAC - 1) * 100).toFixed(1) + '% vs NADAC)');
      console.log('   Texas 340B (discounted):  $' + avgTX340B.toFixed(2) + ' (' + ((1 - avgTX340B/avgNADAC) * 100).toFixed(1) + '% discount vs NADAC)');

      console.log('\n2. California Medicaid Reimbursement Method:');
      console.log('   Formula: NADAC + $10.05 dispensing fee');
      console.log('   Example (3 mL pen): ($' + avgNADAC.toFixed(2) + ' × 3 mL) + $10.05 = $' + ((avgNADAC * 3) + 10.05).toFixed(2));

      console.log('\n3. Texas vs California Comparison:');
      const txAvgPerPen = avgTXRetail; // Texas reports per-unit (pen)
      const caAvgPerPen = (avgNADAC * 3) + 10.05; // CA: NADAC × 3mL + dispensing
      console.log('   Texas retail (per pen):       $' + txAvgPerPen.toFixed(2));
      console.log('   California estimated (per pen): $' + caAvgPerPen.toFixed(2));

      if (txAvgPerPen > caAvgPerPen) {
        const diff = ((txAvgPerPen / caAvgPerPen - 1) * 100).toFixed(1);
        console.log('   ⚠️  Texas pays ' + diff + '% MORE than California');
      } else {
        const diff = ((1 - txAvgPerPen / caAvgPerPen) * 100).toFixed(1);
        console.log('   ✓ Texas pays ' + diff + '% LESS than California');
      }

      console.log('\n4. 340B Discount Impact (Texas):');
      const discount340B = ((1 - avgTX340B / avgTXRetail) * 100).toFixed(1);
      console.log('   340B Price: ' + discount340B + '% discount vs retail');
      console.log('   Savings per pen: $' + (avgTXRetail - avgTX340B).toFixed(2));
    }

    console.log('\n5. Data Transparency:');
    console.log('   NADAC:      ✓ Publicly available, updated weekly');
    console.log('   Texas:      ✓ State publishes actual reimbursement rates');
    console.log('   California: ⚠️  Must calculate from NADAC + dispensing fee');
    console.log('               (No direct pricing in formulary file)');

    console.log('\n' + '='.repeat(80));
    console.log('CONCLUSION');
    console.log('='.repeat(80));
    console.log('\nTo get California Medicaid pricing:');
    console.log('  1. Use NADAC database (already in this MCP server) ✓');
    console.log('  2. Apply formula: NADAC × package size + $10.05 dispensing fee');
    console.log('  3. California does NOT publish final rates in formulary');
    console.log('\nTexas advantage:');
    console.log('  - Direct pricing transparency (no calculation needed)');
    console.log('  - Includes 340B discounted rates');
    console.log('  - Shows actual maximum reimbursement amounts');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

compareOzempicPricing();
