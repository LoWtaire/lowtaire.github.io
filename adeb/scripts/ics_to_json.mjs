import fetch from 'node-fetch';
import IcalExpander from 'ical-expander';
import { DateTime } from 'luxon';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_FILE = process.env.OUTPUT_FILE || 'data/univlor.json';
const HORIZON_DAYS = Number(process.env.HORIZON_DAYS || 60);
const PAST_DAYS = Number(process.env.PAST_DAYS || 7);
const TZ = process.env.TZ || 'Europe/Paris';

const urls = resolveSourceUrls();
if (!urls.length) {
  console.error('❌ ICS_URL (simple) ou ICS_URLS (multi-lignes) manquant.');
  process.exit(1);
}

function resolveSourceUrls() {
  const rawList = String(process.env.ICS_URLS || '').trim();
  if (rawList) {
    return rawList
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const singleUrl = process.env.ICS_URL || process.argv[2] || '';
  return singleUrl ? [singleUrl.trim()] : [];
}

function toTZISO(d) {
  return DateTime.fromJSDate(d, { zone: 'utc' })
    .setZone(TZ)
    .toISO({ suppressMilliseconds: true });
}

function dedupeKey(item) {
  return [
    item.id || '',
    item.start || '',
    item.end || '',
    (item.location || '').trim(),
    (item.title || '').trim()
  ].join('|');
}

(async () => {
  console.log(`➡️  Sources ICS: ${urls.length}`);

  const nowUtc = DateTime.utc();
  const rangeStart = nowUtc.minus({ days: PAST_DAYS }).toJSDate();
  const rangeEnd = nowUtc.plus({ days: HORIZON_DAYS }).toJSDate();

  const merged = [];
  const seen = new Set();

  for (const sourceUrl of urls) {
    console.log(`➡️  Fetch ICS: ${sourceUrl}`);
    const res = await fetch(sourceUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} en récupérant l'ICS: ${sourceUrl}`);

    const ics = await res.text();
    const expander = new IcalExpander({ ics, maxIterations: 5000 });
    const { events, occurrences } = expander.between(rangeStart, rangeEnd);

    for (const e of events) {
      const comp = e.component || e;
      const item = normalize(comp, e.startDate.toJSDate(), e.endDate.toJSDate());
      const key = dedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    for (const o of occurrences) {
      const comp = o.item.component || o.item;
      const item = normalize(comp, o.startDate.toJSDate(), o.endDate.toJSDate());
      const key = dedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  merged.sort((a, b) => new Date(a.start) - new Date(b.start));

  const payload = {
    generated_at: DateTime.utc().toISO({ suppressMilliseconds: true }),
    timezone: TZ,
    horizon_days: HORIZON_DAYS,
    count: merged.length,
    events: merged
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Écrit ${OUTPUT_FILE} (${merged.length} événements)`);
})().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});

function normalize(component, start, end) {
  const get = (prop) => {
    try {
      return component.getFirstPropertyValue(prop) ?? '';
    } catch {
      return '';
    }
  };

  const uid = get('uid') || `${+start}-${Math.random().toString(36).slice(2, 8)}`;
  const summary = get('summary') || '';
  const description = get('description') || '';
  const location = get('location') || '';
  const url = get('url') || '';
  const status = get('status') || '';
  const lastmod = get('last-modified') || '';

  let allDay = false;
  try {
    allDay = component.getFirstPropertyValue('dtstart')?.isDate === true;
  } catch {}

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
