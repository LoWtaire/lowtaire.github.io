'use strict';

// JSON UL
const JSON_URL = '/data/univlor.json';

const $ = (id) => document.getElementById(id);
const listEl = $('list');
const statusEl = $('status');
const tzEl = $('tz');
const lastUpdateEl = $('lastUpdate');
const roomInput = $('roomQuery');
const roomBtn = $('roomCheck');
const roomsDatalist = $('roomsList');
const dayPicker = $('dayPicker');
const todayBtn = $('todayBtn');

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

let cache = null;
// Ensemble des salles connues (forme canonique des ev.location exacts)
const knownRoomsCanon = new Set();

init();

async function init() {
  // Par défaut : aujourd’hui
  const now = new Date();
  if (dayPicker) dayPicker.value = toInputDate(now);

  statusEl.textContent = 'Chargement…';
  try {
    const res = await fetch(`${JSON_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cache = await res.json();

    tzEl.textContent = cache.timezone || 'Europe/Paris';
    lastUpdateEl.textContent = cache.generated_at ? `Dernière mise à jour (UTC) : ${cache.generated_at}` : '';

    buildRoomsIndex(cache.events || []);
    renderForSelectedDay();
    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }

  // Écouteurs
  dayPicker?.addEventListener('change', () => {
    renderForSelectedDay();
    checkRoomForSelectedDay(false);
  });
  todayBtn?.addEventListener('click', () => {
    const n = new Date();
    dayPicker.value = toInputDate(n);
    renderForSelectedDay();
    checkRoomForSelectedDay();
  });

  // Clique ≠ nécessaire : taper / choisir dans la datalist déclenche immédiatement
  roomInput?.addEventListener('input', () => {
    checkRoomForSelectedDay(false);
    renderForSelectedDay();
  });
  roomBtn?.addEventListener('click', () => checkRoomForSelectedDay(true));
  roomInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkRoomForSelectedDay(true); });
}

/* ==============================
   Normalisation & matching
   ============================== */
function norm(s) {
  return (s || '')
    .toString()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // sans accents
    .toLowerCase()
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')     // espaces invisibles
    .replace(/[^a-z0-9]+/g, ' ')                     // ponctuation → espace
    .replace(/\s+/g, ' ')
    .trim();
}
function collapse(s) { return norm(s).replace(/\s+/g, ''); }
function stripKeywords(s) { return norm(s).replace(/\b(salle|amphi|amphitheatre|amphithéâtre|bat\.?|batiment|bâtiment)\b/g, '').trim(); }
function canonical(s) { return collapse(stripKeywords(s)).toUpperCase(); }

// exactLocationMode : vrai si la valeur saisie correspond exactement à un ev.location connu
function isExactLocationQuery(qRaw) {
  const qCanon = canonical(qRaw);
  return knownRoomsCanon.has(qCanon);
}

// Match événement selon mode exact-location ou fuzzy
function eventMatches(ev, qRaw) {
  const qCanon = canonical(qRaw);
  const exact = isExactLocationQuery(qRaw);

  if (exact) {
    // EXIGE: location exacte (canonique) = requête (canonique)
    return canonical(ev.location || '') === qCanon;
  }

  // Sinon: recherche tolérante (location prioritaire, mais on accepte title/description)
  const candidates = new Set();
  if (ev.location) candidates.add(canonical(ev.location));

  const hayCanon = canonical(`${ev.location || ''} ${ev.title || ''} ${ev.description || ''}`);
  if (candidates.has(qCanon) || hayCanon.includes(qCanon)) return true;

  // tokens tous présents
  const toks = norm(qRaw).split(' ').filter(Boolean);
  if (toks.length > 1 && toks.every(t => norm(`${ev.location} ${ev.title} ${ev.description}`).includes(t))) {
    return true;
  }

  return false;
}

/* ==============================
   Datalist & index des salles
   ============================== */
function buildRoomsIndex(events) {
  roomsDatalist.innerHTML = '';
  knownRoomsCanon.clear();

  const display = [];
  const seen = new Set();

  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (!loc) continue;

    const can = canonical(loc);
    if (can.length < 3) continue;       // ignore les trucs trop courts
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

/* ==============================
   Rendu agenda selon le jour (+ filtre salle)
   ============================== */
function renderForSelectedDay() {
  const selected = fromInputDate(dayPicker.value);
  if (!selected) return;

  const today = startOfDay(new Date());
  const selectedStart = startOfDay(selected);
  const selectedEnd = endOfDay(selected);

  let events = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start);
      return s >= selectedStart && s <= selectedEnd;
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  // --- Filtre SALLE si une valeur est saisie ---
  const q = (roomInput?.value || '').trim();
  if (q) {
    events = events.filter(ev => eventMatches(ev, q));
  }

  listEl.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'day';
  head.textContent = cap(fmtDate.format(selectedStart));
  listEl.appendChild(head);

  if (isSameDay(selectedStart, today)) {
    const now = new Date();
    const current = events.filter(ev => {
      const s = new Date(ev.start), e = new Date(ev.end);
      return s <= now && now < e;
    });
    const upcoming = events.filter(ev => new Date(ev.start) > now);

    if (current.length === 0 && upcoming.length === 0) {
      listEl.innerHTML += '<div class="status">Aucun événement restant aujourd’hui.</div>';
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
      listEl.innerHTML += '<div class="status">Aucun événement ce jour.</div>';
      return;
    }
    events.forEach(ev => listEl.appendChild(renderEvent(ev)));
  }
}

/* ==============================
   Vérification salle (jour choisi)
   ============================== */
function checkRoomForSelectedDay(showPromptIfEmpty = true) {
  const q = (roomInput?.value || '').trim();
  if (!q) {
    if (showPromptIfEmpty) $('roomStatus').textContent = 'Saisis une salle pour vérifier.';
    return;
  }

  const selected = fromInputDate(dayPicker.value);
  if (!selected) return;

  const selStart = startOfDay(selected);
  const selEnd = endOfDay(selected);
  const isTodayFlag = isSameDay(selStart, startOfDay(new Date()));
  const now = new Date();

  const dayEvents = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start), e = new Date(ev.end);
      if (e < selStart || s > selEnd) return false;
      return eventMatches(ev, q);
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  if (isTodayFlag) {
    const nowEvt = dayEvents.find(ev => {
      const s = new Date(ev.start), e = new Date(ev.end);
      return s <= now && now < e;
    });
    const nextEvt = dayEvents.find(ev => new Date(ev.start) > now);

    let out = '';
    if (nowEvt) {
      out += `\u{1F534} Occupée maintenant — ${fmtTime.format(new Date(nowEvt.start))} → ${fmtTime.format(new Date(nowEvt.end))}\n`;
      out += `${nowEvt.title || '(Sans titre)'}${nowEvt.location ? ' · ' + nowEvt.location : ''}`;
    } else {
      out += `\u{1F7E2} Libre maintenant`;
      if (nextEvt) {
        out += ` — jusqu'à ${fmtTime.format(new Date(nextEvt.start))}\nProchain : ${fmtTime.format(new Date(nextEvt.start))} → ${fmtTime.format(new Date(nextEvt.end))} • ${nextEvt.title || '(Sans titre)'}`;
        if (nextEvt.location) out += ` · ${nextEvt.location}`;
      } else {
        out += ` — libre pour le reste de la journée`;
      }
    }
    $('roomStatus').innerHTML = `<span class="kpi ${nowEvt ? 'bad' : 'ok'}">${nowEvt ? 'Occupée' : 'Libre'}</span> ${out}`;
  } else {
    if (dayEvents.length === 0) {
      $('roomStatus').innerHTML = `<span class="kpi ok">Libre</span> Aucun événement pour cette salle à la date choisie.`;
      return;
    }
    const lines = dayEvents.map(ev => `• ${fmtTime.format(new Date(ev.start))} → ${fmtTime.format(new Date(ev.end))} • ${ev.title || '(Sans titre)'}`);
    $('roomStatus').innerHTML = `<span class="kpi">Créneaux</span>\n${lines.join('\n')}`;
  }
}

/* ==============================
   Rendu d’un événement
   ============================== */
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

/* ==============================
   Helpers
   ============================== */
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
