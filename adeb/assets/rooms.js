'use strict';

/* ---------- Constantes / sélecteurs ---------- */
const CAMPUS_CONFIG_URL = './campus.json';
const FALLBACK_DATA_URL = '../data/univlor.json';
const AUTO_DISTANCE_THRESHOLD_M = 80000;
// Ex: endpoint Cloudflare Worker / API serverless qui résout les SHU depuis ses secrets côté backend
const ROOMS_STATUS_API_URL = window.ROOMS_STATUS_API_URL || '';

const $ = id => document.getElementById(id);
const listEl = $('list'), statusEl = $('status'), tzEl = $('tz'), lastUpdateEl = $('lastUpdate');

const roomBox = $('roomBox'), roomInput = $('roomQuery'), roomMenu = $('roomMenu');
const dateBox = $('dateBox'), dayPicker = $('dayPicker'), todayBtn = $('todayBtn');

const campusBanner = $('campusBanner');
const campusText = $('campusText');
const campusGeoText = $('campusGeoText');
const pageTitle = $('pageTitle');

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

/* ---------- État ---------- */
let cache = null;
let roomsDisplay = [];               // libellés de salles (triés)
const knownRoomsCanon = new Set();   // formes canoniques des locations exactes
let filteredItems = [];              // items affichés dans le menu
let activeIndex = -1;                // index surligné au clavier

let campusConfig = [];
let selectedCampus = null;
let selectedCampusDistanceM = null;
let userPosition = null;

/* ---------- Init ---------- */
init();
async function init() {
  dayPicker.value = toInputDate(new Date());

  await initCampusSelection();

  setupEventListeners();
  await loadAndRender();
}

function setupEventListeners() {
  roomBox.addEventListener('click', () => {
    roomInput.focus();
    openMenu(); populateMenu(roomInput.value);
  });
  roomInput.addEventListener('focus', () => { openMenu(); populateMenu(roomInput.value); });
  roomInput.addEventListener('input', () => { populateMenu(roomInput.value); renderForSelectedDay(); });
  roomInput.addEventListener('keydown', onRoomKeydown);
  roomMenu.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-value]'); if (!li) return;
    selectMenuValue(li.dataset.value);
  });
  document.addEventListener('click', (e) => {
    if (!roomBox.contains(e.target)) closeMenu();
  });

  dateBox.addEventListener('click', (e) => {
    if (e.target !== dayPicker) { dayPicker.showPicker?.(); dayPicker.focus(); }
  });
  dayPicker.addEventListener('change', renderForSelectedDay);
  todayBtn.addEventListener('click', () => { dayPicker.value = toInputDate(new Date()); renderForSelectedDay(); });

}

async function initCampusSelection() {
  campusConfig = await loadCampusConfig();

  if (!campusConfig.length) {
    selectedCampus = null;
    selectedCampusDistanceM = null;
    campusBanner.hidden = true;
    return;
  }

  const nearest = await pickCampusByGeo(campusConfig);
  selectedCampus = nearest.campus || campusConfig[0];
  selectedCampusDistanceM = nearest.distanceM;

  updateCampusBanner({ reason: nearest.reason });
}

async function loadAndRender() {
  try {
    statusEl.textContent = 'Chargement…';

    const payload = await buildCampusPayload(selectedCampus);
    cache = await fetchRoomsPayload(payload);

    tzEl.textContent = cache.timezone || 'Europe/Paris';
    lastUpdateEl.textContent = cache.generated_at ? `Dernière mise à jour (UTC) : ${cache.generated_at}` : '';

    buildRoomsIndex(cache.events || []);
    populateMenu('');
    renderForSelectedDay();

    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }
}

