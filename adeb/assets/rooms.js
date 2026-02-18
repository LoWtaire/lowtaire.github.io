'use strict';

const CAMPUS_CONFIG_URL = './campus.json';
const ROOMS_STATUS_API_URL = window.ROOMS_STATUS_API_URL || '';
const AUTO_DISTANCE_THRESHOLD_M = 80000;

const $ = (id) => document.getElementById(id);

const ui = {
  pageTitle: $('pageTitle'),
  campusLine: $('campusLine'),
  campusBadge: $('campusBadge'),
  lastUpdateText: $('lastUpdateText'),
  refreshBtn: $('refreshBtn'),
  searchInput: $('searchInput'),
  statusBox: $('statusBox'),
  fallbackBanner: $('fallbackBanner'),
  tabs: [...document.querySelectorAll('.tab')],
  viewNow: $('viewNow'),
  viewToday: $('viewToday'),
  viewSearch: $('viewSearch'),
  viewRoom: $('viewRoom'),
  targetTime: $('targetTime'),
  durationSelect: $('durationSelect'),
  searchDurationSelect: $('searchDurationSelect'),
  onlyFreeCheck: $('onlyFreeCheck'),
  todayList: $('todayList'),
  searchList: $('searchList')
};

const state = {
  campusConfig: [],
  selectedCampus: null,
  detection: { quality: 'unknown', message: 'Campus par défaut appliqué.', distanceM: null },
  cache: null,
  activeView: 'now',
  selectedRoom: null,
  searchQuery: '',
  targetTime: defaultTargetTime(),
  minDuration: 30,
  searchMinDuration: 0,
  onlyFree: false,
  tickInterval: null
};

init();

async function init() {
  ui.targetTime.value = state.targetTime;
  bindEvents();
  await initCampus();
  await loadAndRender();
  startAutoTick();
}

function bindEvents() {
  ui.refreshBtn.addEventListener('click', loadAndRender);
  ui.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderCurrentView();
  });
  ui.tabs.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
  ui.targetTime.addEventListener('change', () => {
    state.targetTime = ui.targetTime.value || defaultTargetTime();
    renderTodayView();
  });
  ui.durationSelect.addEventListener('change', () => {
    state.minDuration = Number(ui.durationSelect.value || 30);
    renderTodayView();
  });
  ui.searchDurationSelect.addEventListener('change', () => {
    state.searchMinDuration = Number(ui.searchDurationSelect.value || 0);
    renderSearchView();
  });
  ui.onlyFreeCheck.addEventListener('change', () => {
    state.onlyFree = ui.onlyFreeCheck.checked;
    renderSearchView();
  });
}

async function initCampus() {
  state.campusConfig = await loadCampusConfig();
  const picked = await pickCampusByGeo(state.campusConfig);
  state.selectedCampus = picked.campus || state.campusConfig[0] || null;
  state.detection = picked;
  renderHeaderContext();
}

async function loadAndRender() {
  try {
    ui.statusBox.textContent = 'Chargement des données…';
    const payload = buildCampusPayload(state.selectedCampus);
    state.cache = await fetchRoomsPayload(payload);
    ui.statusBox.textContent = '';
    renderHeaderContext();
    renderCurrentView();
  } catch (err) {
    console.error(err);
    ui.statusBox.textContent = `Impossible de charger les données.\n${err?.message || ''}`;
  }
}



function startAutoTick() {
  if (state.tickInterval) clearInterval(state.tickInterval);
  state.tickInterval = setInterval(() => {
    if (!state.cache) return;
    renderHeaderContext();
    if (state.activeView === 'now' || state.activeView === 'room') renderCurrentView();
  }, 1000);
}

