import sys
import logging
import os

# enable logging to console
logging.basicConfig(level=logging.DEBUG)

sys.path.append(os.getcwd())
try:
    from backend.app import app, sync_spotify_history, Post
    with app.app_context():
        print("Starting manual sync...")
        sync_spotify_history()
        print("Sync finished.")
        count = Post.query.filter_by(post_type='history').count()
        print(f"Total history posts in DB: {count}")
except Exception as e:
    import traceback
    traceback.print_exc()
