import fetch from 'node-fetch';
const nowUtc = DateTime.utc();
const rangeStart = nowUtc.minus({ days: PAST_DAYS }).toJSDate();
const rangeEnd = nowUtc.plus({ days: HORIZON_DAYS }).toJSDate();


const expander = new IcalExpander({ ics, maxIterations: 5000 });
const { events, occurrences } = expander.between(rangeStart, rangeEnd);


const items = [];


// Événements non-récurrents dans la fenêtre
for (const e of events) {
const comp = e.component || e; // sécurité
const start = e.startDate.toJSDate();
const end = e.endDate.toJSDate();
items.push(normalize(comp, start, end));
}


// Occurrences des récurrences dans la fenêtre
for (const o of occurrences) {
const comp = o.item.component || o.item; // sécurité
const start = o.startDate.toJSDate();
const end = o.endDate.toJSDate();
items.push(normalize(comp, start, end));
}


// Tri et compactage
items.sort((a, b) => new Date(a.start) - new Date(b.start));


const payload = {
generated_at: DateTime.utc().toISO({ suppressMilliseconds: true }),
timezone: TZ,
horizon_days: HORIZON_DAYS,
count: items.length,
events: items,
};


// Assure le dossier data/
await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });


// Écrit toujours; le workflow ne commit/push que si diff
await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
console.log(`✅ Écrit ${OUTPUT_FILE} (${items.length} événements)`);
})().catch((err) => {
console.error('❌ Erreur:', err);
process.exit(1);
});


function normalize(component, start, end) {
// Accès robuste aux propriétés
const get = (prop) => {
try { return component.getFirstPropertyValue(prop) ?? ''; } catch { return ''; }
};


const uid = get('uid') || `${+start}-${Math.random().toString(36).slice(2, 8)}`;
const summary = get('summary') || '';
const description = get('description') || '';
const location = get('location') || '';
const url = get('url') || '';
const status = get('status') || '';
const lastmod = get('last-modified') || '';


// All-day ? (dates "flottantes" sans heures)
let allDay = false;
try { allDay = component.getFirstPropertyValue('dtstart')?.isDate === true; } catch {}


return {
id: uid,
title: summary,
start: toParisISO(start),
end: toParisISO(end),
allDay,
location,
description,
status,
url,
lastModified: lastmod ? toParisISO(new Date(lastmod.toString())) : null,
};
}
