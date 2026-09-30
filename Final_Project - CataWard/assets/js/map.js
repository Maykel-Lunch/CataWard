/**
 * CataWard — Sorsogon Hazard Map
 * map.js
 *
 * Architecture notes
 * ------------------
 * • SOURCES_URL  — loads assets/data/sources.json (the canonical data catalog)
 * • Each hazard layer is described in sources.json; status:"available" means a
 *   corresponding GeoJSON file exists at assets/data/<key>_hazard.geojson.
 * • No API keys are present in this file.
 * • The map deliberately shows the province boundary from GADM data embedded
 *   below as a minimal inline GeoJSON so the map is useful even when all
 *   hazard layers are unavailable. A full GADM download is not needed at
 *   runtime; this small boundary was derived from the GADM PHL level-2
 *   dataset (non-commercial use, see sources.json).
 *
 * Data safety rules (enforced here)
 * -----------------------------------
 * 1. No hazard polygons or point data is fabricated.
 * 2. If a layer file is missing/fails, a clear "unavailable" state is shown.
 * 3. Geolocation is opt-in only (user must press "Locate Me").
 * 4. The disclaimer banner is always visible.
 */

'use strict';

/* ============================================================
   Constants
   ============================================================ */

const SOURCES_URL = '../assets/data/sources.json';

/**
 * Sorsogon Province approximate bounding box (WGS84).
 * Used to set the initial map view.
 * Source: GADM data cross-referenced with OSM; no hazard implication.
 */
const SORSOGON_BOUNDS = [[12.53, 123.72], [13.15, 124.33]];

/**
 * Sorsogon Province centre (approx).
 */
const SORSOGON_CENTER = [12.84, 124.00];
const SORSOGON_ZOOM   = 10;

/**
 * Hazard layer metadata that the UI uses (colours, labels, guide links).
 * "status" is overridden at runtime from sources.json.
 */
const HAZARD_CONFIG = {
  typhoon:    { label: 'Typhoon',    emoji: '🌀', color: '#2196f3', guide: '../contents/Typhoon.html' },
  flood:      { label: 'Flood',      emoji: '🌊', color: '#1e88e5', guide: '../contents/Flood.html' },
  earthquake: { label: 'Earthquake', emoji: '🏔️', color: '#e53935', guide: '../contents/Earthquake.html' },
  landslide:  { label: 'Landslide',  emoji: '⛰️', color: '#795548', guide: '../contents/Landslide.html' },
  tsunami:    { label: 'Tsunami',    emoji: '🌊', color: '#00acc1', guide: '../contents/Tsunami.html' },
};

/* ============================================================
   Minimal province boundary (GeoJSON)
   ============================================================
   Derived from GADM Philippines Level-2 (non-commercial use).
   Source: https://gadm.org/download_country.html#PHI
   This is a simplified bounding polygon sufficient to orient the
   viewer on the province extent. It is NOT a precise cadastral
   boundary and must NOT be interpreted as a hazard zone.
   Accessed: 2026-09-27
*/
const PROVINCE_BOUNDARY_GEOJSON = {
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": {
      "name": "Sorsogon Province",
      "note": "Approximate reference boundary. Source: GADM v4.1, non-commercial use. Not a hazard zone boundary."
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [123.7250, 12.5350],
        [123.8900, 12.5000],
        [124.0500, 12.5100],
        [124.2100, 12.5800],
        [124.3200, 12.6800],
        [124.3300, 12.7800],
        [124.2800, 12.8900],
        [124.2000, 12.9900],
        [124.1000, 13.0600],
        [123.9500, 13.1400],
        [123.8000, 13.1350],
        [123.6800, 13.0800],
        [123.6100, 12.9800],
        [123.5900, 12.8500],
        [123.6300, 12.7300],
        [123.7250, 12.5350]
      ]]
    }
  }]
};

/* ============================================================
   State
   ============================================================ */

