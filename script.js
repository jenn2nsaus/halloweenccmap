// The Peninsula: Woy Woy, Blackwall, Ettalong Beach, Booker Bay, Umina Beach
// down to Pearl Beach — the strip of land between Brisbane Water and Broken Bay.
const PENINSULA_BOUNDS = [
  [-33.55, 151.295],
  [-33.47, 151.34],
];

const map = L.map('map', {
  zoomControl: true,
}).fitBounds(PENINSULA_BOUNDS);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20,
}).addTo(map);

const pumpkinIcon = L.divIcon({
  className: '',
  html: '<div class="pumpkin-marker">🎃</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 20],
  popupAnchor: [0, -18],
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderLocations(locations) {
  const countEl = document.getElementById('house-count');
  const emptyEl = document.getElementById('empty-state');

  if (!locations || locations.length === 0) {
    countEl.textContent = '0 houses registered';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  countEl.textContent = `${locations.length} house${locations.length === 1 ? '' : 's'} registered`;

  locations.forEach((loc) => {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

    const marker = L.marker([loc.lat, loc.lng], { icon: pumpkinIcon }).addTo(map);

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

    marker.bindPopup(
      `
      ${photoHtml}
      <h3>${name}</h3>
      ${address ? `<p class="popup-address">${address}</p>` : ''}
      ${hours ? `<p class="popup-hours">🕒 ${hours}</p>` : ''}
      ${treats ? `<p class="popup-treats">🍬 ${treats}</p>` : ''}
      ${description ? `<p class="popup-description">${description}</p>` : ''}
      ${badgesHtml}
    `,
      { maxWidth: 260 }
    );
  });
}

fetch('data/locations.json', { cache: 'no-store' })
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load locations.json (${res.status})`);
    return res.json();
  })
  .then(renderLocations)
  .catch((err) => {
    console.error(err);
    document.getElementById('house-count').textContent = 'Could not load houses';
  });
