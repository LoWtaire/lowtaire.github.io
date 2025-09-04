const listEl = document.getElementById('list');
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
title.className = 'title';
title.textContent = ev.title || '(Sans titre)';


const meta = document.createElement('div');
meta.className = 'meta';
const parts = [];
if (ev.location) parts.push(ev.location);
if (ev.status) parts.push(ev.status);
if (ev.url) parts.push(ev.url);
meta.textContent = parts.join(' · ');


info.appendChild(title);
if (parts.length) info.appendChild(meta);


wrap.appendChild(time);
wrap.appendChild(info);


return wrap;
}


function groupByDay(events) {
const map = new Map();
for (const ev of events) {
const key = startOfDay(new Date(ev.start)).toISOString();
if (!map.has(key)) map.set(key, []);
map.get(key).push(ev);
}
for (const [k, arr] of map) {
arr.sort((a, b) => new Date(a.start) - new Date(b.start));
}
return map;
}


function startOfDay(d) {
const x = new Date(d);
x.setHours(0, 0, 0, 0);
return x;
}


function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
