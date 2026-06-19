import unittest
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import filter_items_by_created_at, parse_datetime


class DateFilteringTests(unittest.TestCase):
    def test_parse_datetime_accepts_existing_dashboard_formats(self):
        expected = datetime(2025, 4, 5, 13, 30, 0)

        self.assertEqual(parse_datetime("04/05/2025 13:30:00"), expected)
        self.assertEqual(parse_datetime("04/05/2025T13:30:00"), expected)
        self.assertEqual(parse_datetime("2025-04-05 13:30:00"), expected)
        self.assertEqual(parse_datetime("2025-04-05T13:30:00"), expected)

    def test_filter_items_by_created_at_excludes_wrong_years(self):
        items = [
            {"id": "old", "created_at": "06/15/2016 12:00:00"},
            {"id": "in-range", "created_at": "04/15/2025 12:00:00"},
            {"id": "future", "created_at": "04/15/2026 12:00:00"},
            {"id": "bad", "created_at": "not-a-date"},
        ]

        filtered = filter_items_by_created_at(
            items,
            datetime(2025, 1, 1, 0, 0, 0),
            datetime(2025, 12, 31, 23, 59, 59),
        )

        self.assertEqual([item["id"] for item in filtered], ["in-range"])


if __name__ == "__main__":
    unittest.main()
