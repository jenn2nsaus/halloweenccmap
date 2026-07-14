// Runs inside the GitHub Action. Reads the submitted fields from environment
// variables (set from the repository_dispatch client_payload), geocodes the
// address with OpenStreetMap's free Nominatim service, and appends the new
// pin to data/locations.json.
//
// The Stepper HTTP Request step's JSON body editor can only build flat
// string values per row — it can't produce a genuine nested object for
// client_payload, and hand-typing JSON syntax around free-text fields
// (like the description) is fragile, since any stray quote character in
// someone's submission would corrupt the JSON. So instead, Stepper sends
// client_payload as ONE plain string with fields joined by "###", in a
// fixed order: name###address###hours###treats###allergens###description

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_PATH = path.join(__dirname, '..', 'data', 'locations.json');

const FIELD_ORDER = ['name', 'address', 'hours', 'treats', 'allergens', 'description'];
const DELIMITER = '###';

const rawPayload = process.env.LOCATION_PAYLOAD || '';
const parts = rawPayload.split(DELIMITER).map((s) => s.trim());

const fields = {};
FIELD_ORDER.forEach((key, i) => {
  fields[key] = parts[i] || '';
});

const { name: rawName, address, hours, treats: rawTreats, allergens: allergensRaw, description } = fields;
const name = rawName || 'A neighbor';

// Treats and allergens may come through as a plain comma-joined string
// (the common default when a platform stringifies a multi-select array),
// or already as clean text — either way, tidy it into one comma-separated line.
function tidyCommaList(value) {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

const treats = rawTreats ? tidyCommaList(rawTreats) : '';

// Allergens display as individual badges, so keep this one as an array.
const allergens = allergensRaw
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

// Roughly covers the Central Coast NSW LGA, Woy Woy up to Budgewoi.
// Format is left,top,right,bottom (lon_min,lat_max,lon_max,lat_min).
const VIEWBOX = '151.15,-33.15,151.50,-33.65';

if (!address) {
  console.error('No address was provided in the dispatch payload. Aborting.');
  console.error('Raw payload received:', JSON.stringify(rawPayload));
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
      // Nominatim's usage policy requires a real identifying User-Agent.
      // Replace the email below with a real contact address.
      'User-Agent': 'trick-or-treat-map (community project; contact: you@example.com)',
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
    photo: '',
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
