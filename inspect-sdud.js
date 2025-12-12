/**
 * Inspect SDUD API response to understand data structure
 */

const axios = require('axios');

async function inspectSDUD() {
  console.log('Inspecting State Drug Utilization Data API...\n');

  const sdudUrl = 'https://data.medicaid.gov/api/1/datastore/query/61729e5a-7aa8-448c-8903-ba3e0cd0ea3c/0';
  const sdudQuery = {
    conditions: [
      { property: 'state', value: 'IL', operator: '=' }
    ],
    limit: 10,
    offset: 0
  };

  try {
    const response = await axios.post(sdudUrl, sdudQuery, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify(response.headers, null, 2));
    console.log('\nResponse data keys:', Object.keys(response.data));
    console.log('\nFull response (first 10 records):');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

inspectSDUD();
