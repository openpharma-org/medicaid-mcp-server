// Test DKAN API endpoint format
const axios = require('axios');

async function testDKAN() {
  const endpoints = [
    'https://data.medicaid.gov/api/1/datastore/query/a4y5-998d/0',
    'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/99315a95-37ac-4eee-946a-3c523b4c481e'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting: ${endpoint}`);
      const response = await axios.get(endpoint, { timeout: 30000 });
      console.log('Success! Status:', response.status);
      console.log('Data type:', typeof response.data);
      if (response.data) {
        console.log('Keys:', Object.keys(response.data).slice(0, 10));
      }
    } catch (error) {
      console.log('Failed:', error.message, '(Status:', error.response?.status || 'N/A', ')');
    }
  }
}

testDKAN();
