/**
 * Test large datasets: Drug Rebate and Drug Utilization
 */

const { cache } = require('./src/cache-manager');
const { DATASETS } = require('./src/datasets');

async function testDataset(datasetKey) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing ${datasetKey}`);
  console.log('='.repeat(70));

  const dataset = DATASETS[datasetKey];
  console.log(`Name: ${dataset.name}`);
  console.log(`URL: ${dataset.downloadUrl}\n`);

  try {
    const startTime = Date.now();

    const data = await cache.get(datasetKey, async () => {
      return cache.downloadAndParseCSV(dataset.downloadUrl, datasetKey);
    }, dataset.cacheTime);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✓ SUCCESS`);
    console.log(`  Records: ${data.length.toLocaleString()}`);
    console.log(`  Time: ${elapsed} seconds`);
    console.log(`  Columns: ${Object.keys(data[0]).length}`);

    const estimatedMemory = (data.length * 500) / (1024 * 1024);
    console.log(`  Estimated Memory: ~${estimatedMemory.toFixed(0)} MB`);

    console.log(`\n  First 5 column names:`);
    Object.keys(data[0]).slice(0, 5).forEach((key, idx) => {
      console.log(`    ${idx + 1}. "${key}"`);
    });

    console.log(`\n  Sample record:`);
    const sample = data[0];
    Object.entries(sample).slice(0, 8).forEach(([key, value]) => {
      const display = value.length > 60 ? value.substring(0, 60) + '...' : value;
      console.log(`    ${key}: ${display}`);
    });

    return data;

  } catch (error) {
    console.error(`\n✗ FAILED: ${error.message}`);
    return null;
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('Large Dataset Testing');
  console.log('='.repeat(70));

  // Test Drug Rebate
  const rebateData = await testDataset('DRUG_REBATE');

  // Test Drug Utilization
  const utilizationData = await testDataset('DRUG_UTILIZATION');

  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('Summary');
  console.log('='.repeat(70));

  if (rebateData) {
    console.log(`\nDrug Rebate: ${rebateData.length.toLocaleString()} records ✓`);
  } else {
    console.log(`\nDrug Rebate: Failed ✗`);
  }

  if (utilizationData) {
    console.log(`Drug Utilization: ${utilizationData.length.toLocaleString()} records ✓`);
  } else {
    console.log(`Drug Utilization: Failed ✗`);
  }

  console.log('\n' + '='.repeat(70));
}

run().catch(error => {
  console.error('\nFATAL:', error);
  process.exit(1);
});
