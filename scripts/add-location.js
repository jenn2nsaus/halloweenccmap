// Runs inside the GitHub Action. Reads the submitted fields from
// client_payload (a real nested object — sent by a Stepper "Code" step
// using fetch() + JSON.stringify(), not the flat HTTP Request body editor),
// geocodes the address with OpenStreetMap's free Nominatim service, and
// appends the new pin to data/locations.json.

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_PATH = path.join(__dirname, '..', 'data', 'locations.json');

const name = process.env.LOCATION_NAME || 'A neighbor';
const address = process.env.LOCATION_ADDRESS;
const hours = process.env.LOCATION_HOURS || '';
const treats = process.env.LOCATION_TREATS || '';
const allergensRaw = process.env.LOCATION_ALLERGENS || '';
const description = process.env.LOCATION_DESCRIPTION || '';

// Allergens display as individual badges — split on comma/semicolon
// regardless of whether the source was a single code or several joined.
const allergens = allergensRaw
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

// Roughly covers the Central Coast NSW LGA, Woy Woy up to Budgewoi.
// Format is left,top,right,bottom (lon_min,lat_max,lon_max,lat_min).
const VIEWBOX = '151.15,-33.15,151.50,-33.65';

if (!address) {
  console.error('No address was provided in the dispatch payload. Aborting.');
  process.exit(1);
}

function geocode(query) {
  const params = new URLSearchParams({
    q: `${query}, Central Coast, NSW, Australia`,
    format: 'json',
    limit: '1',
    countrycodes: 'au',
    viewbox: VIEWBOX,
  });

  const options = {
    hostname: 'nominatim.openstreetmap.org',
    path: `/search?${params.toString()}`,
    headers: {
      'User-Agent': 'trick-or-treat-map (community project; contact: jenn2nsaus@gmail.com)',
    },
  };

  return new Promise((resolve, reject) => {
    https
      .get(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const results = await geocode(address);

  if (!results || results.length === 0) {
    console.error(`Could not geocode address: "${address}". Skipping.`);
    process.exit(1);
  }

  const { lat, lon } = results[0];

  const raw = fs.existsSync(DATA_PATH) ? fs.readFileSync(DATA_PATH, 'utf8') : '[]';
  const locations = JSON.parse(raw || '[]');

  locations.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    address,
    hours,
    treats,
    allergens,
    description,
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    submittedAt: new Date().toISOString(),
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(locations, null, 2) + '\n');
  console.log(`Added "${name}" at ${address} -> (${lat}, ${lon})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
