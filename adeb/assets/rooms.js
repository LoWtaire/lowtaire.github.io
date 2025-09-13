'use strict';

// JSON UL
const JSON_URL = '/data/univlor.json';

const $ = id => document.getElementById(id);
const listEl = $('list'), statusEl = $('status'), tzEl = $('tz'), lastUpdateEl = $('lastUpdate');
const roomInput = $('roomQuery'), roomMenu = $('roomMenu'), roomBox = $('roomBox');
const dayPicker = $('dayPicker'), dateBox = $('dateBox'), todayBtn = $('todayBtn');

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

let cache = null;
let roomsDisplay = [];                 // libellés bruts à afficher (triés)
const knownRoomsCanon = new Set();     // formes canoniques pour égalité stricte

// état du menu
let activeIndex = -1;                  // item survolé via clavier
let filteredItems = [];               // items filtrés actuellement

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

  /* ====== SALLE : ouvrir menu partout & filtrer au clavier ====== */
  roomBox.addEventListener('click', () => {
    roomInput.focus();
    openMenu();
    populateMenu(roomInput.value);
  });
  roomInput.addEventListener('input', () => {
    populateMenu(roomInput.value);
    renderForSelectedDay(); // filtre en direct
  });
  document.addEventListener('click', (e) => {
    if (!roomBox.contains(e.target)) closeMenu();
  });
  roomMenu.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-value]');
    if (!li) return;
    selectMenuValue(li.dataset.value);
  });
  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      openMenu();
      moveActive(1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      openMenu();
      moveActive(-1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (!roomMenu.classList.contains('hidden') && activeIndex >= 0) {
        selectMenuValue(filteredItems[activeIndex]);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  });

  /* ====== DATE : clic n’importe où ouvre le picker ====== */
  dateBox.addEventListener('click', (e) => {
    if (e.target !== dayPicker) {
      dayPicker.showPicker?.();
      dayPicker.focus();
    }
  });
  dayPicker.addEventListener('change', renderForSelectedDay);
  todayBtn.addEventListener('click', () => {
    const n = new Date();
    dayPicker.value = toInputDate(n);
    renderForSelectedDay();
  });
}

/* ---------- Menu salle ---------- */
function openMenu(){ roomMenu.classList.remove('hidden'); roomBox.setAttribute('aria-expanded','true'); }
function closeMenu(){ roomMenu.classList.add('hidden'); roomBox.setAttribute('aria-expanded','false'); activeIndex = -1; markActive(); }
function selectMenuValue(val){ roomInput.value = val; renderForSelectedDay(); closeMenu(); }
function moveActive(delta){
  if (filteredItems.length === 0) return;
  activeIndex = Math.max(0, Math.min(filteredItems.length - 1, activeIndex + delta));
  markActive();
  // scroll auto vers l’item actif
  const li = roomMenu.querySelector(`li[data-index="${activeIndex}"]`);
  if (li) {
    const r = li.getBoundingClientRect(), p = roomMenu.getBoundingClientRect();
    if (r.top < p.top) roomMenu.scrollTop += r.top - p.top - 4;
    if (r.bottom > p.bottom) roomMenu.scrollTop += r.bottom - p.bottom + 4;
  }
}
function markActive(){
  roomMenu.querySelectorAll('li[aria-selected]').forEach(n => n.removeAttribute('aria-selected'));
  if (activeIndex >= 0) {
    const li = roomMenu.querySelector(`li[data-index="${activeIndex}"]`);
    if (li) li.setAttribute('aria-selected','true');
  }
}
function populateMenu(filter){
  const q = canonical(filter || '');
  filteredItems = q ? roomsDisplay.filter(name => canonical(name).includes(q)) : roomsDisplay.slice();
  roomMenu.innerHTML = '';
  activeIndex = -1;

  if (filteredItems.length === 0) {
    const li = document.createElement('li'); li.textContent = 'Aucune salle';
    li.setAttribute('aria-disabled','true'); li.style.opacity = .6;
    roomMenu.appendChild(li);
    return;
  }
  filteredItems.slice(0, 400).forEach((name, i) => {
    const li = document.createElement('li');
    li.dataset.value = name;
    li.dataset.index = String(i);
    li.textContent = name;
    roomMenu.appendChild(li);
  });
}

/* ---------- Index des salles ---------- */
function buildRoomsIndex(events){
  roomsDisplay = [];
  knownRoomsCanon.clear();
  const seen = new Set();
  for (const ev of events) {
    const loc = (ev.location || '').trim();
    if (!loc) continue;
    const can = canonical(loc);
    if (can.length < 3 || seen.has(can)) continue; // évite “1”, “A”, etc.
    seen.add(can);
    knownRoomsCanon.add(can);
    roomsDisplay.push(loc);
  }
  roomsDisplay.sort((a,b) => a.localeCompare(b, 'fr', { sensitivity:'base' }));
  populateMenu('');
}

/* ---------- Rendu agenda (filtré salle + logique aujourd’hui) ---------- */
function renderForSelectedDay(){
  const selected = fromInputDate(dayPicker.value);
  if (!selected) return;

  const today = startOfDay(new Date());
  const start = startOfDay(selected);
  const end   = endOfDay(selected);

  let events = (cache.events || [])
    .filter(ev => {
      const s = new Date(ev.start);
      return s >= start && s <= end;
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

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
function norm(s){return (s||'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[\u00AD\u200B-\u200D\uFEFF]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function collapse(s){return norm(s).replace(/\s+/g,'');}
function stripKeywords(s){return norm(s).replace(/\b(salle|amphi|amphitheatre|amphithéâtre|bat\.?|batiment|bâtiment)\b/g,'').trim();}
function canonical(s){return collapse(stripKeywords(s)).toUpperCase();}
function isExactLocationQuery(qRaw){return knownRoomsCanon.has(canonical(qRaw));}
function eventMatches(ev, qRaw){
  const qCan = canonical(qRaw);
  if (isExactLocationQuery(qRaw)) return canonical(ev.location||'') === qCan;
  const locCan = canonical(ev.location||'');
  if (locCan.includes(qCan)) return true;
  const hay = canonical(`${ev.location||''} ${ev.title||''} ${ev.description||''}`);
  if (hay.includes(qCan)) return true;
  const toks = norm(qRaw).split(' ').filter(Boolean);
  if (toks.length>1 && toks.every(t => norm(`${ev.location} ${ev.title} ${ev.description}`).includes(t))) return true;
  return false;
}

/* ---------- Cartes événement ---------- */
function renderEvent(ev){
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
function toInputDate(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function fromInputDate(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function isSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
