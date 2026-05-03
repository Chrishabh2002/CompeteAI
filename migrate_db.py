"""Migrate DB: add missing columns to analysis_results table."""
import sqlite3

conn = sqlite3.connect("competeai.db")
c = conn.cursor()

migrations = [
    ("keywords_json", "ALTER TABLE analysis_results ADD COLUMN keywords_json TEXT NOT NULL DEFAULT '[]'"),
    ("sentiment_score", "ALTER TABLE analysis_results ADD COLUMN sentiment_score FLOAT"),
    ("buy_recommendation", "ALTER TABLE analysis_results ADD COLUMN buy_recommendation VARCHAR(32)"),
    ("star_rating", "ALTER TABLE analysis_results ADD COLUMN star_rating FLOAT"),
    ("price", "ALTER TABLE analysis_results ADD COLUMN price VARCHAR(64)"),
]

for name, sql in migrations:
    try:
        c.execute(sql)
        print(f"  + Added column: {name}")
    except Exception as e:
        print(f"  = Column {name} already exists ({e})")

conn.commit()

# Verify
print("\nFinal schema:")
for row in c.execute("PRAGMA table_info(analysis_results)").fetchall():
    print(f"  {row}")

print("\nMigration complete!")
conn.close()
