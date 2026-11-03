"""Download the ULCO feed and generate static data (Python 3.11+, no dependencies)."""
import argparse
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://edt.univ-littoral.fr/jsp/custom/modules/plannings/m32a1PWk.shu'

def unescape(value):
    return re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value)

def date_value(key, value):
    if len(value) == 8:
        return datetime.strptime(value, '%Y%m%d').replace(tzinfo=ZoneInfo('Europe/Paris')), True
    utc = value.endswith('Z')
    parsed = datetime.strptime(value.rstrip('Z'), '%Y%m%dT%H%M%S')
    match = re.search(r'TZID=([^;:]+)', key)
    return parsed.replace(tzinfo=timezone.utc if utc else ZoneInfo(match[1].strip('"') if match else 'Europe/Paris')), False

def parse_calendar(text):
    if 'BEGIN:VCALENDAR' not in text or 'END:VCALENDAR' not in text:
        raise ValueError('Réponse invalide : calendrier iCalendar attendu')
    lines = re.sub(r'\r?\n[ \t]', '', text).splitlines()
    current = None
    events = {}
    for line in lines:
        if line == 'BEGIN:VEVENT':
            current = {}
        elif line == 'END:VEVENT' and current is not None:
            if current.get('STATUS', ('', ''))[1] == 'CANCELLED':
                current = None
                continue
            if 'RRULE' in current or 'RDATE' in current:
                raise ValueError('Récurrences détectées : adapter le parseur avant de synchroniser')
            start, all_day = date_value(*current['DTSTART'])
            end = date_value(*current['DTEND'])[0] if 'DTEND' in current else start + timedelta(days=1)
            if end <= start:
                raise ValueError('Durée de cours invalide')
            title = unescape(current.get('SUMMARY', ('', 'Sans titre'))[1])
            description = unescape(current.get('DESCRIPTION', ('', ''))[1]).strip()
            description = re.sub(r'\s*\(Exporté le:.*?\)\s*', '', description, flags=re.S).strip()
            uid = current.get('UID', ('', title + start.isoformat()))[1]
            english_group = 1 if re.search(r'Anglais.*G1', title, re.I) else 2 if re.search(r'Anglais.*Groupe\s*2', title, re.I) else 0
            event = dict(id=uid, title=title, start=start.astimezone(timezone.utc).isoformat(), end=end.astimezone(timezone.utc).isoformat(), location=unescape(current.get('LOCATION', ('', ''))[1]), description=description, allDay=all_day, englishGroup=english_group)
            events[uid + start.isoformat()] = event
            current = None
        elif current is not None and ':' in line:
            key, value = line.split(':', 1)
            current[key.split(';')[0]] = (key, value)
    if not events:
        raise ValueError('Le calendrier ne contient aucun cours ; les anciennes données sont conservées')
    return sorted(events.values(), key=lambda e: e['start'])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-file', type=Path)
    args = parser.parse_args()
    if args.from_file:
        raw = args.from_file.read_bytes()
    else:
        with urlopen(Request(SOURCE, headers={'User-Agent': 'CampusAgenda/1.0'}), timeout=60) as response:
            raw = response.read(5_000_001)
    if len(raw) > 5_000_000:
        raise ValueError('Calendrier trop volumineux')
    text = raw.decode('utf-8-sig')
    events = parse_calendar(text)
    data = dict(source=SOURCE, updatedAt=datetime.now(timezone.utc).isoformat(), timezone='Europe/Paris', events=events)
    (ROOT / 'data').mkdir(exist_ok=True)
    for name, content in [('calendar.ics', text), ('schedule.json', json.dumps(data, ensure_ascii=False, indent=2) + '\n')]:
        target = ROOT / 'data' / name
        tmp = target.with_suffix(target.suffix + '.tmp')
        tmp.write_text(content, encoding='utf-8')
        tmp.replace(target)
    print(f'{len(events)} événements synchronisés')

if __name__ == '__main__':
    main()
