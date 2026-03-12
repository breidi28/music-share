"""
Migration script to add Deezer OAuth fields to the User table.
Run this once to update the database schema.
"""
import sqlite3
import os

# Get database path
DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'musicshare.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(user)")
    columns = [row[1] for row in cursor.fetchall()]
    
    migrations = []
    
    if 'deezer_access_token' not in columns:
        migrations.append("ALTER TABLE user ADD COLUMN deezer_access_token VARCHAR(500) DEFAULT ''")
    
    if 'deezer_user_id' not in columns:
        migrations.append("ALTER TABLE user ADD COLUMN deezer_user_id VARCHAR(100) DEFAULT ''")
    
    if 'deezer_token_expires_at' not in columns:
        migrations.append("ALTER TABLE user ADD COLUMN deezer_token_expires_at DATETIME")
    
    if not migrations:
        print("✓ Deezer columns already exist. No migration needed.")
        conn.close()
        return
    
    # Execute migrations
    for sql in migrations:
        print(f"Executing: {sql}")
        cursor.execute(sql)
    
    conn.commit()
    conn.close()
    
    print("✓ Migration complete! Deezer OAuth fields added to User table.")

if __name__ == '__main__':
    migrate()
