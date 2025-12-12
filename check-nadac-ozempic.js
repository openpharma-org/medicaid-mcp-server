/**
 * Check NADAC pricing for Ozempic
 */

const { getNADACPricing } = require('./src/medicaid-api');

async function checkNADACforOzempic() {
  console.log('='.repeat(80));
  console.log('NADAC Pricing Analysis for Ozempic');
  console.log('='.repeat(80));

  try {
    // Search for Ozempic in NADAC
    const result = await getNADACPricing({
      drug_name: 'OZEMPIC',
      limit: 100
    });

    console.log('\nNADAC Results:');
    console.log('  Total Ozempic records: ' + (result.metadata?.total_count || result.data?.length || 0));
    console.log('  Returned: ' + (result.metadata?.returned_count || result.data?.length || 0));

    if (result.data && result.data.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('Ozempic NADAC Pricing (National Average Drug Acquisition Cost)');
      console.log('='.repeat(80));
      console.log('');

      // Group by NDC
      const ndcMap = new Map();
      result.data.forEach(record => {
        const ndc = record.ndc;
        if (!ndcMap.has(ndc)) {
          ndcMap.set(ndc, []);
        }
        ndcMap.get(ndc).push(record);
      });

      ndcMap.forEach((records, ndc) => {
        // Get most recent record
        const latest = records.sort((a, b) =>
          b.effective_date.localeCompare(a.effective_date)
        )[0];

        console.log('NDC: ' + ndc);
        console.log('  Description: ' + latest.description);
        console.log('  NADAC Per Unit: $' + parseFloat(latest.nadac_per_unit).toFixed(5));
        console.log('  Pricing Unit: ' + latest.pricing_unit);
        console.log('  Effective Date: ' + latest.effective_date);
        console.log('  Package Size: ' + (latest.package_size || 'N/A'));
        console.log('');
      });

      console.log('='.repeat(80));
      console.log('NADAC Notes:');
      console.log('  - NADAC = National Average Drug Acquisition Cost');
      console.log('  - Updated weekly by CMS');
      console.log('  - Used as benchmark for Medicaid reimbursement');
      console.log('  - Represents pharmacy acquisition cost (not retail price)');
      console.log('  - California Medicaid likely reimburses: NADAC + dispensing fee');
      console.log('='.repeat(80));

    } else {
      console.log('\nNo NADAC records found for Ozempic');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkNADACforOzempic();
