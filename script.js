// The Peninsula: Woy Woy, Blackwall, Ettalong Beach, Booker Bay, Umina Beach
// down to Pearl Beach — the strip of land between Brisbane Water and Broken Bay.
// MapLibre uses [lng, lat] order (unlike Leaflet's [lat, lng]).
const PENINSULA_BOUNDS = [
  [151.295, -33.55], // south-west
  [151.34, -33.47], // north-east
];

const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Same outlined jack-o-lantern used in the header, reused for every map pin.
const PUMPKIN_ICON_SVG = `
  <svg class="pumpkin-icon pumpkin-icon-marker" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M46,12 Q44,4 50,3 Q56,4 54,12 L53,20 L47,20 Z" />
    <ellipse cx="50" cy="58" rx="40" ry="32" />
    <path d="M28,48 L40,48 L32,60 Z" />
    <path d="M72,48 L60,48 L68,60 Z" />
    <path d="M26,70 L34,78 L42,70 L50,78 L58,70 L66,78 L74,70" />
  </svg>
`;

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
    'building',
  ]);

  const EXACT_FILL_COLORS = {
    park: '#26163a',
    landcover_wood: '#26163a',
    landcover_grass: '#26163a',
    landcover_wetland: '#26163a',
    landcover_mangrove: '#26163a',
    landcover_swamp: '#26163a',
    landuse_pitch: '#26163a',
    landuse_track: '#26163a',
    landcover_sand: '#26163a',
    landuse_residential: '#1f1a2b',
    landuse_school: '#1f1a2b',
    landuse_hospital: '#1f1a2b',
    landuse_cemetery: '#1f1a2b',
    water: '#0f2a4a',
  };

  const LINE_COLORS = {
    park_outline: '#3a2050',
    waterway_tunnel: '#0f2a4a',
    waterway_river: '#0f2a4a',
    waterway_other: '#0f2a4a',
  };

  // Simplified to two tiers instead of one color per road class — the
  // whole point is a calmer, less "detailed" road network, with the
  // neon landmarks doing the visual work instead.
  const MAJOR_ROAD = { casing: '#3a3540', fill: '#4a4550' };
  const MINOR_ROAD = { casing: '#221e2a', fill: '#2e2836' };
  const ROAD_COLORS = {
    motorway: MAJOR_ROAD,
    trunk: MAJOR_ROAD,
    primary: MAJOR_ROAD,
    secondary: MAJOR_ROAD,
    tertiary: MAJOR_ROAD,
    link: MAJOR_ROAD,
    minor: MINOR_ROAD,
    service: MINOR_ROAD,
    track: MINOR_ROAD,
    path: MINOR_ROAD,
    pedestrian: MINOR_ROAD,
    rail: MINOR_ROAD,
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
      return { ...layer, paint: { ...layer.paint, 'background-color': '#0a0a10' } };
    }

    if (layer.type === 'fill' && layer.id in EXACT_FILL_COLORS) {
      // Some layers (like wetland) use a repeating icon fill-pattern instead
      // of a flat color, which silently overrides fill-color if left in place.
      const newPaint = { ...layer.paint, 'fill-color': EXACT_FILL_COLORS[layer.id] };
      delete newPaint['fill-pattern'];
      return { ...layer, paint: newPaint };
    }

    if (layer.type === 'line' && layer.id in LINE_COLORS) {
      return { ...layer, paint: { ...layer.paint, 'line-color': LINE_COLORS[layer.id] } };
    }

    if (sourceLayer === 'water_name') {
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': '#9fd6f5',
          'text-halo-color': 'rgba(6, 6, 12, 0.95)',
          'text-halo-width': 2,
        },
      };
    }

    if (sourceLayer === 'transportation_name') {
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': '#a89ec2',
          'text-halo-color': 'rgba(10, 10, 16, 0.85)',
          'text-halo-width': 1.2,
        },
      };
    }

    if (sourceLayer === 'place') {
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': '#c9bfe8',
          'text-halo-color': 'rgba(10, 10, 16, 0.85)',
          'text-halo-width': 1.5,
        },
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
  YF: 'Dye Free',
};

function renderAllergenLegend() {
  const legendEl = document.getElementById('allergen-legend');
  const ORDER = ['GF', 'DF', 'NF', 'EF', 'SF', 'YF'];

  legendEl.classList.remove('hidden');
  legendEl.innerHTML = ORDER.map((code) => {
    const label = ALLERGEN_LABELS[code] || code;
    return `<span class="legend-item"><span class="legend-badge">${escapeHtml(code)}</span> ${escapeHtml(label)}</span>`;
  }).join('');
}

function renderLocations(map, locations) {
  const countEl = document.getElementById('house-count');
  const emptyEl = document.getElementById('empty-state');

  if (!locations || locations.length === 0) {
    countEl.textContent = '0 houses registered';
    emptyEl.classList.remove('hidden');
    renderAllergenLegend();
    return;
  }

  emptyEl.classList.add('hidden');
  countEl.textContent = `${locations.length} house${locations.length === 1 ? '' : 's'} registered`;
  renderAllergenLegend();

  locations.forEach((loc) => {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

    const el = document.createElement('div');
    el.className = 'pumpkin-marker';
    el.innerHTML = PUMPKIN_ICON_SVG;

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
