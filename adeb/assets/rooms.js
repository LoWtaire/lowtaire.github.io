'use strict';

// JSON UL
const JSON_URL = '/data/univlor.json';

const $ = (id) => document.getElementById(id);
const listEl = $('list');
const statusEl = $('status');
const tzEl = $('tz');
const lastUpdateEl = $('lastUpdate');
const roomInput = $('roomQuery');
const roomsDatalist = $('roomsList');
const dayPicker = $('dayPicker');
const todayBtn = $('todayBtn');

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

let cache = null;
// Salles connues (formes canoniques de ev.location) pour matcher "exact datalist"
const knownRoomsCanon = new Set();

init();

async function init() {
  // Par défaut : aujourd’hui
  const now = new Date();
  dayPicker.value = toInputDate(now);

  statusEl.textContent = 'Chargement…';
  try {
    const res = await fetch(`${JSON_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cache = await res.json();

    tzEl.textContent = cache.timezone || 'Europe/Paris';
    lastUpdateEl.textContent = cache.generated_at ? `Dernière mise à jour (UTC) : ${cache.generated_at}` : '';

    buildRoomsIndex(cache.events || []);
    renderForSelectedDay();            // premier rendu
    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }

  // Actions utilisateur → re-rendu auto (pas de bouton Vérifier)
  roomInput.addEventListener('input', renderForSelectedDay);
  dayPicker.addEventListener('change', renderForSelectedDay);
  todayBtn.addEventListener('click', () => {
    const n = new Date();
    dayPicker.value = toInputDate(n);
    renderForSelectedDay();
  });
}

/* ========= Normalisation & matching ========= */
function norm(s) {
  return (s || '')
    .toString()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function collapse(s) { return norm(s).replace(/\s+/g, ''); }
function stripKeywords(s) { return norm(s).replace(/\b(salle|amphi|amphitheatre|amphithéâtre|bat\.?|batiment|bâtiment)\b/g, '').trim(); }
function canonical(s) { return collapse(stripKeywords(s)).toUpperCase(); }

function isExactLocationQuery(qRaw) {
  return knownRoomsCanon.has(canonical(qRaw));
}
function eventMatches(ev, qRaw) {
  const qCanon = canonical(qRaw);
  const exact = isExactLocationQuery(qRaw);
  if (exact) {
    // filtre STRICT : égalité sur ev.location uniquement
    return canonical(ev.location || '') === qCanon;
  }
  // fuzzy : on cherche dans location puis (location+title+desc)
  const locCan = canonical(ev.location || '');
  if (locCan.includes(qCanon)) return true;
  const hay = canonical(`${ev.location || ''} ${ev.title || ''} ${ev.description || ''}`);
  if (hay.includes(qCanon)) return true;
  // fallback: tous les tokens présents
  const toks = norm(qRaw).split(' ').filter(Boolean);
  if (toks.length > 1 && toks.every(t => norm(`${ev.location} ${ev.title} ${ev.description}`).includes(t))) return true;
  return false;
}

/* ========= Datalist (uniquement des locations réelles) ========= */
function buildRoomsIndex(events) {
  roomsDatalist.innerHTML = '';
  knownRoomsCanon.clear();
  const display = [];
  const seen = new Set();

  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (!loc) continue;
    const can = canonical(loc);
    if (can.length < 3) continue;          // évite “1”, “A”, etc.
    if (seen.has(can)) continue;
    seen.add(can);
    knownRoomsCanon.add(can);
    display.push(loc);
  }

  display.sort((a,b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  for (const name of display) {
    const opt = document.createElement('option');
    opt.value = name;
    roomsDatalist.appendChild(opt);
  }
}

/* ========= Rendu agenda (filtré par salle si rempli) ========= */
function renderForSelectedDay() {
  const selected = fromInputDate(dayPicker.value);
  if (!selected) return;

  const today = startOfDay(new Date());
  const start = startOfDay(selected);
  const end = endOfDay(selected);

  // 1) événements du jour
  let events = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start);
      return s >= start && s <= end;
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  // 2) filtre salle si rempli
  const q = (roomInput.value || '').trim();
  if (q) events = events.filter(ev => eventMatches(ev, q));

  // 3) rendu
  listEl.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'day';
  head.textContent = cap(fmtDate.format(start));
  listEl.appendChild(head);

  if (isSameDay(start, today)) {
    const now = new Date();
    const current = events.filter(ev => {
      const s = new Date(ev.start), e = new Date(ev.end);
      return s <= now && now < e;
    });
    const upcoming = events.filter(ev => new Date(ev.start) > now);

    if (current.length === 0 && upcoming.length === 0) {
      listEl.innerHTML += `<div class="status">${q ? 'Aucun événement pour cette salle aujourd’hui.' : 'Aucun événement restant aujourd’hui.'}</div>`;
      return;
    }

    if (current.length) {
      const h = document.createElement('div');
      h.className = 'status';
      h.textContent = 'En cours maintenant';
      listEl.appendChild(h);
      current.forEach(ev => listEl.appendChild(renderEvent(ev)));
    }

    if (upcoming.length) {
      const h2 = document.createElement('div');
      h2.className = 'status';
      h2.textContent = 'À venir aujourd’hui';
      listEl.appendChild(h2);
      upcoming.forEach(ev => listEl.appendChild(renderEvent(ev)));
    }
  } else {
    if (events.length === 0) {
      listEl.innerHTML += `<div class="status">${q ? 'Aucun événement pour cette salle à la date choisie.' : 'Aucun événement ce jour.'}</div>`;
      return;
    }
    events.forEach(ev => listEl.appendChild(renderEvent(ev)));
  }
}

/* ========= Cartes d’événement ========= */
function renderEvent(ev) {
  const wrap = document.createElement('div');
  wrap.className = 'event';

  const s = new Date(ev.start), e = new Date(ev.end);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = ev.allDay ? 'Toute la journée' : `${fmtTime.format(s)}\n→ ${fmtTime.format(e)}`;

  const info = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = ev.title || '(Sans titre)';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const parts = [];
  if (ev.location) parts.push(ev.location);
  if (ev.status) parts.push(ev.status);
  if (ev.url) parts.push(ev.url);
  if (parts.length) meta.textContent = parts.join(' · ');

  info.appendChild(title);
  if (parts.length) info.appendChild(meta);

  wrap.appendChild(time);
  wrap.appendChild(info);
  return wrap;
}

/* ========= Helpers ========= */
function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromInputDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m - 1), d);
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function isSameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
