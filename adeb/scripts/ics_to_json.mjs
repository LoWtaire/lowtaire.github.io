import fetch from 'node-fetch';
import IcalExpander from 'ical-expander';
import { DateTime } from 'luxon';
import fs from 'fs/promises';
import path from 'path';

const ICS_URL = process.env.ICS_URL || process.argv[2];
if (!ICS_URL) {
  console.error('❌ ICS_URL_UNIVLOR manquant (Settings → Secrets/Variables → Actions).');
  process.exit(1);
}

const OUTPUT_FILE  = process.env.OUTPUT_FILE || 'data/univlor.json';
const HORIZON_DAYS = Number(process.env.HORIZON_DAYS || 60);
const PAST_DAYS    = Number(process.env.PAST_DAYS || 7);
const TZ           = process.env.TZ || 'Europe/Paris';

function toTZISO(d) {
  return DateTime.fromJSDate(d, { zone: 'utc' })
    .setZone(TZ)
    .toISO({ suppressMilliseconds: true });
}

(async () => {
  console.log(`➡️  Fetch ICS: ${ICS_URL}`);
  const res = await fetch(ICS_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} en récupérant l'ICS`);
  const ics = await res.text();

  const nowUtc = DateTime.utc();
  const rangeStart = nowUtc.minus({ days: PAST_DAYS }).toJSDate();
  const rangeEnd   = nowUtc.plus({ days: HORIZON_DAYS }).toJSDate();

  const expander = new IcalExpander({ ics, maxIterations: 5000 });
  const { events, occurrences } = expander.between(rangeStart, rangeEnd);

  const items = [];

  // Non-récurrents
  for (const e of events) {
    const comp = e.component || e;
    items.push(normalize(comp, e.startDate.toJSDate(), e.endDate.toJSDate()));
  }
  // Occurrences récurrentes
  for (const o of occurrences) {
    const comp = o.item.component || o.item;
    items.push(normalize(comp, o.startDate.toJSDate(), o.endDate.toJSDate()));
  }

  items.sort((a, b) => new Date(a.start) - new Date(b.start));

  const payload = {
    generated_at: DateTime.utc().toISO({ suppressMilliseconds: true }),
    timezone: TZ,
    horizon_days: HORIZON_DAYS,
    count: items.length,
    events: items
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Écrit ${OUTPUT_FILE} (${items.length} événements)`);
})().catch((err) => { console.error('❌ Erreur:', err); process.exit(1); });

function normalize(component, start, end) {
  const get = (prop) => { try { return component.getFirstPropertyValue(prop) ?? ''; } catch { return ''; } };
  const uid         = get('uid') || `${+start}-${Math.random().toString(36).slice(2, 8)}`;
  const summary     = get('summary') || '';
  const description = get('description') || '';
  const location    = get('location') || '';
  const url         = get('url') || '';
  const status      = get('status') || '';
  const lastmod     = get('last-modified') || '';

  let allDay = false;
  try { allDay = component.getFirstPropertyValue('dtstart')?.isDate === true; } catch {}

  return {
    id: uid,
    title: summary,
    start: toTZISO(start),
    end: toTZISO(end),
    allDay,
    location,
    description,
    status,
    url,
    lastModified: lastmod ? toTZISO(new Date(lastmod.toString())) : null
  };
}