function renderHeaderContext() {
  const campusName = state.selectedCampus?.name || 'Campus inconnu';
  ui.pageTitle.textContent = 'Salles libres';
  ui.campusLine.textContent = `Campus détecté : ${campusName}`;

  const badgeClass = state.detection.quality === 'gps' ? 'badge-gps' : state.detection.quality === 'approx' ? 'badge-approx' : 'badge-unknown';
  ui.campusBadge.className = `badge ${badgeClass}`;
  ui.campusBadge.textContent = state.detection.quality === 'gps' ? 'GPS' : state.detection.quality === 'approx' ? 'Approx.' : 'Inconnu';

  const generated = state.cache?.generated_at ? new Date(state.cache.generated_at) : null;
  ui.lastUpdateText.textContent = `Dernière mise à jour : ${generated ? hm(generated) : '--:--'}`;

  const ageMin = generated ? Math.floor((Date.now() - generated.getTime()) / 60000) : null;
  const staleMsg = ageMin !== null && ageMin > 10 ? `Données possiblement obsolètes (maj ${ageMin} min).` : '';
  const locationMsg = state.detection.banner || '';
  const msg = [locationMsg, staleMsg].filter(Boolean).join(' ');
  ui.fallbackBanner.hidden = !msg;
  ui.fallbackBanner.textContent = msg;
}

function setView(viewName) {
  state.activeView = viewName;
  if (viewName !== 'room') state.selectedRoom = null;
  ui.tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.view === viewName));
  ui.viewNow.hidden = viewName !== 'now';
  ui.viewToday.hidden = viewName !== 'today';
  ui.viewSearch.hidden = viewName !== 'search';
  ui.viewRoom.hidden = viewName !== 'room';
  renderCurrentView();
}

function renderCurrentView() {
  if (!state.cache?.events) return;
  if (state.activeView === 'now') return renderNowView();
  if (state.activeView === 'today') return renderTodayView();
  if (state.activeView === 'search') return renderSearchView();
  if (state.activeView === 'room') return renderRoomView();
}

function renderNowView() {
  const rooms = computeRoomSummaries();
  const filtered = rooms.filter(matchQuery);
  filtered.sort(sortNowCards);

  if (!filtered.length) {
    ui.viewNow.innerHTML = '<div class="panel">Aucune salle disponible avec ce filtre.</div>';
    return;
  }

  ui.viewNow.innerHTML = `<div class="cards">${filtered.map(renderNowCard).join('')}</div>`;
  ui.viewNow.querySelectorAll('[data-room]').forEach((card) => card.addEventListener('click', () => openRoom(card.dataset.room)));
}

function renderTodayView() {
  const target = buildTargetDate(state.targetTime);
  const durationMs = state.minDuration * 60000;
  const list = computeRoomSummaries()
    .filter(matchQuery)
    .map((room) => ({ room, ok: isFreeWindow(room.events, target, new Date(target.getTime() + durationMs)) }))
    .sort((a, b) => Number(b.ok) - Number(a.ok) || a.room.name.localeCompare(b.room.name));

  ui.todayList.innerHTML = list.length
    ? list.map(({ room, ok }) => renderTodayRow(room, ok)).join('')
    : '<div class="panel">Aucune salle trouvée.</div>';

  ui.todayList.querySelectorAll('[data-room]').forEach((row) => row.addEventListener('click', () => openRoom(row.dataset.room)));
}

function renderSearchView() {
  let list = computeRoomSummaries().filter(matchQuery);
  if (state.onlyFree) list = list.filter((r) => r.freeNow);
  if (state.searchMinDuration > 0) {
    const t = new Date();
    list = list.filter((r) => isFreeWindow(r.events, t, new Date(t.getTime() + state.searchMinDuration * 60000)));
  }

  list.sort((a, b) => a.name.localeCompare(b.name));
  ui.searchList.innerHTML = list.length ? list.map(renderSearchRow).join('') : '<div class="panel">Aucun résultat pour cette recherche.</div>';
  ui.searchList.querySelectorAll('[data-room]').forEach((row) => row.addEventListener('click', () => openRoom(row.dataset.room)));
}

