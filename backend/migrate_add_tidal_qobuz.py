"""
Migration script to add Tidal and Qobuz columns to existing database.
Run this once to update the schema without losing data.
"""
import sqlite3
import os

# Path to database
db_path = os.path.join(os.path.dirname(__file__), 'instance', 'musicshare.db')

print(f"Migrating database at: {db_path}")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Add Tidal columns
    print("Adding Tidal columns...")
    cursor.execute("ALTER TABLE user ADD COLUMN tidal_session_id VARCHAR(500) DEFAULT ''")
    cursor.execute("ALTER TABLE user ADD COLUMN tidal_access_token VARCHAR(500) DEFAULT ''")
    cursor.execute("ALTER TABLE user ADD COLUMN tidal_refresh_token VARCHAR(500) DEFAULT ''")
    cursor.execute("ALTER TABLE user ADD COLUMN tidal_user_id VARCHAR(100) DEFAULT ''")
    cursor.execute("ALTER TABLE user ADD COLUMN tidal_token_expires_at DATETIME")
    print("✓ Tidal columns added")
    
    # Add Qobuz columns
    print("Adding Qobuz columns...")
    cursor.execute("ALTER TABLE user ADD COLUMN qobuz_user_auth_token VARCHAR(500) DEFAULT ''")
    cursor.execute("ALTER TABLE user ADD COLUMN qobuz_user_id VARCHAR(100) DEFAULT ''")
    cursor.execute("ALTER TABLE user ADD COLUMN qobuz_token_expires_at DATETIME")
    print("✓ Qobuz columns added")
    
    # Commit changes
    conn.commit()
    print("\n✅ Migration successful! You can now log in.")
    
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print(f"⚠️  Columns already exist: {e}")
        print("Migration already applied or partially applied.")
    else:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
finally:
    conn.close()
