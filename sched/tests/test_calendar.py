import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sync_calendar import parse_calendar

def calendar(properties):
    return 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:test\r\n' + properties + '\r\nEND:VEVENT\r\nEND:VCALENDAR'

class CalendarTest(unittest.TestCase):
    def test_real_feed_and_paris_winter(self):
        events = parse_calendar((Path(__file__).resolve().parents[1] / 'data/calendar.ics').read_text())
        self.assertGreater(len(events), 0)
        self.assertTrue(all(e['end'] > e['start'] for e in events))
        self.assertTrue(any(e['englishGroup'] == 1 for e in events))
        self.assertTrue(any(e['englishGroup'] == 2 for e in events))

    def test_unfolding_escapes_and_utc(self):
        item = parse_calendar(calendar('DTSTART:20261103T083000Z\r\nDTEND:20261103T093000Z\r\nSUMMARY:Méthodologie de la\r\n recherche\r\nDESCRIPTION:Une ligne\\nDeux\\, trois\\; quatre\\\\fin'))[0]
        self.assertEqual(item['title'], 'Méthodologie de larecherche')
        self.assertEqual(item['start'], '2026-11-03T08:30:00+00:00')
        self.assertEqual(item['description'], 'Une ligne\nDeux, trois; quatre\\fin')

    def test_timezone_summer_and_winter(self):
        for month, utc in [('07', '07:30'), ('11', '08:30')]:
            item=parse_calendar(calendar(f'DTSTART;TZID=Europe/Paris:2026{month}03T093000\nDTEND;TZID=Europe/Paris:2026{month}03T103000'))[0]
            self.assertIn(utc, item['start'])

    def test_cancelled_removed(self):
        text=calendar('DTSTART:20261103T083000Z\nDTEND:20261103T093000Z')
        text=text.replace('END:VCALENDAR','BEGIN:VEVENT\nUID:cancelled\nSTATUS:CANCELLED\nEND:VEVENT\nEND:VCALENDAR')
        self.assertEqual(len(parse_calendar(text)),1)

    def test_html_and_recurrence_rejected(self):
        for text in ['<html>erreur</html>',calendar('DTSTART:20261103T083000Z\nDTEND:20261103T093000Z\nRRULE:FREQ=WEEKLY')]:
            with self.assertRaises(ValueError): parse_calendar(text)

    def test_all_day(self):
        item = parse_calendar(calendar('DTSTART;VALUE=DATE:20261103\nDTEND;VALUE=DATE:20261104'))[0]
        self.assertTrue(item['allDay'])
        self.assertEqual(item['start'], '2026-11-02T23:00:00+00:00')

if __name__ == '__main__': unittest.main()
