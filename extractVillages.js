const express = require('express');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();  // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Define a schema and model for the villages
const villageSchema = new mongoose.Schema({
  districtId: String,
  districtValue: String,
  talukId: String,
  talukValue: String,
  hobliId: String,
  hobliValue: String,
  villageId: String,
  villageValue: String
});
const Village = mongoose.model('Village', villageSchema);

// Function to remove duplicates
const removeDuplicates = async (data) => {
  const uniqueData = [];
  const dataSet = new Set();

  for (const item of data) {
    const identifier = `${item.districtId}-${item.talukId}-${item.hobliId}-${item.villageId}`;
    if (!dataSet.has(identifier)) {
      dataSet.add(identifier);
      uniqueData.push(item);
    }
  }

  // Clear the collection and insert unique data
  await Village.deleteMany({});
  await Village.insertMany(uniqueData);

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

// Serve the extracted_villages.json file (from MongoDB)
app.get('/extracted_villages.json', async (req, res) => {
  const villages = await Village.find();
  res.json(villages);
});

app.get('/', async (req, res) => {
  const villages = await Village.find();
  const villagesLength = villages.length;

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
                //document.getElementById('extractedVillages').textContent = JSON.stringify(villagesData, null, 2);
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
                    console.log('Error during fetch:', error);
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

app.post('/scrape-html', async (req, res) => {
  const html = req.body.html;
  const villages = scrapeVillages(html);

  // Append new villages to the existing data
  let allVillages = await Village.find();
  allVillages = allVillages.concat(villages);

  // Remove duplicates and update database
  const uniqueVillages = await removeDuplicates(allVillages);

  res.json({ villages: uniqueVillages });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// Export the app for Vercel
module.exports = app;