let map          = null;   // Leaflet map instance
let sources      = null;   // loaded sources.json
let activeHazard = null;   // currently active hazard key or null
let activeLayer  = null;   // currently displayed Leaflet GeoJSON layer
let provinceLayer = null;  // reference boundary layer (always shown)

/* ============================================================
   Initialisation
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadSources();
  wireUI();
});

function initMap() {
  map = L.map('hazard-map', {
    center: SORSOGON_CENTER,
    zoom: SORSOGON_ZOOM,
    zoomControl: true,
  });

  /* Basemap — CARTO Positron (light, readable, open)
     Attribution required by OpenStreetMap ODbL and CARTO terms. */
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' +
        ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ).addTo(map);

  /* Province boundary */
  provinceLayer = L.geoJSON(PROVINCE_BOUNDARY_GEOJSON, {
    style: {
      color: '#16c92a',
      weight: 2.5,
      fill: false,
      dashArray: '5 4',
      opacity: 0.8,
    },
  })
    .bindTooltip('Sorsogon Province<br><small>Reference boundary (GADM)</small>', { sticky: true })
    .addTo(map);

  /* Fit to province extent */
  map.fitBounds(SORSOGON_BOUNDS, { padding: [10, 10] });

  /* Keyboard: zoom with +/- works by default in Leaflet */
}

/* ============================================================
   Load sources catalog
   ============================================================ */

async function loadSources() {
  try {
    const res = await fetch(SOURCES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sources = await res.json();
    buildHazardButtons(sources);
    updateEmergencyContacts(sources);
    hideOverlay('loading-overlay');
  } catch (err) {
    console.error('Failed to load sources.json:', err);
    showOverlay('error-overlay', 'Could not load data catalog. Please refresh or check your connection.');
  }
}

/* ============================================================
   Build hazard toggle buttons from sources.json
   ============================================================ */

function buildHazardButtons(src) {
  const container = document.getElementById('hazard-toggles');
  container.innerHTML = '';

  Object.keys(HAZARD_CONFIG).forEach(key => {
    const cfg    = HAZARD_CONFIG[key];
    const layer  = src.hazard_layers[key];
    const status = layer ? layer.status : 'unavailable';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hazard-btn';
    btn.dataset.hazard = key;
    btn.dataset.status = status;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `${cfg.label} hazard layer — ${status}`);

    btn.innerHTML = `
      <span class="hazard-dot" aria-hidden="true"></span>
      <span>${cfg.emoji} ${cfg.label}</span>
      <span class="hazard-status-badge">${status === 'available' ? 'Active' : 'No data'}</span>
    `;

    btn.addEventListener('click', () => toggleHazard(key));
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleHazard(key);
      }
    });

    container.appendChild(btn);
  });

  /* Show default "no layer selected" info */
  showLayerInfo(null);
}

/* ============================================================
   Hazard layer toggle
   ============================================================ */

