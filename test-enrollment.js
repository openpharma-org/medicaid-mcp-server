const axios = require('axios');

async function testEnrollment() {
  // Try SQL API endpoint for enrollment data
  const datasetId = '6165f45b-ca93-5bb5-9d06-db29c692a360';

  try {
    console.log('Testing SQL API endpoint...\n');

    // DKAN SQL API format
    const url = `https://data.medicaid.gov/api/1/datastore/sql`;
    const query = `[SELECT * FROM ${datasetId}][LIMIT 3]`;

    const response = await axios.post(url, { query }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Success!');
    console.log('Results:', response.data.length || 'N/A', 'records');
    if (response.data.length > 0) {
      console.log('\nFirst record:');
      console.log(JSON.stringify(response.data[0], null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testEnrollment();
