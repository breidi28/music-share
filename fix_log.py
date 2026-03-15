import sys

with open('backend/app.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('app.logger.error(f"[Spotify Sync] Error syncing history for user {user.id}: {e}")', 'import traceback\n                app.logger.error(f"[Spotify Sync] Error syncing history for user {user.id}: {traceback.format_exc()}")')

with open('backend/app.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