async function toggleHazard(key) {
  /* Deactivate all buttons */
  document.querySelectorAll('.hazard-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });

  /* If same layer clicked again — deselect */
  if (activeHazard === key) {
    activeHazard = null;
    removeActiveLayer();
    showLayerInfo(null);
    updateLocationList(null);
    return;
  }

  activeHazard = key;

  /* Activate pressed button */
  const btn = document.querySelector(`.hazard-btn[data-hazard="${key}"]`);
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }

  const layerMeta = sources.hazard_layers[key];
  showLayerInfo(key, layerMeta);

  if (!layerMeta || layerMeta.status !== 'available') {
    /* Layer not available — show informative state */
    removeActiveLayer();
    updateLocationList(null);
    return;
  }

  /* Attempt to load the GeoJSON */
  try {
    const url = `../assets/data/${key}_hazard.geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();
    renderHazardLayer(key, geojson);
    updateLocationList(geojson);
  } catch (err) {
    console.warn(`GeoJSON for ${key} unavailable:`, err);
    removeActiveLayer();
    updateLocationList(null);
    /* Downgrade status display */
    showLayerInfo(key, { ...layerMeta, status: 'fetch-failed' });
  }
}

function removeActiveLayer() {
  if (activeLayer) {
    map.removeLayer(activeLayer);
    activeLayer = null;
  }
}

function renderHazardLayer(key, geojson) {
  removeActiveLayer();
  const cfg = HAZARD_CONFIG[key];

  activeLayer = L.geoJSON(geojson, {
    style: {
      color:       cfg.color,
      fillColor:   cfg.color,
      fillOpacity: 0.35,
      weight:      1.5,
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties || {};
      const label = props.name || props.hazard_level || props.description || cfg.label;
      layer.bindPopup(
        `<strong>${cfg.label} Hazard Zone</strong><br>${label}` +
        (props.source ? `<br><small>Source: ${props.source}</small>` : '')
      );
    },
  }).addTo(map);
}

/* ============================================================
   Layer info panel
   ============================================================ */

function showLayerInfo(key, meta) {
  const panel = document.getElementById('layer-info');

  if (!key) {
    panel.innerHTML = `
      <p style="color:#666;font-size:0.8rem;font-family:'Roboto Mono',monospace;">
        Select a hazard layer to view source information and map data.
      </p>`;
    return;
  }

  const cfg    = HAZARD_CONFIG[key];
  const status = meta ? meta.status : 'unavailable';
  const isFail = status === 'fetch-failed';

  let html = `<h3>${cfg.emoji} ${cfg.label} Hazard</h3>`;

  if (meta) {
    html += `
      <p>
        <span class="source-label">Source:</span> ${meta.source_organization || '—'}<br>
        <span class="source-label">Dataset:</span> ${meta.dataset_title || '—'}<br>
        <span class="source-label">Accessed:</span> ${meta.accessed || 'Not yet acquired'}<br>
        <span class="source-label">Status:</span> ${isFail ? '⚠️ File could not be loaded' : status}<br>
    `;
    if (meta.source_url && meta.source_url !== 'N/A') {
      html += `<span class="source-label">Official source:</span>
        <a href="${escHtml(meta.source_url)}" target="_blank" rel="noopener noreferrer">${escHtml(meta.source_url)}</a><br>`;
    }
    html += '</p>';

    if (status === 'unavailable' || isFail) {
      html += `<div class="layer-unavailable-notice">
        <p><strong>⚠️ Data not yet available</strong></p>
        <p>${escHtml(meta.notes || 'No verified dataset has been loaded for this layer.')}</p>
        ${meta.how_to_obtain ? `<p><strong>How to obtain:</strong> ${escHtml(meta.how_to_obtain)}</p>` : ''}
      </div>`;
    }

    if (meta.accessed && status === 'available') {
      html += `<p><em>This is <strong>static historical data</strong>. It does not show real-time or current hazard activity. Always follow current official alerts and guidance from your local DRRMO.</em></p>`;
    }
  }

  html += `<a class="guide-link-btn" href="${cfg.guide}" aria-label="Read the ${cfg.label} preparedness guide">
    📖 ${cfg.label} Preparedness Guide →
  </a>`;

  panel.innerHTML = html;
}

/* ============================================================
   Emergency contacts
   ============================================================ */

function updateEmergencyContacts(src) {
  const list = document.getElementById('emergency-contact-list');
  if (!list || !src || !src.emergency_contacts) return;

  const contacts = [
    ...src.emergency_contacts.national,
    ...src.emergency_contacts.sorsogon,
  ];

  list.innerHTML = contacts.map(c => `
    <li>
      <span class="emg-number">${escHtml(c.number)}</span>
      <span>${escHtml(c.name)}</span>
      <span class="emg-note">${escHtml(c.notes || '')}</span>
    </li>
  `).join('');

  /* Source note */
  const note = document.getElementById('contacts-source-note');
  if (note && src.emergency_contacts.source_note) {
    note.textContent = src.emergency_contacts.source_note;
  }
}

/* ============================================================
   Location list (keyboard-accessible alternative to map)
   ============================================================ */

function updateLocationList(geojson) {
  const list   = document.getElementById('location-list');
  const search = document.getElementById('location-search');

  if (!geojson || !geojson.features || geojson.features.length === 0) {
    list.innerHTML = '<li class="loc-empty" tabindex="0">No features available for this layer.</li>';
    search.value = '';
    search.disabled = true;
    return;
  }

  search.disabled = false;

  const features = geojson.features.map(f => ({
    label: f.properties && (f.properties.name || f.properties.description || f.properties.hazard_level || 'Unnamed feature'),
    coords: f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates : null,
  }));

  function render(filter) {
    const filtered = filter
      ? features.filter(f => f.label.toLowerCase().includes(filter.toLowerCase()))
      : features;

    if (filtered.length === 0) {
      list.innerHTML = '<li class="loc-empty">No matching features.</li>';
      return;
    }

    list.innerHTML = filtered.slice(0, 100).map((f, i) => {
      return `<li tabindex="0" data-idx="${i}" aria-label="${escHtml(f.label)}">${escHtml(f.label)}</li>`;
    }).join('');

    list.querySelectorAll('li:not(.loc-empty)').forEach(li => {
      li.addEventListener('click', () => flyToFeature(filtered[+li.dataset.idx]));
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flyToFeature(filtered[+li.dataset.idx]);
        }
      });
    });
  }

  render('');
  search.addEventListener('input', () => render(search.value));
}

function flyToFeature(feat) {
  if (feat.coords) {
    map.flyTo([feat.coords[1], feat.coords[0]], 14, { duration: 1 });
  }
}

/* ============================================================
   Geolocation (opt-in)
   ============================================================ */

const locateBtn = document.getElementById('locate-me-btn');
if (locateBtn) {
  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    locateBtn.textContent = 'Locating…';
    locateBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 13, { duration: 1.5 });
        L.circleMarker([latitude, longitude], {
          radius: 8,
          color: '#e53935',
          fillColor: '#ef9a9a',
          fillOpacity: 0.8,
          weight: 2,
        })
          .addTo(map)
          .bindPopup('Your approximate location<br><small>(browser geolocation, not stored)</small>')
          .openPopup();
        locateBtn.textContent = '📍 Located';
        locateBtn.disabled = false;
      },
      err => {
        console.warn('Geolocation error:', err.message);
        locateBtn.textContent = '📍 Locate Me';
        locateBtn.disabled = false;
        if (err.code !== err.PERMISSION_DENIED) {
          alert('Could not determine your location. Please try again.');
        }
        /* Permission denied: fail silently — user chose not to share */
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}

/* ============================================================
   Overlay helpers
   ============================================================ */

function showOverlay(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  if (message) {
    const body = el.querySelector('.overlay-body');
    if (body) body.textContent = message;
  }
  el.classList.remove('hidden');
}

function hideOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

/* ============================================================
   Sidebar mobile toggle
   ============================================================ */

function wireUI() {
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('map-sidebar');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      toggle.textContent = collapsed ? '☰ Layers' : '✕ Close';
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  /* Municipality jump selector */
  const selector = document.getElementById('municipality-selector');
  if (selector) {
    selector.addEventListener('change', () => {
      const opt = selector.options[selector.selectedIndex];
      const lat = parseFloat(opt.dataset.lat);
      const lng = parseFloat(opt.dataset.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        map.flyTo([lat, lng], 13, { duration: 1 });
      } else {
        /* "Show all" option — zoom back to province */
        map.fitBounds(SORSOGON_BOUNDS, { padding: [10, 10] });
      }
    });
  }

  /* Skip-nav */
  const skipNav = document.getElementById('skip-to-map');
  if (skipNav) {
    skipNav.addEventListener('click', e => {
      e.preventDefault();
      const mapEl = document.getElementById('hazard-map');
      mapEl && mapEl.focus();
    });
  }
}

/* ============================================================
   Utility
   ============================================================ */

function escHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
