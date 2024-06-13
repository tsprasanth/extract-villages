const express = require('express');
const cheerio = require('cheerio');
const fs = require('fs');
const app = express();
const port = 3000;

// Function to remove duplicates
const removeDuplicates = (data) => {
  const uniqueData = [];
  const dataSet = new Set();

  for (const item of data) {
    const identifier = `${item.districtId}-${item.talukId}-${item.hobliId}-${item.villageId}`;
    if (!dataSet.has(identifier)) {
      dataSet.add(identifier);
      uniqueData.push(item);
    }
  }

  return uniqueData;
};

// Function to scrape the HTML and extract village data
const scrapeVillages = (html) => {
  const $ = cheerio.load(html);
  const districtId = $('#ctl00_MainContent_ddlCDistrict').val();
  const districtValue = $('#ctl00_MainContent_ddlCDistrict option:selected').text();
  const talukId = $('#ctl00_MainContent_ddlCTaluk').val();
  const talukValue = $('#ctl00_MainContent_ddlCTaluk option:selected').text();
  const hobliId = $('#ctl00_MainContent_ddlCHobli').val();
  const hobliValue = $('#ctl00_MainContent_ddlCHobli option:selected').text();
  const villages = [];

  $('#ctl00_MainContent_ddlCVillage option').each((index, element) => {
    const villageId = $(element).val();
    const villageValue = $(element).text();
    if (villageId !== "0") { // Exclude the "Select Village" option
      villages.push({ districtId, districtValue, talukId, talukValue, hobliId, hobliValue, villageId, villageValue });
    }
  });

  return villages;
};

// Setting up the express app
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Serve the extracted_villages.json file
app.get('/extracted_villages.json', (req, res) => {
  if (fs.existsSync('extracted_villages.json')) {
    res.sendFile(__dirname + '/extracted_villages.json');
  } else {
    res.json([]);
  }
});

app.get('/', (req, res) => {
  let villagesLength = 'N/A';

  if (fs.existsSync('extracted_villages.json')) {
    const extractedVillages = JSON.parse(fs.readFileSync('extracted_villages.json', 'utf8'));
    villagesLength = extractedVillages.length;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fetch Villages</title>
    </head>
    <body>
        <h1>Fetch Villages</h1>
        <form id="htmlForm">
            <label for="htmlInput">Paste HTML:</label>
            <textarea id="htmlInput" name="htmlInput" rows="20" cols="100" required></textarea>
            <br><br>
            <input type="submit" value="Scrape">
        </form>

        <h2>The length of extracted_villages file is <span id="villagesLength">${villagesLength}</span></h2>

        <h2>Extracted Villages</h2>
        <pre id="extractedVillages"></pre>

        <script>
            async function fetchVillagesData() {
                const response = await fetch('/extracted_villages.json');
                const villagesData = await response.json();
                document.getElementById('extractedVillages').textContent = JSON.stringify(villagesData, null, 2);
                document.getElementById('villagesLength').textContent = villagesData.length;
            }

            document.getElementById('htmlForm').onsubmit = async function(event) {
                event.preventDefault();
                const htmlInput = document.getElementById('htmlInput').value;

                try {
                    const response = await fetch('/scrape-html', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ html: htmlInput })
                    });
                    const result = await response.json();

                    fetchVillagesData();
                } catch (error) {
                    document.getElementById('extractedVillages').textContent = \`Error: \${error.message}\`;
                }
            };

            // Fetch and display the villages data on page load
            fetchVillagesData();
        </script>
    </body>
    </html>
  `);
});

app.post('/scrape-html', (req, res) => {
  const html = req.body.html;
  const villages = scrapeVillages(html);

  let allVillages = [];
  if (fs.existsSync('extracted_villages.json')) {
    allVillages = JSON.parse(fs.readFileSync('extracted_villages.json', 'utf8'));
  }

  // Append new villages to the existing data
  allVillages = allVillages.concat(villages);

  // Remove duplicates
  allVillages = removeDuplicates(allVillages);

  // Save the data to avoid data loss
  fs.writeFileSync('extracted_villages.json', JSON.stringify(allVillages, null, 2), 'utf-8');

  res.json({ villages });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// Export the app for Vercel
module.exports = app;
