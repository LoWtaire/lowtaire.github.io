import fs from 'node:fs/promises';

const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node scripts/validate-data.mjs <fichier.json> [...]');
  process.exit(1);
}

const maxAgeHours = Number(process.env.MAX_DATA_AGE_HOURS || 36);
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error('MAX_DATA_AGE_HOURS invalide');
let hasError = false;

for (const file of files) {
  try {
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(payload.events)) throw new Error('events doit être un tableau');
    if (!payload.events.length) throw new Error('aucun événement reçu');
    if (Number(payload.count) !== payload.events.length) {
      throw new Error('count (' + payload.count + ') ne correspond pas à events.length (' + payload.events.length + ')');
    }
    if (!payload.generated_at || Number.isNaN(Date.parse(payload.generated_at))) {
      throw new Error('generated_at absent ou invalide');
    }

    const age = Date.now() - Date.parse(payload.generated_at);
    if (age < -5 * 60 * 1000 || age > maxAgeHours * 3600000) {
      throw new Error('JSON hors date : generated_at=' + payload.generated_at);
    }
    if (!payload.events.some(event => Date.parse(event.end) > Date.now())) {
      throw new Error('Le calendrier ne contient que des reservations passees');
    }

    for (const [index, event] of payload.events.entries()) {
      if (Number.isNaN(Date.parse(event.start)) || Number.isNaN(Date.parse(event.end))) {
        throw new Error('dates invalides pour l’événement ' + index);
      }
      if (Date.parse(event.end) <= Date.parse(event.start)) {
        throw new Error('fin antérieure au début pour l’événement ' + index);
      }
    }

    console.log('✅ ' + file + ': ' + payload.events.length + ' événements valides');
  } catch (error) {
    hasError = true;
    console.error('❌ ' + file + ': ' + error.message);
  }
}

if (hasError) process.exit(1);
