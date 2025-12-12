// Quick test of NADAC API endpoint
const axios = require('axios');

async function testNADAC() {
  try {
    console.log('Testing NADAC endpoint...');
    
    const response = await axios.get('https://data.medicaid.gov/resource/tau9-gfwr.json', {
      params: {
        '$where': "ndc_description like '%semaglutide%'",
        '$limit': 5,
        '$order': 'effective_date DESC'
      }
    });

    console.log(`\nSuccess! Found ${response.data.length} records`);
    console.log('\nFirst result:');
    console.log(JSON.stringify(response.data[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testNADAC();
