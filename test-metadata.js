const axios = require('axios');

async function getDataEndpoint() {
  try {
    const response = await axios.get(
      'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/99315a95-37ac-4eee-946a-3c523b4c481e'
    );

    const dataset = response.data;
    console.log('Dataset Title:', dataset.title);
    console.log('\nDistributions:');

    if (dataset.distribution) {
      dataset.distribution.forEach((dist, idx) => {
        console.log('\n' + (idx + 1) + '. Format:', dist.format || dist.mediaType);
        console.log('   Download URL:', dist.downloadURL);
        console.log('   Access URL:', dist.accessURL);
        if (dist.data && dist.data.identifier) {
          console.log('   Data ID:', dist.data.identifier);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getDataEndpoint();
