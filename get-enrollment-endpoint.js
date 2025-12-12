const axios = require('axios');

async function getEnrollmentEndpoint() {
  try {
    // Get enrollment dataset metadata
    const response = await axios.get(
      'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/6165f45b-ca93-5bb5-9d06-db29c692a360'
    );

    const dataset = response.data;
    console.log('Dataset:', dataset.title, '\n');

    if (dataset.distribution && dataset.distribution[0]) {
      const dist = dataset.distribution[0];
      console.log('Distribution format:', dist.format);
      console.log('Download URL:', dist.downloadURL);
      
      if (dist.data && dist.data.identifier) {
        console.log('Data identifier:', dist.data.identifier);
        
        // Try querying with this identifier
        console.log('\nTrying SQL query...');
        const sqlUrl = 'https://data.medicaid.gov/api/1/datastore/sql';
        const query = `[SELECT * FROM ${dist.data.identifier}][LIMIT 3]`;

        const sqlResponse = await axios.post(sqlUrl, { query }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        console.log('Success! Got', sqlResponse.data.length, 'records');
        if (sqlResponse.data.length > 0) {
          console.log('\nSample record keys:', Object.keys(sqlResponse.data[0]));
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

getEnrollmentEndpoint();
