/**
 * Inspect CSV column names to fix field mapping
 */

const { cache } = require('./src/cache-manager');
const { getDataset } = require('./src/datasets');

async function inspectNADAC() {
  console.log('=== NADAC CSV Column Inspection ===\n');

  const dataset = getDataset('nadac');
  const data = await cache.get('NADAC', async () => {
    return cache.downloadAndParseCSV(dataset.downloadUrl, 'NADAC');
  }, dataset.cacheTime);

  console.log(`Total records: ${data.length}\n`);

  if (data.length > 0) {
    console.log('Column names:');
    const firstRecord = data[0];
    Object.keys(firstRecord).forEach((key, idx) => {
      console.log(`  ${idx + 1}. "${key}"`);
    });

    console.log('\n\nFirst record sample:');
    console.log(JSON.stringify(firstRecord, null, 2));

    // Search for semaglutide manually
    console.log('\n\nSearching for semaglutide (manual check)...');
    const semaRecords = data.filter(row => {
      const allValues = Object.values(row).join(' ').toLowerCase();
      return allValues.includes('semaglutide');
    });
    console.log(`Found ${semaRecords.length} semaglutide records\n`);

    if (semaRecords.length > 0) {
      console.log('Sample semaglutide record:');
      console.log(JSON.stringify(semaRecords[0], null, 2));
    }
  }
}

async function inspectEnrollment() {
  console.log('\n\n=== Enrollment CSV Column Inspection ===\n');

  const dataset = getDataset('enrollment');
  const data = await cache.get('ENROLLMENT', async () => {
    return cache.downloadAndParseCSV(dataset.downloadUrl, 'Enrollment');
  }, dataset.cacheTime);

  console.log(`Total records: ${data.length}\n`);

  if (data.length > 0) {
    console.log('Column names:');
    const firstRecord = data[0];
    Object.keys(firstRecord).forEach((key, idx) => {
      console.log(`  ${idx + 1}. "${key}"`);
    });

    console.log('\n\nFirst record sample:');
    console.log(JSON.stringify(firstRecord, null, 2));

    // Search for California
    console.log('\n\nSearching for California records...');
    const caRecords = data.filter(row => {
      const allValues = Object.values(row).join(' ').toUpperCase();
      return allValues.includes('CA') || allValues.includes('CALIFORNIA');
    });
    console.log(`Found ${caRecords.length} California records\n`);

    if (caRecords.length > 0) {
      console.log('Sample California record:');
      console.log(JSON.stringify(caRecords[0], null, 2));
    }
  }
}

async function run() {
  await inspectNADAC();
  await inspectEnrollment();
}

run().catch(error => {
  console.error('ERROR:', error);
  process.exit(1);
});
