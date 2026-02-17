import fetch from 'node-fetch';
import IcalExpander from 'ical-expander';
import { DateTime } from 'luxon';
import fs from 'fs/promises';
import path from 'path';

const INPUT = getInputConfig();
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'data/univlor.json';
const HORIZON_DAYS = Number(process.env.HORIZON_DAYS || 60);
const PAST_DAYS = Number(process.env.PAST_DAYS || 7);
const TZ = process.env.TZ || 'Europe/Paris';

function getInputConfig() {
  const singleUrl = process.env.ICS_URL || process.argv[2];
  const linksFile = process.env.ICS_URLS_FILE || process.argv[3];

  if (singleUrl && linksFile) {
    return { type: 'mixed', singleUrl, linksFile };
  }
  if (singleUrl) {
    return { type: 'single', singleUrl };
  }
  if (linksFile) {
    return { type: 'file', linksFile };
  }

  console.error('❌ Entrée manquante: fournissez ICS_URL (unique) ou ICS_URLS_FILE (fichier .txt de liens .shu/.ics).');
  process.exit(1);
}

function toTZISO(d) {
  return DateTime.fromJSDate(d, { zone: 'utc' })
    .setZone(TZ)
    .toISO({ suppressMilliseconds: true });
}

(async () => {
  const urls = await resolveInputUrls(INPUT);
  if (urls.length === 0) {
    throw new Error('Aucune URL ICS exploitable trouvée.');
  }

  const nowUtc = DateTime.utc();
  const rangeStart = nowUtc.minus({ days: PAST_DAYS }).toJSDate();
  const rangeEnd = nowUtc.plus({ days: HORIZON_DAYS }).toJSDate();

  const allItems = [];
  for (const url of urls) {
    console.log(`➡️  Fetch ICS: ${url}`);

    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        console.warn(`⚠️  Ignoré (${res.status}) : ${url}`);
        continue;
      }

      const ics = await res.text();
      const expander = new IcalExpander({ ics, maxIterations: 5000 });
      const { events, occurrences } = expander.between(rangeStart, rangeEnd);

      for (const e of events) {
        const comp = e.component || e;
        allItems.push(normalize(comp, e.startDate.toJSDate(), e.endDate.toJSDate(), url));
      }
      for (const o of occurrences) {
        const comp = o.item.component || o.item;
        allItems.push(normalize(comp, o.startDate.toJSDate(), o.endDate.toJSDate(), url));
      }
    } catch (err) {
      console.warn(`⚠️  Ignoré (erreur réseau/parsing) : ${url}`);
      console.warn(String(err));
    }
  }

  const items = dedupeAndSort(allItems);

  const payload = {
    generated_at: DateTime.utc().toISO({ suppressMilliseconds: true }),
    timezone: TZ,
    horizon_days: HORIZON_DAYS,
    count: items.length,
    sources_count: urls.length,
    events: items
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Écrit ${OUTPUT_FILE} (${items.length} événements, ${urls.length} source(s))`);
})().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});

async function resolveInputUrls(input) {
  if (input.type === 'single') return [input.singleUrl.trim()];

  const urls = new Set();
  if (input.type === 'mixed') urls.add(input.singleUrl.trim());

  const linksFile = input.linksFile;
  const fileRaw = await fs.readFile(linksFile, 'utf8');

  for (const line of fileRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^https?:\/\//i.test(trimmed)) continue;
    urls.add(trimmed);
  }

  return [...urls];
}

function dedupeAndSort(items) {
  const seen = new Set();
  const uniq = [];

  for (const item of items) {
    const key = [item.id, item.start, item.end, item.location, item.title].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(item);
  }

  uniq.sort((a, b) => new Date(a.start) - new Date(b.start));
  return uniq;
}

function normalize(component, start, end, sourceUrl) {
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
    source: sourceUrl,
    lastModified: lastmod ? toTZISO(new Date(lastmod.toString())) : null
  };
}
