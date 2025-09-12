'use strict';

// Lit le JSON UL (on ne touche pas /data/latest.json d'ADE)
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
    renderForSelectedDay();
    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }

  // Écouteurs
  dayPicker.addEventListener('change', () => {
    renderForSelectedDay();
    checkRoomForSelectedDay(false);
  });
  todayBtn.addEventListener('click', () => {
    const n = new Date();
    dayPicker.value = toInputDate(n);
    renderForSelectedDay();
    checkRoomForSelectedDay();
  });
  roomBtn.addEventListener('click', () => checkRoomForSelectedDay(true));
  roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkRoomForSelectedDay(true); });
}

function buildRoomsIndex(events) {
  roomsDatalist.innerHTML = '';
  const set = new Set();
  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (loc) set.add(loc);
    // Option : extraction sommaire depuis le titre
    const m = (ev.title || '').match(/\b(salle|amphi|[A-Z]\d{2,3}|[A-Z]-\d{2,3})\b/gi);
    if (m) m.forEach(x => set.add(x));
  }
  Array.from(set).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    roomsDatalist.appendChild(opt);
  });
}

// ---------- Rendu agenda selon le jour choisi
function renderForSelectedDay() {
  const selected = fromInputDate(dayPicker.value);
  if (!selected) return;

  const today = startOfDay(new Date());
  const selectedStart = startOfDay(selected);
  const selectedEnd = endOfDay(selected);

  const events = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start);
      return s >= selectedStart && s <= selectedEnd;
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  listEl.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'day';
  head.textContent = cap(fmtDate.format(selectedStart));
  listEl.appendChild(head);

  if (isSameDay(selectedStart, today)) {
    // Aujourd’hui : seulement "en cours" et "à venir"
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
    // Futur / passé : toute la journée
    if (events.length === 0) {
      listEl.innerHTML += '<div class="status">Aucun événement ce jour.</div>';
      return;
    }
    events.forEach(ev => listEl.appendChild(renderEvent(ev)));
  }
}

// ---------- Vérification d’une salle pour le jour sélectionné
function checkRoomForSelectedDay(showPromptIfEmpty = true) {
  const q = (roomInput.value || '').trim();
  if (!q) {
    if (showPromptIfEmpty) $('roomStatus').textContent = 'Saisis une salle pour vérifier.';
    return;
  }

  const selected = fromInputDate(dayPicker.value);
  if (!selected) return;

  const selectedStart = startOfDay(selected);
  const selectedEnd = endOfDay(selected);
  const isTodayFlag = isSameDay(selectedStart, startOfDay(new Date()));
  const now = new Date();

  const dayEvents = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start), e = new Date(ev.end);
      if (e < selectedStart || s > selectedEnd) return false;
      const hay = `${ev.location || ''} ${ev.title || ''} ${ev.description || ''}`.toLowerCase();
      return hay.includes(q.toLowerCase());
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
    // Jour ≠ aujourd’hui : lister les créneaux de la journée pour la salle
    if (dayEvents.length === 0) {
      $('roomStatus').innerHTML = `<span class="kpi ok">Libre</span> Aucun événement pour cette salle à la date choisie.`;
      return;
    }
    const lines = dayEvents.map(ev => `• ${fmtTime.format(new Date(ev.start))} → ${fmtTime.format(new Date(ev.end))} • ${ev.title || '(Sans titre)'}`);
    $('roomStatus').innerHTML = `<span class="kpi">Créneaux</span>\n${lines.join('\n')}`;
  }
}

// ---------- Rendu d’un événement
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

// ---------- Helpers
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