function renderRoomView() {
  const room = computeRoomSummaries().find((r) => r.name === state.selectedRoom);
  if (!room) {
    ui.viewRoom.innerHTML = '<div class="panel">Salle introuvable.</div>';
    return;
  }

  const hero = room.freeNow
    ? `<div class="big ok">LIBRE</div><div>Libre ${room.nextBusyStart ? `jusqu’à ${hm(room.nextBusyStart)}` : 'maintenant'}.</div>`
    : `<div class="big busy">OCCUPÉE</div><div>Occupée jusqu’à ${hm(room.busyUntil)}.</div>`;

  const next = room.freeNow
    ? `Prochaine occupation : ${room.nextBusyStart ? hm(room.nextBusyStart) : 'non connue'}`
    : `Prochaine disponibilité : ${room.busyUntil ? hm(room.busyUntil) : 'non connue'}`;

  const events = room.events.length
    ? room.events.map((ev) => `<div class="event"><div class="time">${hm(ev.start)} → ${hm(ev.end)}</div><div>${escapeHtml(ev.title || '(Sans titre)')}</div></div>`).join('')
    : '<div class="panel">Aucun événement aujourd’hui.</div>';

  ui.viewRoom.innerHTML = `
    <div class="room-detail">
      <button class="btn" type="button" id="backBtn">← Retour</button>
      <div class="hero">${hero}<div class="meta" style="margin-top:6px">${next}</div></div>
      <div class="actions">
        <button class="btn" id="copyBtn" type="button">Copier le nom de la salle</button>
        <button class="btn" id="shareBtn" type="button">Partager</button>
      </div>
      <div class="stack">${events}</div>
    </div>
  `;

  $('backBtn').addEventListener('click', () => setView('now'));
  $('copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(room.name); ui.statusBox.textContent = 'Nom de salle copié.'; }
    catch { ui.statusBox.textContent = 'Impossible de copier le nom de salle.'; }
  });
  $('shareBtn').addEventListener('click', async () => {
    const text = `Salle ${room.name} (${room.freeNow ? 'libre' : `occupée jusqu’à ${hm(room.busyUntil)}`})`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
      return;
    }
    ui.statusBox.textContent = text;
  });
}

function openRoom(roomName) {
  state.selectedRoom = roomName;
  setView('room');
}

function renderNowCard(room) {
  const line = room.freeNow
    ? (room.nextBusyStart ? `Libre au moins jusqu’à ${hm(room.nextBusyStart)}` : 'Libre maintenant')
    : `Occupée jusqu’à ${hm(room.busyUntil)}`;

  const countdown = buildCountdown(room);
  const countdownBar = countdown
    ? `<div class="countdown-bar ${countdown.variant}"><div class="countdown-fill" style="width:${countdown.percent}%"></div><div class="countdown-text">${countdown.label}</div></div>`
    : '';

  return `
    <article class="card" data-room="${escapeAttr(room.name)}">
      <h3>${escapeHtml(room.name)}</h3>
      <div class="line"><strong class="${room.freeNow ? 'ok' : 'busy'}">${room.freeNow ? 'Libre' : 'Occupée'}</strong></div>
      <div class="line">${line}</div>
      ${countdownBar}
      <div class="fresh">maj ${freshMinutesLabel()}</div>
    </article>
  `;
}

function renderTodayRow(room, ok) {
  const countdown = buildCountdown(room);
  const timelineLabel = countdown ? countdown.label : (ok ? 'Libre sur le créneau choisi' : 'Créneau indisponible');

  return `
    <article class="row-item" data-room="${escapeAttr(room.name)}">
      <div class="row-top">
        <strong>${escapeHtml(room.name)}</strong>
        <span class="${ok ? 'badge badge-gps' : 'badge badge-unknown'}">${ok ? 'Disponible' : 'Indisponible'}</span>
      </div>
      <div class="timeline"><div class="timeline-fill" style="width:${timelineFillPercent(room.events)}%"></div><div class="timeline-text">${timelineLabel}</div></div>
    </article>
  `;
}

function renderSearchRow(room) {
  const subtitle = room.freeNow ? 'Libre maintenant' : `Occupée jusqu’à ${hm(room.busyUntil)}`;
  return `<article class="row-item" data-room="${escapeAttr(room.name)}"><div class="row-top"><strong>${escapeHtml(room.name)}</strong><span class="meta">${subtitle}</span></div></article>`;
}

function computeRoomSummaries() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const map = new Map();
  for (const ev of state.cache.events || []) {
    const loc = (ev.location || '').trim();
    if (!loc) continue;
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    if (end < dayStart || start > dayEnd) continue;
    if (!map.has(loc)) map.set(loc, []);
    map.get(loc).push({ ...ev, start, end });
  }

  const now = new Date();
  const rooms = [];
  for (const [name, events] of map.entries()) {
    events.sort((a, b) => a.start - b.start);
    const current = events.find((e) => e.start <= now && now < e.end);
    const nextBusy = events.find((e) => e.start > now);
    rooms.push({
      name,
      events,
      freeNow: !current,
      busyUntil: current?.end || null,
      nextBusyStart: nextBusy?.start || null
    });
  }
  return rooms;
}

