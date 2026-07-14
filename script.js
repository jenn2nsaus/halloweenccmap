// The Peninsula: Woy Woy, Blackwall, Ettalong Beach, Booker Bay, Umina Beach
// down to Pearl Beach — the strip of land between Brisbane Water and Broken Bay.
// MapLibre uses [lng, lat] order (unlike Leaflet's [lat, lng]).
const PENINSULA_BOUNDS = [
  [151.295, -33.55], // south-west
  [151.34, -33.47], // north-east
];

const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Turns the realistic "road atlas" OpenFreeMap/Liberty style into something
// bright, pastel, and uncluttered: hides icon/label layers that aren't useful
// for a neighborhood route (shops, airports, borders, house numbers), and
// recolors land, water, parks, buildings, and roads into a friendlier palette.
function funifyStyle(baseStyle) {
  const style = JSON.parse(JSON.stringify(baseStyle));

  const HIDE_SOURCE_LAYERS = new Set([
    'poi',
    'housenumber',
    'aeroway',
    'aerodrome_label',
    'mountain_peak',
    'boundary',
  ]);

  const EXACT_FILL_COLORS = {
    park: '#BFE8C9',
    landcover_wood: '#CFEAD2',
    landcover_grass: '#DDF2D2',
    landuse_pitch: '#DDF2D2',
    landuse_track: '#DDF2D2',
    landuse_residential: '#FFF4E6',
    water: '#9AD8F2',
  };

  const LINE_COLORS = {
    park_outline: '#CDEBD2',
    waterway_tunnel: '#9AD8F2',
    waterway_river: '#9AD8F2',
    waterway_other: '#9AD8F2',
  };

  const ROAD_COLORS = {
    motorway: { casing: '#F2704A', fill: '#FFCBA8' },
    trunk: { casing: '#F2A65A', fill: '#FFE0B2' },
    primary: { casing: '#F2A65A', fill: '#FFE0B2' },
    secondary: { casing: '#F2C14E', fill: '#FFF3C4' },
    tertiary: { casing: '#F2C14E', fill: '#FFF3C4' },
    link: { casing: '#F2A65A', fill: '#FFE0B2' },
    minor: { casing: '#E7DCF7', fill: '#FFFFFF' },
    service: { casing: '#EDE7DE', fill: '#FBF9F5' },
    track: { casing: '#EDE7DE', fill: '#FBF9F5' },
    path: { casing: '#5FC9C9', fill: '#5FC9C9' },
    pedestrian: { casing: '#5FC9C9', fill: '#5FC9C9' },
    rail: { casing: '#C9BEDD', fill: '#C9BEDD' },
  };
  const ROAD_ORDER = [
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'link', 'minor', 'service', 'track', 'path', 'pedestrian', 'rail',
  ];

  style.layers = style.layers.map((layer) => {
    const sourceLayer = layer['source-layer'];

    if (sourceLayer && HIDE_SOURCE_LAYERS.has(sourceLayer)) {
      return { ...layer, layout: { ...(layer.layout || {}), visibility: 'none' } };
    }

    if (layer.id === 'background') {
      return { ...layer, paint: { ...layer.paint, 'background-color': '#FFF8ED' } };
    }

    if (layer.type === 'fill' && layer.id in EXACT_FILL_COLORS) {
      return { ...layer, paint: { ...layer.paint, 'fill-color': EXACT_FILL_COLORS[layer.id] } };
    }

    if (layer.type === 'line' && layer.id in LINE_COLORS) {
      return { ...layer, paint: { ...layer.paint, 'line-color': LINE_COLORS[layer.id] } };
    }

    if (layer.id === 'building' && layer.type === 'fill') {
      return {
        ...layer,
        paint: { ...layer.paint, 'fill-color': '#FDEBD3', 'fill-outline-color': '#F2D9B8' },
      };
    }

    if (sourceLayer === 'water_name') {
      return {
        ...layer,
        paint: { ...layer.paint, 'text-color': '#1F7A99', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.2 },
      };
    }

    if (sourceLayer === 'transportation_name') {
      return {
        ...layer,
        paint: { ...layer.paint, 'text-color': '#6B4A2B', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.2 },
      };
    }

    if (sourceLayer === 'place') {
      return {
        ...layer,
        paint: { ...layer.paint, 'text-color': '#5C3A63', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
      };
    }

    if (sourceLayer === 'transportation' && (layer.type === 'line' || layer.type === 'fill')) {
      const category = ROAD_ORDER.find((key) => layer.id.includes(key));
      if (category) {
        const isCasing = layer.id.includes('casing');
        const color = isCasing ? ROAD_COLORS[category].casing : ROAD_COLORS[category].fill;
        const paintKey = layer.type === 'line' ? 'line-color' : 'fill-color';
        return { ...layer, paint: { ...layer.paint, [paintKey]: color } };
      }
    }

    return layer;
  });

  return style;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Full names for the allergen badge codes. Only codes actually in use
// across current locations get shown in the header legend.
const ALLERGEN_LABELS = {
  GF: 'Gluten Free',
  DF: 'Dairy Free',
  NF: 'Nut Free',
  EF: 'Egg Free',
  SF: 'Soy Free',
  YF: 'Yeast Free',
};

function renderAllergenLegend(locations) {
  const legendEl = document.getElementById('allergen-legend');

  const codesInUse = new Set();
  locations.forEach((loc) => {
    (Array.isArray(loc.allergens) ? loc.allergens : []).forEach((code) => codesInUse.add(code));
  });

  if (codesInUse.size === 0) {
    legendEl.classList.add('hidden');
    return;
  }

  legendEl.classList.remove('hidden');
  legendEl.innerHTML = [...codesInUse]
    .sort()
    .map((code) => {
      const label = ALLERGEN_LABELS[code] || code;
      return `<span class="legend-item"><span class="badge">${escapeHtml(code)}</span> ${escapeHtml(label)}</span>`;
    })
    .join('');
}

function renderLocations(map, locations) {
  const countEl = document.getElementById('house-count');
  const emptyEl = document.getElementById('empty-state');

  if (!locations || locations.length === 0) {
    countEl.textContent = '0 houses registered';
    emptyEl.classList.remove('hidden');
    renderAllergenLegend([]);
    return;
  }

  emptyEl.classList.add('hidden');
  countEl.textContent = `${locations.length} house${locations.length === 1 ? '' : 's'} registered`;
  renderAllergenLegend(locations);

  locations.forEach((loc) => {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

    const el = document.createElement('div');
    el.className = 'pumpkin-marker';
    el.textContent = '🎃';

    const name = escapeHtml(loc.name || 'A neighbor');
    const address = escapeHtml(loc.address || '');
    const hours = escapeHtml(loc.hours || '');
    const treats = escapeHtml(loc.treats || '');
    const description = escapeHtml(loc.description || '');
    const photo = loc.photo || '';
    const allergens = Array.isArray(loc.allergens) ? loc.allergens : [];

    const badgesHtml = allergens.length
      ? `<div class="allergen-badges">${allergens
          .map((a) => `<span class="badge">${escapeHtml(a)}</span>`)
          .join('')}</div>`
      : '';

    const photoHtml = photo
      ? `<img class="popup-photo" src="${escapeHtml(photo)}" alt="${name}" loading="lazy" onerror="this.remove()" />`
      : '';

    const popupHtml = `
      ${photoHtml}
      <h3>${name}</h3>
      ${address ? `<p class="popup-address">${address}</p>` : ''}
      ${hours ? `<p class="popup-hours">🕒 ${hours}</p>` : ''}
      ${treats ? `<p class="popup-treats">🍬 ${treats}</p>` : ''}
      ${description ? `<p class="popup-description">${description}</p>` : ''}
      ${badgesHtml}
    `;

    const popup = new maplibregl.Popup({ offset: 20, maxWidth: '260px' }).setHTML(popupHtml);

    new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([loc.lng, loc.lat])
      .setPopup(popup)
      .addTo(map);
  });
}

function loadLocations(map) {
  fetch('data/locations.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load locations.json (${res.status})`);
      return res.json();
    })
    .then((locations) => renderLocations(map, locations))
    .catch((err) => {
      console.error(err);
      document.getElementById('house-count').textContent = 'Could not load houses';
    });
}

async function buildMap() {
  let style;
  try {
    const baseStyle = await fetch(BASE_STYLE_URL).then((res) => res.json());
    style = funifyStyle(baseStyle);
  } catch (err) {
    console.error('Could not load/restyle the base map, falling back to default look.', err);
    style = BASE_STYLE_URL;
  }

  const map = new maplibregl.Map({
    container: 'map',
    style,
    bounds: PENINSULA_BOUNDS,
    fitBoundsOptions: { padding: 20 },
    attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: 'Map data © OpenStreetMap contributors · Tiles by OpenFreeMap',
    })
  );

  map.on('load', () => loadLocations(map));
}

buildMap();
