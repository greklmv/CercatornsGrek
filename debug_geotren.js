
const fs = require('fs');

async function fetchData() {
    try {
        const response = await fetch('https://dadesobertes.fgc.cat/api/v2/catalog/datasets/posicionament-dels-trens/exports/json');
        const data = await response.json();
        fs.writeFileSync('geotren_sample.json', JSON.stringify(data, null, 2));
        console.log('Data saved to geotren_sample.json');
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchData();
