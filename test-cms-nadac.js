const axios = require('axios');

async function testCMSNADAC() {
  // Try data.cms.gov NADAC endpoints
  const endpoints = [
    'https://data.cms.gov/resource/cng4-92f3.json',  // Known working endpoint from Socrata dev portal
    'https://data.cms.gov/data-api/v1/dataset/cng4-92f3/data'  // Alternative API format
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting: ${endpoint}`);
      const response = await axios.get(endpoint, {
        params: {
          '$limit': 3,
          '$where': "ndc_description like '%SEMAGLUTIDE%'"
        },
        timeout: 30000
      });

      console.log('✓ Success!');
      console.log('Records:', response.data.length);
      
      if (response.data.length > 0) {
        const drug = response.data[0];
        console.log('\nSample:');
        console.log('  NDC:', drug.ndc || 'N/A');
        console.log('  Description:', drug.ndc_description || 'N/A');
        console.log('  NADAC:', drug.nadac_per_unit || 'N/A');
        console.log('  Date:', drug.effective_date || drug.as_of_date || 'N/A');
        break;  // Found working endpoint
      }
    } catch (error) {
      console.log('✗ Failed:', error.response?.status || error.message);
    }
  }
}

testCMSNADAC();
