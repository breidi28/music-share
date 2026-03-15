import sys
import os

sys.path.append(os.getcwd())
try:
    from backend.app import app, Post
    with app.app_context():
        import datetime
        posts = Post.query.order_by(Post.created_at.desc()).limit(5).all()
        print('Current utcnow:', datetime.datetime.utcnow())
        print('Recent posts:')
        for p in posts:
            print(f'  ID: {p.id}, type: {p.post_type}, created_at: {p.created_at}, title: {p.track_title}')
except Exception as e:
    import traceback
    traceback.print_exc()
