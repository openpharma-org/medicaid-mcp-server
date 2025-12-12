const axios = require('axios');

async function downloadSample() {
  const urls = [
    {
      name: 'NADAC 2024',
      url: 'https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-12-25-2024.csv'
    },
    {
      name: 'Enrollment',
      url: 'https://download.medicaid.gov/data/pi-dataset-november-2025release.csv'
    }
  ];

  for (const dataset of urls) {
    try {
      console.log('\nDownloading ' + dataset.name + '...');

      const response = await axios.get(dataset.url, {
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024,  // 100MB max
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const mb = (progressEvent.loaded / 1024 / 1024).toFixed(2);
            process.stdout.write('\rProgress: ' + percent + '% (' + mb + ' MB)');
          }
        }
      });

      const sizeInMB = (Buffer.byteLength(response.data) / (1024 * 1024)).toFixed(2);
      console.log('\nDownloaded: ' + sizeInMB + ' MB');

      // Count lines
      const lines = response.data.split('\n').length;
      console.log('Records: ~' + (lines - 1).toLocaleString() + ' (excluding header)');

      // Show first 3 lines
      const firstLines = response.data.split('\n').slice(0, 3);
      console.log('\nFirst lines:');
      firstLines.forEach((line, idx) => {
        if (line) {
          const truncated = line.length > 100 ? line.substring(0, 100) + '...' : line;
          console.log('  ' + idx + ': ' + truncated);
        }
      });

    } catch (error) {
      console.error('Error: ' + error.message);
      if (error.response) {
        console.error('Status: ' + error.response.status);
      }
    }
  }
}

downloadSample();
