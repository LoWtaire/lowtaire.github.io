const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');
const lastUpdateEl = document.getElementById('lastUpdate');
const tzEl = document.getElementById('tz');
const refreshBtn = document.getElementById('refresh');
const rangeSel = document.getElementById('range');

// ⬇️ IMPORTANT : chemin absolu vers le JSON à la racine
const FETCH_URL = `/data/latest.json?v=${Date.now()}`;

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

init();

async function init() {
  await loadAndRender();
  refreshBtn.addEventListener('click', loadAndRender);
  rangeSel.addEventListener('change', renderFromCache);
}

let cache = null;

async function loadAndRender() {
  try {
    statusEl.textContent = 'Chargement…';
    const res = await fetch(FETCH_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
    tzEl.textContent = cache.timezone || 'Europe/Paris';
    lastUpdateEl.textContent = cache.generated_at ? `Dernière mise à jour (UTC) : ${cache.generated_at}` : '';
    renderFromCache();
    statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Erreur de chargement des données.';
  }
}

function renderFromCache() {
  if (!cache) return;
  const days = rangeSel.value === 'today' ? 1 : Number(rangeSel.value);
  const now = new Date();
  const end = new Date(now.getTime() + (days - 1) * 86400000);

  const inRange = cache.events.filter(ev => {
    const s = new Date(ev.start);
    return s <= end && s >= startOfDay(now);
  });

  const groups = groupByDay(inRange);

  listEl.innerHTML = '';
  for (const [dayKey, events] of groups) {
    const d = new Date(dayKey);
    const day = document.createElement('div');
    day.className = 'day';
    day.textContent = cap(fmtDate.format(d));
    listEl.appendChild(day);

    for (const ev of events) {
      listEl.appendChild(renderEvent(ev));
    }
  }

  if (groups.size === 0) {
    listEl.innerHTML = '<div class="status">Aucun événement dans la période sélectionnée.</div>';
  }
}

function renderEvent(ev) {
  const wrap = document.createElement('div');
  wrap.className = 'event';

  const s = new Date(ev.start);
  const e = new Date(ev.end);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = ev.allDay ? 'Toute la journée' : `${fmtTime.format(s)}\n→ ${fmtTime.format(e)}`;

  const info = document.createElement('div');
  const title = document.createElement('div');
  title.className