function sortNowCards(a, b) {
  if (a.freeNow !== b.freeNow) return Number(b.freeNow) - Number(a.freeNow);
  const aUntil = a.nextBusyStart ? a.nextBusyStart.getTime() : Infinity;
  const bUntil = b.nextBusyStart ? b.nextBusyStart.getTime() : Infinity;
  return bUntil - aUntil;
}

function matchQuery(room) {
  if (!state.searchQuery) return true;
  return room.name.toLowerCase().includes(state.searchQuery);
}


function buildCountdown(room) {
  const now = Date.now();

  if (room.freeNow && room.nextBusyStart) {
    const msLeft = room.nextBusyStart.getTime() - now;
    if (msLeft <= 0) return null;
    const referenceWindow = 4 * 60 * 60000;
    const percent = Math.max(5, Math.min(100, Math.round((msLeft / referenceWindow) * 100)));
    return {
      label: `Occupée dans ${formatDuration(msLeft)}`,
      percent,
      variant: 'to-busy'
    };
  }

  if (!room.freeNow && room.busyUntil) {
    const msLeft = room.busyUntil.getTime() - now;
    if (msLeft <= 0) return null;
    const referenceWindow = 4 * 60 * 60000;
    const percent = Math.max(5, Math.min(100, Math.round((msLeft / referenceWindow) * 100)));
    return {
      label: `Libre dans ${formatDuration(msLeft)}`,
      percent,
      variant: 'to-free'
    };
  }

  return null;
}

function formatDuration(ms) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function timelineFillPercent(events) {
  const busyMs = events.reduce((acc, e) => acc + Math.max(0, e.end - e.start), 0);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.min(100, Math.max(3, Math.round((busyMs / dayMs) * 100)));
}

function isFreeWindow(events, start, end) {
  return !events.some((e) => e.start < end && start < e.end);
}

function buildTargetDate(hhmm) {
  const [h, m] = (hhmm || '12:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function defaultTargetTime() {
  const d = new Date(Date.now() + 30 * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function loadCampusConfig() {
  const res = await fetch(`${CAMPUS_CONFIG_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`campus.json HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function buildCampusPayload(campus) {
  return {
    campusId: campus?.campusApiId || campus?.id || null,
    dataUrl: campus?.dataUrl || '../data/univlor.json'
  };
}

async function fetchRoomsPayload(payload) {
  if (ROOMS_STATUS_API_URL) {
    const res = await fetch(ROOMS_STATUS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  const res = await fetch(`${payload.dataUrl}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function pickCampusByGeo(campuses) {
  if (!campuses.length) return { campus: null, quality: 'unknown', banner: 'Campus par défaut appliqué (configuration manquante).' };

  try {
    const pos = await getPos();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const nearest = campuses
      .map((c) => ({ campus: c, distanceM: haversine(lat, lon, c.center.lat, c.center.lon) }))
      .sort((a, b) => a.distanceM - b.distanceM)[0];

    if (nearest.distanceM > AUTO_DISTANCE_THRESHOLD_M) {
      return {
        campus: nearest.campus,
        distanceM: nearest.distanceM,
        quality: 'approx',
        banner: 'Hors zone connue — données potentiellement non pertinentes.'
      };
    }

    return { campus: nearest.campus, distanceM: nearest.distanceM, quality: 'gps', banner: '' };
  } catch {
    return {
      campus: campuses[0],
      quality: 'unknown',
      banner: `Campus par défaut : ${campuses[0].name} (géolocalisation indisponible).`
    };
  }
}

function getPos() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation unavailable'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000
    });
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function hm(date) {
  if (!date) return '--:--';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function freshMinutesLabel() {
  if (!state.cache?.generated_at) return '--';
  const age = Math.max(0, Math.floor((Date.now() - new Date(state.cache.generated_at).getTime()) / 60000));
  return `${age} min`;
}

function escapeHtml(v) {
  return String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function escapeAttr(v) {
  return escapeHtml(v).replace(/"/g, '&quot;');
}
