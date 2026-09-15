import sqlite3
import json

conn = sqlite3.connect('blockchain.db')
c = conn.cursor()
c.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
tables = c.fetchall()

schema = {name: sql for name, sql in tables}

with open('schema_output.json', 'w') as f:
    json.dump(schema, f, indent=2)

conn.close()
