const axios = require('axios');

async function checkFileSizes() {
  const datasets = [
    {
      name: 'NADAC 2024',
      id: '99315a95-37ac-4eee-946a-3c523b4c481e'
    },
    {
      name: 'Enrollment Snapshot',
      id: '6165f45b-ca93-5bb5-9d06-db29c692a360'
    }
  ];

  for (const dataset of datasets) {
    try {
      console.log(`\n${dataset.name}:`);
      console.log('=' .repeat(50));
      
      const metaResponse = await axios.get(
        `https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/${dataset.id}`
      );

      const data = metaResponse.data;
      
      if (data.distribution && data.distribution[0]) {
        const dist = data.distribution[0];
        const downloadUrl = dist.downloadURL;
        
        console.log('Format:', dist.format);
        console.log('Download URL:', downloadUrl);
        
        // Get file size via HEAD request
        try {
          const headResponse = await axios.head(downloadUrl, { timeout: 10000 });
          const contentLength = headResponse.headers['content-length'];
          
          if (contentLength) {
            const sizeInMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
            console.log('File Size:', sizeInMB, 'MB');
            console.log('Size in bytes:', parseInt(contentLength).toLocaleString());
          } else {
            console.log('File Size: Unknown (no Content-Length header)');
          }
        } catch (error) {
          console.log('Could not get file size:', error.message);
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

checkFileSizes();
