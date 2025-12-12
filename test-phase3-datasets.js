/**
 * Test Phase 3 datasets: Drug Rebate, Drug Utilization, Federal Upper Limits
 */

const { cache } = require('./src/cache-manager');
const { DATASETS } = require('./src/datasets');

async function inspectDataset(datasetKey, sampleLimit = 3) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${datasetKey} Dataset`);
  console.log('='.repeat(70));

  const dataset = DATASETS[datasetKey];

  if (!dataset.downloadUrl) {
    console.log('✗ No download URL configured');
    return null;
  }

  console.log(`Name: ${dataset.name}`);
  console.log(`Category: ${dataset.category}`);
  console.log(`Update Frequency: ${dataset.update_frequency}`);
  console.log(`Description: ${dataset.description}`);
  console.log(`\nDownloading from: ${dataset.downloadUrl}`);

  try {
    const data = await cache.get(datasetKey, async () => {
      return cache.downloadAndParseCSV(dataset.downloadUrl, datasetKey);
    }, dataset.cacheTime);

    console.log(`\n✓ Total records: ${data.length.toLocaleString()}`);

    if (data.length > 0) {
      console.log(`\nColumn names (${Object.keys(data[0]).length} columns):`);
      Object.keys(data[0]).forEach((key, idx) => {
        if (idx < 20) {  // Show first 20 columns
          console.log(`  ${idx + 1}. "${key}"`);
        }
      });

      if (Object.keys(data[0]).length > 20) {
        console.log(`  ... and ${Object.keys(data[0]).length - 20} more columns`);
      }

      console.log(`\nSample records (first ${sampleLimit}):`);
      data.slice(0, sampleLimit).forEach((record, idx) => {
        console.log(`\n${idx + 1}. Sample record:`);
        const entries = Object.entries(record);
        entries.slice(0, 10).forEach(([key, value]) => {
          const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
          console.log(`   ${key}: ${displayValue}`);
        });
        if (entries.length > 10) {
          console.log(`   ... and ${entries.length - 10} more fields`);
        }
      });
    }

    return data;

  } catch (error) {
    console.error(`\n✗ ERROR: ${error.message}`);
    return null;
  }
}

async function testAllPhase3Datasets() {
  console.log('='.repeat(70));
  console.log('Phase 3 Datasets Testing');
  console.log('='.repeat(70));

  // Test Drug Rebate
  const rebateData = await inspectDataset('DRUG_REBATE', 2);

  // Test Drug Utilization
  const utilizationData = await inspectDataset('DRUG_UTILIZATION', 2);

  // Test Federal Upper Limits
  const fulData = await inspectDataset('FEDERAL_UPPER_LIMITS', 2);

  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('Summary');
  console.log('='.repeat(70));

  const datasets = [
    { name: 'Drug Rebate', data: rebateData },
    { name: 'Drug Utilization', data: utilizationData },
    { name: 'Federal Upper Limits', data: fulData }
  ];

  datasets.forEach(ds => {
    if (ds.data) {
      const sizeEstimate = ds.data.length * 500 / (1024 * 1024);  // Rough estimate: 500 bytes per record
      console.log(`\n${ds.name}:`);
      console.log(`  Records: ${ds.data.length.toLocaleString()}`);
      console.log(`  Estimated Memory: ~${sizeEstimate.toFixed(1)} MB`);
      console.log(`  Status: ✓ Available`);
    } else {
      console.log(`\n${ds.name}:`);
      console.log(`  Status: ✗ Failed to load`);
    }
  });

  // Cache stats
  console.log(`\n\nCache Statistics:`);
  const stats = cache.getStats();
  console.log(`  Total entries: ${stats.entries}`);
  console.log(`  Total records: ${stats.totalRecords.toLocaleString()}`);
  stats.details.forEach(detail => {
    console.log(`\n  ${detail.key}:`);
    console.log(`    Records: ${detail.records.toLocaleString()}`);
    console.log(`    Fetched: ${detail.fetchedAt}`);
    console.log(`    Expires: ${detail.expiresAt}`);
    console.log(`    Expired: ${detail.isExpired ? 'Yes' : 'No'}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('Phase 3 Testing Complete!');
  console.log('='.repeat(70));
}

testAllPhase3Datasets().catch(error => {
  console.error('\nFATAL ERROR:', error);
  process.exit(1);
});
