'use strict';

// JSON spécifique UL (on ne touche pas /data/latest.json d'ADE)
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
const timePicker = $('timePicker');
const todayBtn = $('refresh');

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

let cache = null;

init();

async function init() {
  // Valeurs par défaut : aujourd’hui + heure actuelle
  const now = new Date();
  dayPicker.value = toInputDate(now);
  timePicker.value = toInputTime(now);

  statusEl.textContent = 'Chargement…';
  try {
    const res = await fetch(`${JSON_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cache = await res.json();

    tzEl.textContent = cache.timezone || 'Europe/Paris';
    lastUpdateEl.textContent = cache.generated_at ? `Dernière mise à jour (UTC) : ${cache.generated_at}` : '';

    buildRoomsIndex(cache.events || []);
    renderAgendaForSelectedDay();
    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }

  // Écouteurs
  roomBtn.addEventListener('click', checkRoomAtSelectedTime);
  roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkRoomAtSelectedTime(); });
  dayPicker.addEventListener('change', () => { renderAgendaForSelectedDay(); checkRoomAtSelectedTime(false); });
  timePicker.addEventListener('change', () => { checkRoomAtSelectedTime(); });
  todayBtn.addEventListener('click', () => {
    const n = new Date();
    dayPicker.value = toInputDate(n);
    timePicker.value = toInputTime(n);
    renderAgendaForSelectedDay();
    checkRoomAtSelectedTime();
  });
}

function buildRoomsIndex(events) {
  roomsDatalist.innerHTML = '';
  const set = new Set();
  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (loc) set.add(loc);
    // Option: extraire des noms probables depuis le titre
    const m = (ev.title || '').match(/\b(salle|amphi|[A-Z]\d{2,3}|[A-Z]-\d{2,3})\b/gi);
    if (m) m.forEach(x => set.add(x));
  }
  Array.from(set).
