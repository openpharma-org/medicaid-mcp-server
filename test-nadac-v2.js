// Test NADAC API with correct endpoint
const axios = require('axios');

async function testNADAC() {
  try {
    console.log('Testing NADAC endpoint (a4y5-998d)...\n');

    const response = await axios.get('https://data.medicaid.gov/resource/a4y5-998d.json', {
      params: {
        '$where': "ndc_description like '%SEMAGLUTIDE%'",
        '$limit': 3
      },
      timeout: 30000
    });

    console.log(`Success! Found ${response.data.length} records\n`);

    if (response.data.length > 0) {
      console.log('Sample result:');
      const drug = response.data[0];
      console.log('NDC:', drug.ndc_11_digit_ndcs || drug.ndc || 'N/A');
      console.log('Description:', drug.ndc_description || 'N/A');
      console.log('NADAC Per Unit:', drug.nadac_per_unit || 'N/A');
      console.log('Effective Date:', drug.effective_date || drug.as_of_date || 'N/A');
      console.log('\nFull record:');
      console.log(JSON.stringify(drug, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testNADAC();
