'use strict';

// Ce site lit le JSON spécifique UL (on ne touche pas /data/latest.json d'ADE)
const JSON_URL = '/data/univlor.json';

const $ = (id) => document.getElementById(id);
const listEl = $('list');
const statusEl = $('status');
const tzEl = $('tz');
const lastUpdateEl = $('lastUpdate');
const roomInput = $('roomQuery');
const roomBtn = $('roomCheck');
const roomsDatalist = $('roomsList');

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

let cache = null;

init();

async function init() {
  statusEl.textContent = 'Chargement…';
  try {
    const res = await fetch(`${JSON_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cache = await res.json();

    tzEl.textContent = cache.timezone || 'Europe/Paris';
    lastUpdateEl.textContent = cache.generated_at ? `Dernière mise à jour (UTC) : ${cache.generated_at}` : '';

    buildRoomsIndex(cache.events || []);
    renderTodayAgenda();
    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }

  roomBtn.addEventListener('click', checkRoom);
  roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkRoom(); });
}

function buildRoomsIndex(events) {
  roomsDatalist.innerHTML = '';
  const set = new Set();
  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (loc) set.add(loc);
    // Option: tenter d'extraire des noms de salles du titre
    const m = (ev.title || '').match(/\b(salle|amphi|[A-Z]\d{2,3}|[A-Z]-\d{2,3})\b/gi);
    if (m) m.forEach(x => set.add(x));
  }
  Array.from(set).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    roomsDatalist.appendChild(opt);
  });
}

// Vérifie "occupée maintenant" et "prochain créneau aujourd'hui"
function checkRoom() {
  const q = (roomInput.value || '').trim();
  if (!q) {
    $('roomStatus').textContent = 'Saisis une salle pour vérifier.';
    return;
  }
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const todayEvents = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start), e = new Date(ev.end);
      if (e < todayStart || s > todayEnd) return false;
      const hay = `${ev.location || ''} ${ev.title || ''} ${ev.description || ''}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  const nowEvt = todayEvents.find(ev => {
    const s = new Date(ev.start), e = new Date(ev.end);
    return s <= now && now < e;
  });

  const nextEvt = todayEvents.find(ev => new Date(ev.start) > now);

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
}

// Liste de la journée uniquement
function renderTodayAgenda() {
  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);

  const todayEvents = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start);
      return s >= start && s <= end;
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  listEl.innerHTML = '';

  const day = document.createElement('div');
  day.className = 'day';
  day.textContent = cap(fmtDate.format(start));
  listEl.appendChild(day);

  if (todayEvents.length === 0) {
    listEl.innerHTML += '<div class="status">Aucun événement aujourd’hui.</div>';
    return;
  }

  for (const ev of todayEvents) listEl.appendChild(renderEvent(ev));
}

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

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