async function fetchRoomsPayload(payload) {
  if (ROOMS_STATUS_API_URL) {
    const res = await fetch(ROOMS_STATUS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  const res = await fetch(`${FALLBACK_DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function loadCampusConfig() {
  try {
    const res = await fetch(`${CAMPUS_CONFIG_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Erreur config campus:', err);
    return [];
  }
}

async function buildCampusPayload(campus) {
  if (!campus) return { campusId: null };

  // Mode recommandé: le backend reçoit campusId et récupère les liens SHU depuis ses variables/secrets.
  const payload = { campusId: campus.campusApiId || campus.id };

  // Compat locale optionnelle: si linksUrl existe encore, on envoie links aussi.
  if (campus.linksUrl) {
    try {
      const res = await fetch(`${campus.linksUrl}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const links = await res.json();
        if (Array.isArray(links)) payload.links = links;
      }
    } catch (e) {
      // Ignore silently: campusId suffit pour le backend en prod.
    }
  }

  return payload;
}

function updateCampusBanner({ reason = '' }) {
  if (!campusBanner || !selectedCampus) return;

  const km = Number.isFinite(selectedCampusDistanceM) ? ` (≈ ${Math.round(selectedCampusDistanceM / 1000)} km)` : '';
  const suffix = reason ? ` — ${reason}` : '';
  campusText.textContent = `Établissement : ${selectedCampus.name}${km}${suffix}`;
  if (campusGeoText) campusGeoText.textContent = `Ville proche : ${getNearestCityLabel()}`;
  if (pageTitle) pageTitle.textContent = `Occupation des salles – ${selectedCampus.city || selectedCampus.name}`;
  campusBanner.hidden = false;
}

function getNearestCityLabel() {
  if (!userPosition) return selectedCampus?.city || selectedCampus?.name || 'indisponible';
  if (!campusConfig.length) return 'indisponible';

  const nearest = campusConfig
    .map(c => ({ campus: c, distanceM: haversine(userPosition.lat, userPosition.lon, c.center.lat, c.center.lon) }))
    .sort((a, b) => a.distanceM - b.distanceM)[0];

  return nearest?.campus?.city || nearest?.campus?.name || 'indisponible';
}

async function pickCampusByGeo(campuses) {
  const fallback = { campus: campuses[0] || null, auto: false, distanceM: null, reason: 'Sélection automatique indisponible.' };
  if (!campuses.length) return fallback;

  try {
    const pos = await getPos();
    userPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude };

    const distances = campuses.map(c => ({
      campus: c,
      distanceM: haversine(userPosition.lat, userPosition.lon, c.center.lat, c.center.lon)
    }));
    distances.sort((a, b) => a.distanceM - b.distanceM);

    const nearest = distances[0];
    if (nearest.distanceM <= AUTO_DISTANCE_THRESHOLD_M) {
      return { campus: nearest.campus, auto: true, distanceM: nearest.distanceM, reason: 'Détection automatique.' };
    }

    return { campus: nearest.campus, auto: false, distanceM: nearest.distanceM, reason: 'Hors zone : campus le plus proche sélectionné automatiquement.' };
  } catch (err) {
    const reason = geoErrorReason(err);
    return { campus: campuses[0], auto: false, distanceM: null, reason };
  }
}

function getPos() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation indisponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000
    });
  });
}

function geoErrorReason(err) {
  if (err?.code === 1) return 'Géolocalisation refusée.';
  if (err?.code === 2) return 'Position indisponible.';
  if (err?.code === 3) return 'Délai géolocalisation dépassé.';
  return 'Géolocalisation indisponible.';
}

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ---------- Menu salle ---------- */
function openMenu() {
  roomBox.setAttribute('aria-expanded', 'true');
  roomMenu.style.display = 'block';
}
function closeMenu() {
  roomBox.setAttribute('aria-expanded', 'false');
  roomMenu.style.display = 'none';
  activeIndex = -1; markActive();
}
function isOpen() { return roomBox.getAttribute('aria-expanded') === 'true'; }

function populateMenu(filter) {
  const q = canonical(filter || '');
  filteredItems = q ? roomsDisplay.filter(n => canonical(n).includes(q)) : roomsDisplay.slice();
  roomMenu.innerHTML = '';
  activeIndex = -1;

  if (filteredItems.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Aucune salle';
    li.setAttribute('aria-disabled', 'true');
    li.style.opacity = .6;
    roomMenu.appendChild(li);
    return;
  }
  filteredItems.slice(0, 400).forEach((name, i) => {
    const li = document.createElement('li');
    li.dataset.value = name;
    li.dataset.index = i;
    li.textContent = name;
    roomMenu.appendChild(li);
  });
  markActive();
}
function onRoomKeydown(e) {
  if (e.key === 'ArrowDown') {
    if (!isOpen()) openMenu();
    moveActive(1); e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    if (!isOpen()) openMenu();
    moveActive(-1); e.preventDefault();
  } else if (e.key === 'Enter') {
    if (isOpen() && activeIndex >= 0) { selectMenuValue(filteredItems[activeIndex]); e.preventDefault(); }
  } else if (e.key === 'Escape') {
    closeMenu();
  }
}
function moveActive(delta) {
  if (filteredItems.length === 0) return;
  activeIndex = Math.max(0, Math.min(filteredItems.length - 1, activeIndex + delta));
  markActive();
  const li = roomMenu.querySelector(`li[data-index="${activeIndex}"]`);
  if (li) {
    const r = li.getBoundingClientRect(), p = roomMenu.getBoundingClientRect();
    if (r.top < p.top) roomMenu.scrollTop += r.top - p.top - 4;
    if (r.bottom > p.bottom) roomMenu.scrollTop += r.bottom - p.bottom + 4;
  }
}
function markActive() {
  roomMenu.querySelectorAll('li[aria-selected]').forEach(n => n.removeAttribute('aria-selected'));
  if (activeIndex >= 0) roomMenu.querySelector(`li[data-index="${activeIndex}"]`)?.setAttribute('aria-selected', 'true');
}
function selectMenuValue(val) {
  roomInput.value = val;
  renderForSelectedDay();
  closeMenu();
}

/* ---------- Index des salles ---------- */
function buildRoomsIndex(events) {
  roomsDisplay = [];
  knownRoomsCanon.clear();
  const seen = new Set();

  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (!loc) continue;
    const can = canonical(loc);
    if (can.length < 3 || seen.has(can)) continue;
    seen.add(can);
    knownRoomsCanon.add(can);
    roomsDisplay.push(loc);
  }

  roomsDisplay.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

/* ---------- Rendu agenda ---------- */
function renderForSelectedDay() {
  const selected = fromInputDate(dayPicker.value);
  if (!selected || !cache) return;

  const start = startOfDay(selected), end = endOfDay(selected);
  const today = startOfDay(new Date());

  let events = (cache.events || [])
    .filter(ev => { const s = new Date(ev.start); return s >= start && s <= end; })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const q = (roomInput.value || '').trim();
  if (q) events = events.filter(ev => eventMatches(ev, q));

  listEl.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'day';
  head.textContent = cap(fmtDate.format(start));
  listEl.appendChild(head);

  if (isSameDay(start, today)) {
    const now = new Date();
    const current = events.filter(ev => new Date(ev.start) <= now && now < new Date(ev.end));
    const upcoming = events.filter(ev => new Date(ev.start) > now);

    if (current.length === 0 && upcoming.length === 0) {
      listEl.innerHTML += `<div class="status">${q ? 'Aucun événement pour cette salle aujourd’hui.' : 'Aucun événement restant aujourd’hui.'}</div>`;
      return;
    }
    if (current.length) {
      const h = document.createElement('div'); h.className = 'status'; h.textContent = 'En cours maintenant';
      listEl.appendChild(h); current.forEach(ev => listEl.appendChild(renderEvent(ev)));
    }
    if (upcoming.length) {
      const h2 = document.createElement('div'); h2.className = 'status'; h2.textContent = 'À venir aujourd’hui';
      listEl.appendChild(h2); upcoming.forEach(ev => listEl.appendChild(renderEvent(ev)));
    }
  } else {
    if (events.length === 0) {
      listEl.innerHTML += `<div class="status">${q ? 'Aucun événement pour cette salle à la date choisie.' : 'Aucun événement ce jour.'}</div>`;
      return;
    }
    events.forEach(ev => listEl.appendChild(renderEvent(ev)));
  }
}

/* ---------- Matching salle ---------- */
function norm(s) { return (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function collapse(s) { return norm(s).replace(/\s+/g, ''); }
function stripKeywords(s) { return norm(s).replace(/\b(salle|amphi|amphitheatre|amphithéâtre|bat\.?|batiment|bâtiment)\b/g, '').trim(); }
function canonical(s) { return collapse(stripKeywords(s)).toUpperCase(); }
function isExactLocationQuery(q) { return knownRoomsCanon.has(canonical(q)); }
function eventMatches(ev, qRaw) {
  const qCan = canonical(qRaw);
  if (isExactLocationQuery(qRaw)) return canonical(ev.location || '') === qCan;
  const locCan = canonical(ev.location || ''); if (locCan.includes(qCan)) return true;
  const hay = canonical(`${ev.location || ''} ${ev.title || ''} ${ev.description || ''}`); if (hay.includes(qCan)) return true;
  const toks = norm(qRaw).split(' ').filter(Boolean);
  if (toks.length > 1 && toks.every(t => norm(`${ev.location} ${ev.title} ${ev.description}`).includes(t))) return true;
  return false;
}

/* ---------- Cartes événement ---------- */
function renderEvent(ev) {
  const wrap = document.createElement('div'); wrap.className = 'event';
  const s = new Date(ev.start), e = new Date(ev.end);

  const time = document.createElement('div'); time.className = 'time';
  time.textContent = ev.allDay ? 'Toute la journée' : `${fmtTime.format(s)}\n→ ${fmtTime.format(e)}`;

  const info = document.createElement('div');
  const title = document.createElement('div'); title.className = 'title';
  title.textContent = ev.title || '(Sans titre)';

  const meta = document.createElement('div'); meta.className = 'meta';
  const parts = []; if (ev.location) parts.push(ev.location); if (ev.status) parts.push(ev.status); if (ev.url) parts.push(ev.url);
  if (parts.length) meta.textContent = parts.join(' · ');

  info.appendChild(title); if (parts.length) info.appendChild(meta);
  wrap.appendChild(time); wrap.appendChild(info);
  return wrap;
}

/* ---------- Helpers ---------- */
function toInputDate(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }
function fromInputDate(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
