from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone
from sqlalchemy import inspect, text
import os
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# CORS Configuration – restrict to allowed origins
_default_origins = 'http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006'
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ORIGINS', _default_origins).split(',') if origin.strip()]
CORS(app, origins=ALLOWED_ORIGINS, methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], supports_credentials=True)

# Config – use absolute path so DB location is stable regardless of cwd
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Setup Database connection
database_url = os.getenv('DATABASE_URL')
if database_url:
    # Render's Postgres URLs start with postgres:// but SQLAlchemy requires postgresql://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Fallback to local SQLite database
    db_path = os.getenv('DATABASE_PATH', 'instance/musicshare.db')
    full_db_path = os.path.join(_BASE_DIR, db_path)
    
    # Ensure the directory exists (e.g. 'instance/') so Railway doesn't crash if it's not in git
    os.makedirs(os.path.dirname(full_db_path), exist_ok=True)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{full_db_path}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)  # Reduced from 30 days

db = SQLAlchemy(app)
jwt = JWTManager(app)

# Basic liveness endpoints for hosting platform health checks
@app.route('/', methods=['GET'])
def root_health():
    return jsonify({'status': 'ok', 'service': 'music-share-backend'}), 200


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

# ─── Input Validation Helpers ──────────────────────────────────────────────────

MAX_USERNAME_LEN = 50
MAX_DISPLAY_NAME_LEN = 100
MAX_EMAIL_LEN = 120
MAX_BIO_LEN = 300
MAX_GENRES_LEN = 200
MAX_CAPTION_LEN = 500
MAX_COMMENT_LEN = 500
MAX_URL_LEN = 500
MIN_PASSWORD_LEN = 8
VALID_REACTION_TYPES = {'saved', 'on_repeat', 'skip', 'crate_worthy'}

def validate_email(email: str) -> bool:
    """Basic email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email)) and len(email) <= MAX_EMAIL_LEN

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength. Returns (is_valid, error_message)."""
    if len(password) < MIN_PASSWORD_LEN:
        return False, f'Password must be at least {MIN_PASSWORD_LEN} characters'
    if not re.search(r'[A-Za-z]', password):
        return False, 'Password must contain at least one letter'
    if not re.search(r'\d', password):
        return False, 'Password must contain at least one number'
    return True, ''

def sanitize_string(s: str, max_len: int) -> str:
    """Trim and limit string length."""
    return s.strip()[:max_len] if s else ''

def validate_url(url: str) -> bool:
    """Basic URL validation."""
    if not url:
        return True  # Empty URLs are allowed
    if len(url) > MAX_URL_LEN:
        return False
    return url.startswith(('http://', 'https://', 'file://', 'content://'))

# ─── Models ────────────────────────────────────────────────────────────────────

followers = db.Table('followers',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

track_likes = db.Table('track_likes',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('post_id', db.Integer, db.ForeignKey('post.id'), primary_key=True)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    bio = db.Column(db.String(300), default='')
    avatar_url = db.Column(db.String(500), default='')
    favorite_genres = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_post_date = db.Column(db.Date, nullable=True)

    # Spotify OAuth
    spotify_access_token = db.Column(db.String(500), default='')
    spotify_refresh_token = db.Column(db.String(500), default='')
    spotify_token_expires_at = db.Column(db.DateTime, nullable=True)

    # YouTube Music OAuth (uses Google OAuth)
    youtube_access_token = db.Column(db.String(500), default='')
    youtube_refresh_token = db.Column(db.String(500), default='')
    youtube_token_expires_at = db.Column(db.DateTime, nullable=True)

    # Apple Music (uses MusicKit developer token + user token)
    apple_music_user_token = db.Column(db.String(2000), default='')
    apple_music_token_expires_at = db.Column(db.DateTime, nullable=True)

    # Tidal OAuth
    tidal_session_id = db.Column(db.String(500), default='')
    tidal_access_token = db.Column(db.String(500), default='')
    tidal_refresh_token = db.Column(db.String(500), default='')
    tidal_user_id = db.Column(db.String(100), default='')
    tidal_token_expires_at = db.Column(db.DateTime, nullable=True)

    # Qobuz OAuth
    qobuz_user_auth_token = db.Column(db.String(500), default='')
    qobuz_user_id = db.Column(db.String(100), default='')
    qobuz_token_expires_at = db.Column(db.DateTime, nullable=True)

    # Deezer OAuth
    deezer_access_token = db.Column(db.String(500), default='')
    deezer_user_id = db.Column(db.String(100), default='')
    deezer_token_expires_at = db.Column(db.DateTime, nullable=True)

    posts = db.relationship('Post', backref='author', lazy=True, cascade='all, delete-orphan')
    followed = db.relationship('User', secondary=followers,
        primaryjoin=(followers.c.follower_id == id),
        secondaryjoin=(followers.c.followed_id == id),
        backref=db.backref('followers_list', lazy='dynamic'), lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self, current_user_id=None):
        data = {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name,
            'bio': self.bio,
            'avatar_url': self.avatar_url,
            'favorite_genres': self.favorite_genres,
            'followers_count': self.followers_list.count(),
            'following_count': self.followed.count(),
            'posts_count': len(self.posts),
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
            'has_spotify_linked': bool(self.spotify_access_token),
            'has_youtube_linked': bool(self.youtube_access_token),
            'has_apple_music_linked': bool(self.apple_music_user_token),
            'has_tidal_linked': bool(self.tidal_access_token),
            'has_qobuz_linked': bool(self.qobuz_user_auth_token),
            'has_deezer_linked': bool(self.deezer_access_token),
            'collection_count': len(self.collection_items) if hasattr(self, 'collection_items') else 0,
        }
        if current_user_id:
            current = db.session.get(User, current_user_id)
            if current:
                data['is_following'] = current.followed.filter(followers.c.followed_id == self.id).count() > 0
            else:
                data['is_following'] = False
        return data

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    track_title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(200), nullable=False)
    album = db.Column(db.String(200), default='')
    album_art_url = db.Column(db.String(500), default='')
    caption = db.Column(db.String(500), default='')
    # 'now_playing' | 'loved' | 'history'
    post_type = db.Column(db.String(20), nullable=False, default='loved')
    preview_url = db.Column(db.String(500), default='')
    spotify_url = db.Column(db.String(500), default='')
    genre = db.Column(db.String(100), default='')
    listened_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    pinned_comment_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=True)

    liked_by = db.relationship('User', secondary=track_likes, backref='liked_posts', lazy='dynamic')

    def to_dict(self, current_user_id=None):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'author': self.author.to_dict(),
            'track_title': self.track_title,
            'artist': self.artist,
            'album': self.album,
            'album_art_url': self.album_art_url,
            'caption': self.caption,
            'post_type': self.post_type,
            'preview_url': self.preview_url,
            'spotify_url': self.spotify_url,
            'genre': self.genre,
            'likes_count': self.liked_by.count(),
            'listened_at': (self.listened_at.isoformat() + 'Z' if self.listened_at.tzinfo is None else self.listened_at.isoformat()),
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
            'pinned_comment_id': self.pinned_comment_id,
        }
        if current_user_id:
            data['is_liked'] = self.liked_by.filter(track_likes.c.user_id == current_user_id).count() > 0
            my_reactions = PostReaction.query.filter_by(post_id=self.id, user_id=current_user_id).all()
            data['my_reactions'] = [r.reaction_type for r in my_reactions]
        else:
            data['is_liked'] = False
            data['my_reactions'] = []

        counts = db.session.query(
            PostReaction.reaction_type,
            db.func.count(PostReaction.id)
        ).filter_by(post_id=self.id).group_by(PostReaction.reaction_type).all()
        data['reaction_counts'] = {r_type: int(count) for r_type, count in counts}
        return data


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    post = db.relationship(
        'Post',
        foreign_keys=[post_id],
        backref=db.backref('comments', lazy=True, cascade='all, delete-orphan', foreign_keys='Comment.post_id')
    )
    author = db.relationship('User', backref='comments')
    parent = db.relationship('Comment', remote_side=[id], backref='replies')

    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'author': self.author.to_dict(),
            'text': self.text,
            'parent_id': self.parent_id,
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
        }


class Notification(db.Model):
    """In-app notification for likes, comments, follows, and @mentions."""
    id = db.Column(db.Integer, primary_key=True)
    # who receives the notification
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # who triggered it
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # 'like' | 'comment' | 'follow' | 'mention'
    notif_type = db.Column(db.String(20), nullable=False)
    # optional context (post id for like/comment/mention)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='notifications')
    actor = db.relationship('User', foreign_keys=[actor_id])
    post = db.relationship('Post')

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.notif_type,
            'actor': self.actor.to_dict(),
            'post_id': self.post_id,
            'is_read': self.is_read,
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
        }


class PostReaction(db.Model):
    __tablename__ = 'post_reactions'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    reaction_type = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('post_id', 'user_id', 'reaction_type', name='uq_post_user_reaction'),
    )


class ListenLaterItem(db.Model):
    __tablename__ = 'listen_later_items'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    track_title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(200), nullable=False)
    album = db.Column(db.String(200), default='')
    album_art_url = db.Column(db.String(500), default='')
    source_service = db.Column(db.String(50), default='')
    source_url = db.Column(db.String(500), default='')
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    owner = db.relationship('User', backref=db.backref('listen_later_items', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'track_title': self.track_title,
            'artist': self.artist,
            'album': self.album,
            'album_art_url': self.album_art_url,
            'source_service': self.source_service,
            'source_url': self.source_url,
            'added_at': (self.added_at.isoformat() + 'Z' if self.added_at.tzinfo is None else self.added_at.isoformat()),
        }


class NotificationPreference(db.Model):
    __tablename__ = 'notification_preferences'

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    notify_new_post = db.Column(db.Boolean, default=True, nullable=False)
    notify_now_playing = db.Column(db.Boolean, default=False, nullable=False)
    notify_collection_add = db.Column(db.Boolean, default=False, nullable=False)
    notify_mentions = db.Column(db.Boolean, default=True, nullable=False)
    notify_replies = db.Column(db.Boolean, default=True, nullable=False)

    user = db.relationship('User', backref=db.backref('notification_preferences', uselist=False))

    def to_dict(self):
        return {
            'notify_new_post': bool(self.notify_new_post),
            'notify_now_playing': bool(self.notify_now_playing),
            'notify_collection_add': bool(self.notify_collection_add),
            'notify_mentions': bool(self.notify_mentions),
            'notify_replies': bool(self.notify_replies),
        }


def _get_or_create_notification_preferences(user_id: int) -> NotificationPreference:
    prefs = NotificationPreference.query.filter_by(user_id=user_id).first()
    if not prefs:
        prefs = NotificationPreference(user_id=user_id)
        db.session.add(prefs)
        db.session.commit()
    return prefs


def _ensure_phase0_schema() -> None:
    """Best-effort schema compatibility for existing deployments without migrations."""
    db.create_all()
    inspector = inspect(db.engine)

    if 'post' in inspector.get_table_names():
        post_cols = {c['name'] for c in inspector.get_columns('post')}
        if 'pinned_comment_id' not in post_cols:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE post ADD COLUMN pinned_comment_id INTEGER'))
                conn.commit()

    if 'comment' in inspector.get_table_names():
        comment_cols = {c['name'] for c in inspector.get_columns('comment')}
        if 'parent_id' not in comment_cols:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE comment ADD COLUMN parent_id INTEGER'))
                conn.commit()


with app.app_context():
    try:
        _ensure_phase0_schema()
    except Exception as e:
        app.logger.warning(f'Phase 0 schema ensure skipped: {str(e)}')


class CollectionItem(db.Model):
    """Physical media collection (vinyl, CD, cassette, etc.)."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # 'vinyl' | 'cd' | 'cassette' | 'digital'
    media_type = db.Column(db.String(20), nullable=False, default='vinyl')
    album_title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(200), nullable=False)
    album_art_url = db.Column(db.String(500), default='')
    release_year = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.String(500), default='')  # Personal notes about the item
    condition = db.Column(db.String(50), default='')  # 'mint', 'near mint', 'good', etc.
    purchase_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    owner = db.relationship('User', backref=db.backref('collection_items', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'media_type': self.media_type,
            'album_title': self.album_title,
            'artist': self.artist,
            'album_art_url': self.album_art_url,
            'release_year': self.release_year,
            'notes': self.notes,
            'condition': self.condition,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
        }


def _notify(recipient_id: int, actor_id: int, notif_type: str, post_id=None):
    """Create a notification, skipping self-notifications and duplicates."""
    if recipient_id == actor_id:
        return

    prefs = NotificationPreference.query.filter_by(user_id=recipient_id).first()
    if prefs:
        if notif_type == 'mention' and not prefs.notify_mentions:
            return
        if notif_type == 'comment' and not prefs.notify_replies:
            return

    # Deduplicate: one like/follow notification per actor+recipient+type
    if notif_type in ('like', 'follow'):
        exists = Notification.query.filter_by(
            recipient_id=recipient_id, actor_id=actor_id,
            notif_type=notif_type, post_id=post_id
        ).first()
        if exists:
            return
    n = Notification(recipient_id=recipient_id, actor_id=actor_id,
                     notif_type=notif_type, post_id=post_id)
    db.session.add(n)
    # No commit here — caller commits



def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        required = ['username', 'email', 'password', 'display_name']
        for field in required:
            if not data.get(field) or not data[field].strip():
                return jsonify({'error': f'{field} is required'}), 400

        # Validate email format
        email = data['email'].strip().lower()
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400

        # Validate password strength
        password = data['password']
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        # Validate field lengths
        username = sanitize_string(data['username'].lower(), MAX_USERNAME_LEN)
        display_name = sanitize_string(data['display_name'], MAX_DISPLAY_NAME_LEN)
        bio = sanitize_string(data.get('bio', ''), MAX_BIO_LEN)
        favorite_genres = sanitize_string(data.get('favorite_genres', ''), MAX_GENRES_LEN)

        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400

        # Case-insensitive uniqueness checks
        if User.query.filter(User.username.ilike(username)).first():
            return jsonify({'error': 'Username already taken'}), 409
        if User.query.filter(User.email.ilike(email)).first():
            return jsonify({'error': 'Email already in use'}), 409

        user = User(
            username=username,
            display_name=display_name,
            email=email,
            bio=bio,
            favorite_genres=favorite_genres
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        token = create_access_token(identity=str(user.id))
        return jsonify({'token': token, 'user': user.to_dict()}), 201

    except Exception as e:
        app.logger.error(f'Registration error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        identifier = data.get('username', '').strip().lower()
        password = data.get('password', '')

        if not identifier or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400

        # Accept either username or email
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401

        token = create_access_token(identity=str(user.id))
        return jsonify({'token': token, 'user': user.to_dict(current_user_id=user.id)}), 200

    except Exception as e:
        app.logger.error(f'Login error: {str(e)}')
        return jsonify({'error': 'Login failed'}), 500


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    return jsonify(user.to_dict(current_user_id=user_id))

# ─── Spotify OAuth ─────────────────────────────────────────────────────────────

import requests
import base64
from ytmusicapi import YTMusic
import tidalapi

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET', '')
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'exp://localhost:8081')

# YouTube Music (Google OAuth) credentials
YOUTUBE_CLIENT_ID = os.getenv('YOUTUBE_CLIENT_ID', '')
YOUTUBE_CLIENT_SECRET = os.getenv('YOUTUBE_CLIENT_SECRET', '')
YOUTUBE_REDIRECT_URI = os.getenv('YOUTUBE_REDIRECT_URI', 'exp://localhost:8081')

# Apple Music credentials
APPLE_MUSIC_TEAM_ID = os.getenv('APPLE_MUSIC_TEAM_ID', '')
APPLE_MUSIC_KEY_ID = os.getenv('APPLE_MUSIC_KEY_ID', '')

# Tidal credentials
TIDAL_CLIENT_ID = os.getenv('TIDAL_CLIENT_ID', '')
TIDAL_CLIENT_SECRET = os.getenv('TIDAL_CLIENT_SECRET', '')

# Qobuz credentials
QOBUZ_APP_ID = os.getenv('QOBUZ_APP_ID', '')
QOBUZ_APP_SECRET = os.getenv('QOBUZ_APP_SECRET', '')

# Deezer credentials
DEEZER_APP_ID = os.getenv('DEEZER_APP_ID', '')
DEEZER_APP_SECRET = os.getenv('DEEZER_APP_SECRET', '')
DEEZER_REDIRECT_URI = os.getenv('DEEZER_REDIRECT_URI', 'exp://localhost:8081')

APPLE_MUSIC_PRIVATE_KEY = os.getenv('APPLE_MUSIC_PRIVATE_KEY', '')

@app.route('/api/integrations/spotify/callback', methods=['POST'])
@jwt_required()
def spotify_callback():
    try:
        if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
            return jsonify({'error': 'Spotify integration not configured'}), 503

        current_user_id = int(get_jwt_identity())
        user = db.get_or_404(User, current_user_id)
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        code = data.get('code')
        if not code:
            return jsonify({'error': 'Authorization code is required'}), 400

        # Use the redirect_uri the frontend actually used (must match Spotify exactly)
        redirect_uri = data.get('redirect_uri', SPOTIFY_REDIRECT_URI)

        app.logger.info(f"[Spotify] Exchanging code for user {current_user_id}")

        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        b64_auth_str = base64.b64encode(auth_str.encode()).decode()
        
        response = requests.post(
            'https://accounts.spotify.com/api/token',
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': redirect_uri
            },
            headers={
                'Authorization': f'Basic {b64_auth_str}',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout=10
        )
        
        token_info = response.json()
        
        if 'error' in token_info:
            app.logger.warning(f"Spotify error: {token_info.get('error')}")
            return jsonify({'error': 'Failed to connect to Spotify'}), 400
            
        user.spotify_access_token = token_info.get('access_token', '')
        if 'refresh_token' in token_info:
            user.spotify_refresh_token = token_info['refresh_token']
            
        expires_in = token_info.get('expires_in', 3600)
        user.spotify_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        db.session.commit()
        return jsonify({'message': 'Spotify linked successfully', 'user': user.to_dict(current_user_id)})
        
    except requests.RequestException as e:
        app.logger.error(f'Spotify API error: {str(e)}')
        return jsonify({'error': 'Failed to connect to Spotify'}), 503
    except Exception as e:
        app.logger.error(f'Spotify callback error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to link Spotify account'}), 500

@app.route('/api/integrations/spotify/live', methods=['GET'])
@jwt_required()
def get_spotify_live():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        user_id = int(get_jwt_identity())
        
    user = db.get_or_404(User, user_id)
    
    if not user.spotify_access_token:
        return jsonify({'is_playing': False, 'message': 'Spotify not linked'})
        
    # Check if token needs refresh
    if user.spotify_token_expires_at and datetime.utcnow() > user.spotify_token_expires_at:
        # Need to refresh token
        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        b64_auth_str = base64.b64encode(auth_str.encode()).decode()
        
        try:
            res = requests.post(
                'https://accounts.spotify.com/api/token',
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': user.spotify_refresh_token
                },
                headers={
                    'Authorization': f'Basic {b64_auth_str}',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            )
            refresh_info = res.json()
            if 'access_token' in refresh_info:
                user.spotify_access_token = refresh_info['access_token']
                if 'refresh_token' in refresh_info:
                    user.spotify_refresh_token = refresh_info['refresh_token']
                user.spotify_token_expires_at = datetime.utcnow() + timedelta(seconds=refresh_info.get('expires_in', 3600))
                db.session.commit()
            else:
                return jsonify({'is_playing': False, 'error': 'Failed to refresh token'})
        except:
            return jsonify({'is_playing': False, 'error': 'Exception during refresh'})

    # Fetch currently playing
    try:
        response = requests.get(
            'https://api.spotify.com/v1/me/player/currently-playing',
            headers={'Authorization': f"Bearer {user.spotify_access_token}"}
        )
        
        if response.status_code == 204:
            return jsonify({'is_playing': False, 'message': 'Nothing currently playing'})
            
        data = response.json()
        if not data or not data.get('item'):
            return jsonify({'is_playing': False})
            
        item = data['item']
        
        # Only return basic safe metadata so frontend can render it
        track_data = {
            'is_playing': data.get('is_playing', False),
            'track_title': item.get('name', ''),
            'artist': ', '.join([a.get('name', '') for a in item.get('artists', [])]),
            'album': item.get('album', {}).get('name', ''),
            'album_art_url': item.get('album', {}).get('images', [{}])[0].get('url', ''),
            'preview_url': item.get('preview_url', ''),
            'spotify_url': item.get('external_urls', {}).get('spotify', ''),
            'progress_ms': data.get('progress_ms', 0),
            'duration_ms': item.get('duration_ms', 0)
        }
        
        return jsonify(track_data)
        
    except Exception as e:
        return jsonify({'is_playing': False, 'error': str(e)})


def _spotify_get(user, endpoint: str):
    """Shared helper: refresh token if needed, then call Spotify API. Returns (response_json, error_str)."""
    if not user.spotify_access_token:
        app.logger.warning(f'[Spotify] User {user.id} has no access token')
        return None, 'Spotify not linked'

    if user.spotify_token_expires_at and datetime.utcnow() > user.spotify_token_expires_at:
        app.logger.info(f'[Spotify] Refreshing token for user {user.id}')
        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        b64 = base64.b64encode(auth_str.encode()).decode()
        try:
            res = requests.post(
                'https://accounts.spotify.com/api/token',
                data={'grant_type': 'refresh_token', 'refresh_token': user.spotify_refresh_token},
                headers={'Authorization': f'Basic {b64}', 'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10
            )
            info = res.json()
            if 'access_token' in info:
                user.spotify_access_token = info['access_token']
                if 'refresh_token' in info:
                    user.spotify_refresh_token = info['refresh_token']
                user.spotify_token_expires_at = datetime.utcnow() + timedelta(seconds=info.get('expires_in', 3600))
                db.session.commit()
                app.logger.info(f'[Spotify] Token refreshed successfully for user {user.id}')
            else:
                app.logger.error(f'[Spotify] Token refresh failed for user {user.id}: {info}')
                return None, 'Token refresh failed'
        except Exception as e:
            app.logger.error(f'[Spotify] Token refresh exception for user {user.id}: {str(e)}')
            return None, str(e)

    try:
        app.logger.debug(f'[Spotify] Fetching {endpoint} for user {user.id}')
        r = requests.get(
            f'https://api.spotify.com/v1/{endpoint}',
            headers={'Authorization': f"Bearer {user.spotify_access_token}"},
            timeout=10
        )
        app.logger.debug(f'[Spotify] API response status: {r.status_code}')
        if r.status_code == 401:
            app.logger.warning(f'[Spotify] Unauthorized for user {user.id} - token may be invalid')
            return None, 'Unauthorized – re-link Spotify'
        if r.status_code == 204:
            # No content (normal for some endpoints like currently-playing when nothing is playing)
            return {}, None
        if r.status_code >= 400:
            app.logger.error(f'[Spotify] API error {r.status_code}: {r.text}')
            return None, f'Spotify API error: {r.status_code}'
        return r.json(), None
    except Exception as e:
        app.logger.error(f'[Spotify] Request exception for user {user.id}: {str(e)}')
        return None, str(e)


@app.route('/api/integrations/spotify/recent', methods=['GET'])
@jwt_required()
def spotify_recent():
    """Last 20 recently played tracks for a user."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    data, err = _spotify_get(user, 'me/player/recently-played?limit=20')
    if err:
        app.logger.error(f'[Spotify Recent] Error for user {user_id}: {err}')
        return jsonify({'error': err}), 400

    items = data.get('items', []) if data else []
    app.logger.info(f'[Spotify Recent] Found {len(items)} tracks for user {user_id}')
    
    tracks = []
    for item in items:
        t = item.get('track', {})
        tracks.append({
            'track_title': t.get('name', ''),
            'artist': ', '.join(a['name'] for a in t.get('artists', [])),
            'album': t.get('album', {}).get('name', ''),
            'album_art_url': (t.get('album', {}).get('images') or [{}])[0].get('url', ''),
            'spotify_url': t.get('external_urls', {}).get('spotify', ''),
            'played_at': item.get('played_at', ''),
        })
    return jsonify(tracks)


@app.route('/api/integrations/spotify/top-artists', methods=['GET'])
@jwt_required()
def spotify_top_artists():
    """Top 10 artists (medium term ≈ last 6 months) for a user."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    data, err = _spotify_get(user, 'me/top/artists?limit=10&time_range=medium_term')
    if err:
        app.logger.error(f'[Spotify Top Artists] Error for user {user_id}: {err}')
        return jsonify({'error': err}), 400

    items = data.get('items', []) if data else []
    app.logger.info(f'[Spotify Top Artists] Found {len(items)} artists for user {user_id}')
    
    artists = []
    for a in items:
        artists.append({
            'name': a.get('name', ''),
            'image_url': (a.get('images') or [{}])[0].get('url', ''),
            'genres': a.get('genres', [])[:3],
            'spotify_url': a.get('external_urls', {}).get('spotify', ''),
            'followers': a.get('followers', {}).get('total', 0),
        })
    return jsonify(artists)


@app.route('/api/integrations/spotify/playlists', methods=['GET'])
@jwt_required()
def spotify_playlists():
    """User's public + private playlists (first 20)."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    data, err = _spotify_get(user, 'me/playlists?limit=20')
    if err:
        return jsonify({'error': err}), 400

    items = data.get('items', []) if data else []
    
    playlists = []
    for p in items:
        playlists.append({
            'name': p.get('name', ''),
            'image_url': (p.get('images') or [{}])[0].get('url', ''),
            'track_count': p.get('tracks', {}).get('total', 0),
            'spotify_url': p.get('external_urls', {}).get('spotify', ''),
            'owner': p.get('owner', {}).get('display_name', ''),
            'public': p.get('public', True),
        })
    return jsonify(playlists)


@app.route('/api/integrations/spotify/disconnect', methods=['DELETE'])
@jwt_required()
def spotify_disconnect():
    """Unlink Spotify from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.spotify_access_token = ''
    user.spotify_refresh_token = ''
    user.spotify_token_expires_at = None
    db.session.commit()
    return jsonify({'message': 'Spotify disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── YouTube Music Integration ────────────────────────────────────────────────

def _get_ytmusic_client(user):
    """Get YTMusic client with OAuth credentials for the user."""
    if not user.youtube_access_token:
        app.logger.warning(f'[YouTube Music] User {user.id} has no access token')
        return None, 'YouTube Music not linked'

    # Check if token needs refresh
    if user.youtube_token_expires_at and datetime.utcnow() > user.youtube_token_expires_at:
        if not user.youtube_refresh_token:
            app.logger.warning(f'[YouTube Music] User {user.id} token expired and no refresh token')
            return None, 'YouTube Music token expired - please reconnect'
        
        app.logger.info(f'[YouTube Music] Refreshing token for user {user.id}')
        try:
            res = requests.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': user.youtube_refresh_token,
                    'client_id': YOUTUBE_CLIENT_ID,
                    'client_secret': YOUTUBE_CLIENT_SECRET
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10
            )
            info = res.json()
            if 'access_token' in info:
                user.youtube_access_token = info['access_token']
                user.youtube_token_expires_at = datetime.utcnow() + timedelta(seconds=info.get('expires_in', 3600))
                db.session.commit()
                app.logger.info(f'[YouTube Music] Token refreshed successfully for user {user.id}')
            else:
                app.logger.error(f'[YouTube Music] Token refresh failed for user {user.id}: {info}')
                return None, 'Token refresh failed'
        except Exception as e:
            app.logger.error(f'[YouTube Music] Token refresh exception for user {user.id}: {str(e)}')
            return None, str(e)

    try:
        # Create OAuth credentials for ytmusicapi
        oauth_credentials = {
            "access_token": user.youtube_access_token,
            "refresh_token": user.youtube_refresh_token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "client_id": YOUTUBE_CLIENT_ID,
            "client_secret": YOUTUBE_CLIENT_SECRET
        }
        
        # Initialize YTMusic with OAuth
        ytmusic = YTMusic(oauth_credentials=oauth_credentials)
        return ytmusic, None
    except Exception as e:
        app.logger.error(f'[YouTube Music] Client creation failed for user {user.id}: {str(e)}')
        return None, str(e)


@app.route('/api/integrations/youtube/callback', methods=['POST'])
@jwt_required()
def youtube_callback():
    """Exchange Google OAuth code for YouTube access token."""
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    
    try:
        data = request.get_json()
        code = data.get('code')
        redirect_uri = data.get('redirect_uri', YOUTUBE_REDIRECT_URI)
        
        if not code:
            return jsonify({'error': 'Missing authorization code'}), 400
            
        if not YOUTUBE_CLIENT_ID or not YOUTUBE_CLIENT_SECRET:
            app.logger.error('[YouTube] Missing client credentials in environment')
            return jsonify({'error': 'YouTube Music not configured'}), 500
        
        response = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': redirect_uri,
                'client_id': YOUTUBE_CLIENT_ID,
                'client_secret': YOUTUBE_CLIENT_SECRET
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        
        token_info = response.json()
        
        if 'error' in token_info:
            app.logger.warning(f"YouTube error: {token_info.get('error')}")
            return jsonify({'error': 'Failed to connect to YouTube Music'}), 400
            
        user.youtube_access_token = token_info.get('access_token', '')
        if 'refresh_token' in token_info:
            user.youtube_refresh_token = token_info['refresh_token']
            
        expires_in = token_info.get('expires_in', 3600)
        user.youtube_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        db.session.commit()
        return jsonify({'message': 'YouTube Music linked successfully', 'user': user.to_dict(current_user_id)})
        
    except requests.RequestException as e:
        app.logger.error(f'YouTube API error: {str(e)}')
        return jsonify({'error': 'Failed to connect to YouTube Music'}), 503


@app.route('/api/integrations/youtube/link-token', methods=['POST'])
@jwt_required()
def youtube_link_token():
    """Link YouTube account directly with an access token (from mobile OAuth)."""
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    
    try:
        data = request.get_json()
        access_token = data.get('access_token')
        
        if not access_token:
            return jsonify({'error': 'Missing access token'}), 400
        
        # Verify the token is valid by making a test API call
        test_response = requests.get(
            'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        
        if test_response.status_code != 200:
            app.logger.error(f'[YouTube] Token verification failed: {test_response.text}')
            return jsonify({'error': 'Invalid access token'}), 400
        
        # Store the token
        user.youtube_access_token = access_token
        # Note: When using direct token (not code exchange), we don't get a refresh token
        # The token will expire and the user will need to re-auth
        user.youtube_token_expires_at = datetime.utcnow() + timedelta(hours=1)  # Google tokens typically expire in 1 hour
        
        db.session.commit()
        app.logger.info(f'[YouTube] User {current_user_id} linked YouTube via direct token')
        return jsonify({'message': 'YouTube Music linked successfully', 'user': user.to_dict(current_user_id)})
        
    except requests.RequestException as e:
        app.logger.error(f'YouTube API error: {str(e)}')
        return jsonify({'error': 'Failed to verify YouTube token'}), 503


@app.route('/api/integrations/youtube/playlists', methods=['GET'])
@jwt_required()
def youtube_playlists():
    """User's YouTube Music playlists."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    # Use ytmusicapi to fetch YouTube Music playlists
    ytmusic, err = _get_ytmusic_client(user)
    if err:
        app.logger.error(f'[YouTube Music Playlists] Error for user {user_id}: {err}')
        return jsonify({'error': err}), 400

    try:
        # Get library playlists (user's playlists in YouTube Music)
        library_playlists = ytmusic.get_library_playlists(limit=25)
        app.logger.info(f'[YouTube Music Playlists] Found {len(library_playlists)} playlists for user {user_id}')
        
        playlists = []
        for p in library_playlists:
            playlists.append({
                'name': p.get('title', ''),
                'description': p.get('description', '') or '',
                'image_url': p.get('thumbnails', [{}])[0].get('url', '') if p.get('thumbnails') else '',
                'track_count': p.get('count', 0),
                'youtube_url': f"https://music.youtube.com/playlist?list={p.get('playlistId', '')}",
            })
        return jsonify(playlists)
    except Exception as e:
        app.logger.error(f'[YouTube Music Playlists] Exception for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/youtube/history', methods=['GET'])
@jwt_required()
def youtube_history():
    """User's YouTube Music listening history (recently played)."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    ytmusic, err = _get_ytmusic_client(user)
    if err:
        return jsonify({'error': err}), 400

    try:
        # Get recently played tracks
        history = ytmusic.get_history()
        app.logger.info(f'[YouTube Music History] Found {len(history)} tracks for user {user_id}')
        
        tracks = []
        for item in history[:20]:  # Limit to 20 most recent
            tracks.append({
                'title': item.get('title', ''),
                'artist': ', '.join([a.get('name', '') for a in item.get('artists', [])]),
                'album': item.get('album', {}).get('name', '') if item.get('album') else '',
                'image_url': item.get('thumbnails', [{}])[-1].get('url', '') if item.get('thumbnails') else '',
                'duration': item.get('duration_seconds', 0),
            })
        return jsonify(tracks)
    except Exception as e:
        app.logger.error(f'[YouTube Music History] Exception for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/youtube/liked', methods=['GET'])
@jwt_required()
def youtube_liked():
    """User's liked songs from YouTube Music."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    ytmusic, err = _get_ytmusic_client(user)
    if err:
        return jsonify({'error': err}), 400

    try:
        # Get liked songs
        liked = ytmusic.get_liked_songs(limit=25)
        tracks = liked.get('tracks', [])
        app.logger.info(f'[YouTube Music Liked] Found {len(tracks)} liked songs for user {user_id}')
        
        songs = []
        for item in tracks:
            songs.append({
                'title': item.get('title', ''),
                'artist': ', '.join([a.get('name', '') for a in item.get('artists', [])]),
                'album': item.get('album', {}).get('name', '') if item.get('album') else '',
                'image_url': item.get('thumbnails', [{}])[-1].get('url', '') if item.get('thumbnails') else '',
                'duration': item.get('duration_seconds', 0),
            })
        return jsonify(songs)
    except Exception as e:
        app.logger.error(f'[YouTube Music Liked] Exception for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/youtube/disconnect', methods=['DELETE'])
@jwt_required()
def youtube_disconnect():
    """Unlink YouTube Music from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.youtube_access_token = ''
    user.youtube_refresh_token = ''
    user.youtube_token_expires_at = None
    db.session.commit()
    return jsonify({'message': 'YouTube Music disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── Apple Music Integration ───────────────────────────────────────────────────

@app.route('/api/integrations/apple/callback', methods=['POST'])
@jwt_required()
def apple_music_callback():
    """Store Apple Music user token (frontend handles MusicKit authentication)."""
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    
    try:
        data = request.get_json()
        user_token = data.get('user_token')
        
        if not user_token:
            return jsonify({'error': 'Missing user token'}), 400
        
        # Store the user token (it's a JWT that expires)
        user.apple_music_user_token = user_token
        # Apple Music tokens typically expire after 6 months
        user.apple_music_token_expires_at = datetime.utcnow() + timedelta(days=180)
        
        db.session.commit()
        return jsonify({'message': 'Apple Music linked successfully', 'user': user.to_dict(current_user_id)})
        
    except Exception as e:
        app.logger.error(f'Apple Music error: {str(e)}')
        return jsonify({'error': 'Failed to connect to Apple Music'}), 503


@app.route('/api/integrations/apple/playlists', methods=['GET'])
@jwt_required()
def apple_music_playlists():
    """User's Apple Music library playlists."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.apple_music_user_token:
        app.logger.error(f'[Apple Music Playlists] No token for user {user_id}')
        return jsonify({'error': 'Apple Music not linked'}), 400

    try:
        app.logger.debug(f'[Apple Music] Fetching playlists for user {user_id}')
        r = requests.get(
            'https://api.music.apple.com/v1/me/library/playlists',
            headers={
                'Authorization': f"Bearer {user.apple_music_user_token}",
                'Music-User-Token': user.apple_music_user_token
            },
            params={'limit': 20},
            timeout=10
        )
        
        if r.status_code == 401:
            app.logger.warning(f'[Apple Music] Unauthorized for user {user_id}')
            return jsonify({'error': 'Unauthorized – re-link Apple Music'}), 401
        if r.status_code >= 400:
            app.logger.error(f'[Apple Music] API error {r.status_code}: {r.text}')
            return jsonify({'error': f'Apple Music API error: {r.status_code}'}), 400

        data = r.json()
        items = data.get('data', [])
        app.logger.info(f'[Apple Music Playlists] Found {len(items)} playlists for user {user_id}')
        
        playlists = []
        for p in items:
            attrs = p.get('attributes', {})
            artwork = attrs.get('artwork', {})
            playlists.append({
                'name': attrs.get('name', ''),
                'description': attrs.get('description', {}).get('standard', ''),
                'image_url': artwork.get('url', '').replace('{w}', '300').replace('{h}', '300') if artwork.get('url') else '',
                'track_count': attrs.get('trackCount', 0),
                'apple_url': attrs.get('url', ''),
            })
        return jsonify(playlists)
        
    except Exception as e:
        app.logger.error(f'[Apple Music] Request exception for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/apple/disconnect', methods=['DELETE'])
@jwt_required()
def apple_music_disconnect():
    """Unlink Apple Music from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.apple_music_user_token = ''
    user.apple_music_token_expires_at = None
    db.session.commit()
    return jsonify({'message': 'Apple Music disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── Tidal Integration ─────────────────────────────────────────────────────────

@app.route('/api/integrations/tidal/auth-url', methods=['GET'])
@jwt_required()
def tidal_auth_url():
    """Get Tidal OAuth authorization URL."""
    if not TIDAL_CLIENT_ID or not TIDAL_CLIENT_SECRET:
        return jsonify({'error': 'Tidal not configured'}), 500
    
    session = tidalapi.Session()
    # Generate login URL
    login_url, future = session.login_oauth()
    
    # Store the session temporarily (in production, use Redis or similar)
    # For now, return the URL and the user will handle the flow
    return jsonify({'auth_url': login_url})


@app.route('/api/integrations/tidal/callback', methods=['POST'])
@jwt_required()
def tidal_callback():
    """Complete Tidal OAuth flow and store tokens."""
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    
    try:
        data = request.get_json()
        # Tidal OAuth returns session data
        access_token = data.get('access_token')
        refresh_token = data.get('refresh_token')
        user_id = data.get('user_id')
        
        if not access_token:
            return jsonify({'error': 'Missing access token'}), 400
        
        user.tidal_access_token = access_token
        user.tidal_refresh_token = refresh_token or ''
        user.tidal_user_id = user_id or ''
        user.tidal_token_expires_at = datetime.utcnow() + timedelta(days=30)
        
        db.session.commit()
        return jsonify({'message': 'Tidal linked successfully', 'user': user.to_dict(current_user_id)})
        
    except Exception as e:
        app.logger.error(f'Tidal callback error: {str(e)}')
        return jsonify({'error': 'Failed to link Tidal'}), 503


@app.route('/api/integrations/tidal/playlists', methods=['GET'])
@jwt_required()
def tidal_playlists():
    """User's Tidal playlists."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.tidal_access_token:
        return jsonify({'error': 'Tidal not linked'}), 400

    try:
        # Create session with stored tokens
        session = tidalapi.Session()
        session.load_oauth_session(
            token_type='Bearer',
            access_token=user.tidal_access_token,
            refresh_token=user.tidal_refresh_token
        )
        
        # Get user's playlists
        playlists_data = session.user.playlists()
        
        playlists = []
        for p in playlists_data[:20]:  # Limit to 20
            playlists.append({
                'name': p.name,
                'description': p.description or '',
                'image_url': p.image(320) if hasattr(p, 'image') else '',
                'track_count': p.num_tracks,
                'tidal_url': p.url if hasattr(p, 'url') else '',
            })
        
        return jsonify(playlists)
        
    except Exception as e:
        app.logger.error(f'[Tidal] Error for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/tidal/favorites', methods=['GET'])
@jwt_required()
def tidal_favorites():
    """User's Tidal favorite tracks."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.tidal_access_token:
        return jsonify({'error': 'Tidal not linked'}), 400

    try:
        session = tidalapi.Session()
        session.load_oauth_session(
            token_type='Bearer',
            access_token=user.tidal_access_token,
            refresh_token=user.tidal_refresh_token
        )
        
        # Get favorite tracks
        favorites = session.user.favorites.tracks()
        
        tracks = []
        for track in favorites[:25]:  # Limit to 25
            tracks.append({
                'title': track.name,
                'artist': track.artist.name if track.artist else '',
                'album': track.album.name if track.album else '',
                'image_url': track.album.image(320) if track.album and hasattr(track.album, 'image') else '',
                'duration': track.duration,
            })
        
        return jsonify(tracks)
        
    except Exception as e:
        app.logger.error(f'[Tidal] Favorites error for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/tidal/disconnect', methods=['DELETE'])
@jwt_required()
def tidal_disconnect():
    """Unlink Tidal from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.tidal_access_token = ''
    user.tidal_refresh_token = ''
    user.tidal_user_id = ''
    user.tidal_token_expires_at = None
    db.session.commit()
    return jsonify({'message': 'Tidal disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── Qobuz Integration ─────────────────────────────────────────────────────────

@app.route('/api/integrations/qobuz/login', methods=['POST'])
@jwt_required()
def qobuz_login():
    """Login to Qobuz with username and password."""
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Missing credentials'}), 400
        
        if not QOBUZ_APP_ID or not QOBUZ_APP_SECRET:
            return jsonify({'error': 'Qobuz not configured'}), 500
        
        # Authenticate with Qobuz
        auth_response = requests.get(
            'https://www.qobuz.com/api.json/0.2/user/login',
            params={
                'username': username,
                'password': password,
                'app_id': QOBUZ_APP_ID
            },
            timeout=10
        )
        
        if auth_response.status_code != 200:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        auth_data = auth_response.json()
        user_auth_token = auth_data.get('user_auth_token')
        qobuz_user_id = str(auth_data.get('user', {}).get('id', ''))
        
        if not user_auth_token:
            return jsonify({'error': 'Failed to get auth token'}), 400
        
        user.qobuz_user_auth_token = user_auth_token
        user.qobuz_user_id = qobuz_user_id
        user.qobuz_token_expires_at = datetime.utcnow() + timedelta(days=365)
        
        db.session.commit()
        return jsonify({'message': 'Qobuz linked successfully', 'user': user.to_dict(current_user_id)})
        
    except Exception as e:
        app.logger.error(f'Qobuz login error: {str(e)}')
        return jsonify({'error': 'Failed to link Qobuz'}), 503


@app.route('/api/integrations/qobuz/playlists', methods=['GET'])
@jwt_required()
def qobuz_playlists():
    """User's Qobuz playlists."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.qobuz_user_auth_token:
        return jsonify({'error': 'Qobuz not linked'}), 400

    try:
        response = requests.get(
            'https://www.qobuz.com/api.json/0.2/playlist/getUserPlaylists',
            params={
                'user_id': user.qobuz_user_id,
                'app_id': QOBUZ_APP_ID,
                'user_auth_token': user.qobuz_user_auth_token,
                'limit': 20
            },
            timeout=10
        )
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch playlists'}), 400
        
        data = response.json()
        playlists_data = data.get('playlists', {}).get('items', [])
        
        playlists = []
        for p in playlists_data:
            image_urls = p.get('images300', [])
            playlists.append({
                'name': p.get('name', ''),
                'description': p.get('description', ''),
                'image_url': image_urls[0] if image_urls else '',
                'track_count': p.get('tracks_count', 0),
                'qobuz_url': f"https://play.qobuz.com/playlist/{p.get('id', '')}",
            })
        
        return jsonify(playlists)
        
    except Exception as e:
        app.logger.error(f'[Qobuz] Error for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/qobuz/favorites', methods=['GET'])
@jwt_required()
def qobuz_favorites():
    """User's Qobuz favorite tracks."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.qobuz_user_auth_token:
        return jsonify({'error': 'Qobuz not linked'}), 400

    try:
        response = requests.get(
            'https://www.qobuz.com/api.json/0.2/favorite/getUserFavorites',
            params={
                'user_id': user.qobuz_user_id,
                'app_id': QOBUZ_APP_ID,
                'user_auth_token': user.qobuz_user_auth_token,
                'type': 'tracks',
                'limit': 25
            },
            timeout=10
        )
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch favorites'}), 400
        
        data = response.json()
        tracks_data = data.get('tracks', {}).get('items', [])
        
        tracks = []
        for track in tracks_data:
            album = track.get('album', {})
            tracks.append({
                'title': track.get('title', ''),
                'artist': track.get('performer', {}).get('name', ''),
                'album': album.get('title', ''),
                'image_url': album.get('image', {}).get('small', '') or '',
                'duration': track.get('duration', 0),
            })
        
        return jsonify(tracks)
        
    except Exception as e:
        app.logger.error(f'[Qobuz] Favorites error for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/qobuz/disconnect', methods=['DELETE'])
@jwt_required()
def qobuz_disconnect():
    """Unlink Qobuz from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.qobuz_user_auth_token = ''
    user.qobuz_user_id = ''
    user.qobuz_token_expires_at = None
    db.session.commit()
    return jsonify({'message': 'Qobuz disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── Deezer Integration ────────────────────────────────────────────────────────

@app.route('/api/integrations/deezer/callback', methods=['POST'])
@jwt_required()
def deezer_callback():
    """Complete Deezer OAuth flow and store access token."""
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    
    try:
        data = request.get_json()
        code = data.get('code')
        
        if not code:
            return jsonify({'error': 'Missing authorization code'}), 400
        
        if not DEEZER_APP_ID or not DEEZER_APP_SECRET:
            return jsonify({'error': 'Deezer not configured'}), 500
        
        # Exchange code for access token
        import requests
        token_url = 'https://connect.deezer.com/oauth/access_token.php'
        params = {
            'app_id': DEEZER_APP_ID,
            'secret': DEEZER_APP_SECRET,
            'code': code,
            'output': 'json'
        }
        
        response = requests.get(token_url, params=params)
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to exchange code for token'}), 400
        
        # Deezer returns access_token in query string format
        from urllib.parse import parse_qs
        token_data = parse_qs(response.text)
        
        if 'access_token' not in token_data:
            # Try JSON format
            try:
                token_data = response.json()
                access_token = token_data.get('access_token')
            except:
                return jsonify({'error': 'Invalid token response from Deezer'}), 400
        else:
            access_token = token_data['access_token'][0]
        
        if not access_token:
            return jsonify({'error': 'No access token received'}), 400
        
        # Get user info to verify token
        user_info_response = requests.get(
            'https://api.deezer.com/user/me',
            params={'access_token': access_token}
        )
        
        if user_info_response.status_code != 200:
            return jsonify({'error': 'Failed to verify Deezer token'}), 400
        
        user_info = user_info_response.json()
        deezer_user_id = str(user_info.get('id', ''))
        
        # Store tokens
        user.deezer_access_token = access_token
        user.deezer_user_id = deezer_user_id
        # Deezer access tokens don't expire by default, but we'll set a far future date
        user.deezer_token_expires_at = datetime.utcnow() + timedelta(days=3650)
        
        db.session.commit()
        return jsonify({'message': 'Deezer linked successfully', 'user': user.to_dict(current_user_id)})
        
    except Exception as e:
        app.logger.error(f'Deezer callback error: {str(e)}')
        return jsonify({'error': 'Failed to link Deezer'}), 503


@app.route('/api/integrations/deezer/playlists', methods=['GET'])
@jwt_required()
def deezer_playlists():
    """Get user's Deezer playlists."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.deezer_access_token:
        return jsonify({'error': 'Deezer not linked'}), 400

    try:
        import requests
        response = requests.get(
            f'https://api.deezer.com/user/{user.deezer_user_id}/playlists',
            params={'access_token': user.deezer_access_token}
        )
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch playlists'}), 500
        
        data = response.json()
        playlists = []
        
        for p in data.get('data', [])[:20]:  # Limit to 20
            playlists.append({
                'name': p.get('title', ''),
                'description': '',
                'image_url': p.get('picture_medium', ''),
                'track_count': p.get('nb_tracks', 0),
                'deezer_url': p.get('link', ''),
            })
        
        return jsonify(playlists)
        
    except Exception as e:
        app.logger.error(f'[Deezer] Playlists error for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/deezer/favorites', methods=['GET'])
@jwt_required()
def deezer_favorites():
    """Get user's Deezer favorite tracks."""
    user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    if not user.deezer_access_token:
        return jsonify({'error': 'Deezer not linked'}), 400

    try:
        import requests
        response = requests.get(
            f'https://api.deezer.com/user/{user.deezer_user_id}/tracks',
            params={'access_token': user.deezer_access_token}
        )
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch favorites'}), 500
        
        data = response.json()
        tracks = []
        
        for track in data.get('data', [])[:25]:  # Limit to 25
            album = track.get('album', {})
            artist = track.get('artist', {})
            
            tracks.append({
                'title': track.get('title', ''),
                'artist': artist.get('name', ''),
                'album': album.get('title', ''),
                'image_url': album.get('cover_medium', ''),
                'duration': track.get('duration', 0),
                'deezer_url': track.get('link', ''),
            })
        
        return jsonify(tracks)
        
    except Exception as e:
        app.logger.error(f'[Deezer] Favorites error for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrations/deezer/disconnect', methods=['DELETE'])
@jwt_required()
def deezer_disconnect():
    """Unlink Deezer from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.deezer_access_token = ''
    user.deezer_user_id = ''
    user.deezer_token_expires_at = None
    db.session.commit()
    return jsonify({'message': 'Deezer disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── User Routes ───────────────────────────────────────────────────────────────


@app.route('/api/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    return jsonify(user.to_dict(current_user_id=current_user_id))


@app.route('/api/users/search', methods=['GET'])
@jwt_required()
def search_users():
    current_user_id = int(get_jwt_identity())
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])
    users = User.query.filter(
        (User.username.ilike(f'%{q}%')) | (User.display_name.ilike(f'%{q}%'))
    ).limit(20).all()
    return jsonify([u.to_dict(current_user_id=current_user_id) for u in users])


@app.route('/api/users/<int:user_id>/follow', methods=['POST'])
@jwt_required()
def follow_user(user_id):
    current_user_id = int(get_jwt_identity())
    current_user = db.get_or_404(User, current_user_id)
    target_user = db.get_or_404(User, user_id)

    if current_user_id == user_id:
        return jsonify({'error': 'Cannot follow yourself'}), 400

    is_following = current_user.followed.filter(followers.c.followed_id == user_id).count() > 0

    if is_following:
        current_user.followed.remove(target_user)
        action = 'unfollowed'
    else:
        current_user.followed.append(target_user)
        action = 'followed'
        _notify(recipient_id=user_id, actor_id=current_user_id, notif_type='follow')

    db.session.commit()
    return jsonify({'action': action, 'user': target_user.to_dict(current_user_id=current_user_id)})

@app.route('/api/users/<int:user_id>/taste', methods=['GET'])
@jwt_required()
def get_taste_match(user_id):
    current_user_id = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({'match': 100})
    
    me = db.get_or_404(User, current_user_id)
    them = db.get_or_404(User, user_id)
    
    my_genres = set([g.strip().lower() for g in (me.favorite_genres or '').split(',') if g.strip()])
    their_genres = set([g.strip().lower() for g in (them.favorite_genres or '').split(',') if g.strip()])
    
    if not my_genres or not their_genres:
        return jsonify({'match': 0})
        
    overlap = len(my_genres.intersection(their_genres))
    union = len(my_genres.union(their_genres))
    match_pct = int((overlap / union) * 100) if union > 0 else 0
    return jsonify({'match': match_pct})


@app.route('/api/users/<int:user_id>/posts', methods=['GET'])
@jwt_required()
def get_user_posts(user_id):
    current_user_id = int(get_jwt_identity())
    post_type = request.args.get('type')
    page = request.args.get('page', 1, type=int)

    query = Post.query.filter_by(user_id=user_id)
    if post_type:
        query = query.filter_by(post_type=post_type)
    query = query.order_by(Post.created_at.desc())
    posts = query.paginate(page=page, per_page=20, error_out=False)

    return jsonify({
        'posts': [p.to_dict(current_user_id=current_user_id) for p in posts.items],
        'total': posts.total,
        'pages': posts.pages,
        'current_page': page
    })


@app.route('/api/users/<int:user_id>/followers', methods=['GET'])
@jwt_required()
def get_followers(user_id):
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    return jsonify([u.to_dict(current_user_id=current_user_id) for u in user.followers_list])


@app.route('/api/users/<int:user_id>/following', methods=['GET'])
@jwt_required()
def get_following(user_id):
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    return jsonify([u.to_dict(current_user_id=current_user_id) for u in user.followed])


@app.route('/api/users/me', methods=['PUT'])
@jwt_required()
def update_profile():
    try:
        current_user_id = int(get_jwt_identity())
        user = db.get_or_404(User, current_user_id)
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        if 'display_name' in data:
            user.display_name = sanitize_string(data['display_name'], MAX_DISPLAY_NAME_LEN)
        if 'bio' in data:
            user.bio = sanitize_string(data['bio'], MAX_BIO_LEN)
        if 'avatar_url' in data:
            avatar_data = data['avatar_url']
            # Handle base64 image upload
            if avatar_data and avatar_data.startswith('data:image'):
                try:
                    import base64
                    import uuid
                    # Extract base64 data
                    header, encoded = avatar_data.split(',', 1)
                    image_data = base64.b64decode(encoded)
                    # Generate unique filename
                    ext = 'jpg' if 'jpeg' in header else 'png'
                    filename = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}.{ext}"
                    # Save to uploads directory
                    uploads_dir = os.path.join(_BASE_DIR, 'uploads', 'avatars')
                    os.makedirs(uploads_dir, exist_ok=True)
                    filepath = os.path.join(uploads_dir, filename)
                    with open(filepath, 'wb') as f:
                        f.write(image_data)
                    # Store relative URL
                    user.avatar_url = f"/uploads/avatars/{filename}"
                except Exception as img_error:
                    app.logger.error(f'Image upload error: {str(img_error)}')
                    return jsonify({'error': 'Failed to process image'}), 400
            elif avatar_data:
                # Regular URL
                avatar_url = sanitize_string(avatar_data, MAX_URL_LEN)
                if not validate_url(avatar_url):
                    return jsonify({'error': 'Invalid avatar URL'}), 400
                user.avatar_url = avatar_url
            else:
                user.avatar_url = None
        if 'favorite_genres' in data:
            user.favorite_genres = sanitize_string(data['favorite_genres'], MAX_GENRES_LEN)

        db.session.commit()
        return jsonify(user.to_dict(current_user_id=current_user_id))

    except Exception as e:
        app.logger.error(f'Profile update error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile'}), 500


# ─── Post Routes ───────────────────────────────────────────────────────────────

@app.route('/api/posts', methods=['POST'])
@jwt_required()
def create_post():
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        track_title = sanitize_string(data.get('track_title', ''), 200)
        artist = sanitize_string(data.get('artist', ''), 200)

        if not track_title or not artist:
            return jsonify({'error': 'track_title and artist are required'}), 400

        album_art_url = sanitize_string(data.get('album_art_url', ''), MAX_URL_LEN)
        preview_url = sanitize_string(data.get('preview_url', ''), MAX_URL_LEN)
        spotify_url = sanitize_string(data.get('spotify_url', ''), MAX_URL_LEN)

        # Validate URLs
        for url in [album_art_url, preview_url, spotify_url]:
            if url and not validate_url(url):
                return jsonify({'error': 'Invalid URL provided'}), 400

        post = Post(
            user_id=current_user_id,
            track_title=track_title,
            artist=artist,
            album=sanitize_string(data.get('album', ''), 200),
            album_art_url=album_art_url,
            caption=sanitize_string(data.get('caption', ''), MAX_CAPTION_LEN),
            post_type=data.get('post_type', 'loved'),
            preview_url=preview_url,
            spotify_url=spotify_url,
            genre=sanitize_string(data.get('genre', ''), 100),
            listened_at=datetime.now(timezone.utc)
        )
        db.session.add(post)

        db.session.commit()
        return jsonify(post.to_dict(current_user_id=current_user_id)), 201

    except Exception as e:
        app.logger.error(f'Post creation error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to create post'}), 500


@app.route('/api/feed', methods=['GET'])
@jwt_required()
def get_feed():
    current_user_id = int(get_jwt_identity())
    current_user = db.get_or_404(User, current_user_id)
    page = request.args.get('page', 1, type=int)

    followed_ids = [u.id for u in current_user.followed]
    followed_ids.append(current_user_id)  # include own posts

    posts = Post.query.filter(Post.user_id.in_(followed_ids)) \
        .order_by(Post.created_at.desc()) \
        .paginate(page=page, per_page=20, error_out=False)

    return jsonify({
        'posts': [p.to_dict(current_user_id=current_user_id) for p in posts.items],
        'total': posts.total,
        'pages': posts.pages,
        'current_page': page
    })


@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
@jwt_required()
def like_post(post_id):
    current_user_id = int(get_jwt_identity())
    user = db.get_or_404(User, current_user_id)
    post = db.get_or_404(Post, post_id)

    is_liked = post.liked_by.filter(track_likes.c.user_id == current_user_id).count() > 0
    if is_liked:
        post.liked_by.remove(user)
        action = 'unliked'
    else:
        post.liked_by.append(user)
        action = 'liked'
        _notify(recipient_id=post.user_id, actor_id=current_user_id, notif_type='like', post_id=post.id)

    db.session.commit()
    return jsonify({'action': action, 'likes_count': post.liked_by.count(), 'is_liked': not is_liked})


@app.route('/api/posts/<int:post_id>/comments', methods=['GET', 'POST'])
@jwt_required()
def post_comments(post_id):
    try:
        current_user_id = int(get_jwt_identity())
        post = db.get_or_404(Post, post_id)

        if request.method == 'GET':
            comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at.asc()).all()
            return jsonify([c.to_dict() for c in comments])

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        text = sanitize_string(data.get('text', ''), MAX_COMMENT_LEN)
        if not text:
            return jsonify({'error': 'Comment text is required'}), 400

        parent_id = data.get('parent_id')
        if parent_id is not None:
            try:
                parent_id = int(parent_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'parent_id must be a valid integer'}), 400

            parent_comment = Comment.query.filter_by(id=parent_id, post_id=post_id).first()
            if not parent_comment:
                return jsonify({'error': 'Parent comment not found'}), 404

        comment = Comment(post_id=post_id, user_id=current_user_id, text=text, parent_id=parent_id)
        db.session.add(comment)
        
        _notify(recipient_id=post.user_id, actor_id=current_user_id, notif_type='comment', post_id=post.id)
        
        db.session.commit()
        return jsonify(comment.to_dict()), 201

    except Exception as e:
        app.logger.error(f'Comment error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to process comment'}), 500


@app.route('/api/posts/<int:post_id>/pin-comment/<int:comment_id>', methods=['POST'])
@jwt_required()
def pin_comment(post_id, comment_id):
    current_user_id = int(get_jwt_identity())
    post = db.get_or_404(Post, post_id)

    if post.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    comment = Comment.query.filter_by(id=comment_id, post_id=post_id).first()
    if not comment:
        return jsonify({'error': 'Comment not found for this post'}), 404

    post.pinned_comment_id = comment_id
    db.session.commit()
    return jsonify({'message': 'Pinned comment updated', 'pinned_comment_id': comment_id}), 200


@app.route('/api/posts/<int:post_id>/reactions', methods=['GET', 'POST'])
@jwt_required()
def post_reactions(post_id):
    current_user_id = int(get_jwt_identity())
    post = db.get_or_404(Post, post_id)

    if request.method == 'GET':
        counts = db.session.query(
            PostReaction.reaction_type,
            db.func.count(PostReaction.id)
        ).filter_by(post_id=post.id).group_by(PostReaction.reaction_type).all()

        mine = PostReaction.query.filter_by(post_id=post.id, user_id=current_user_id).all()
        return jsonify({
            'counts': {r_type: int(count) for r_type, count in counts},
            'my_reactions': [r.reaction_type for r in mine]
        })

    data = request.get_json() or {}
    reaction_type = (data.get('reaction_type') or '').strip().lower()
    if reaction_type not in VALID_REACTION_TYPES:
        return jsonify({'error': f'Invalid reaction_type. Allowed: {sorted(VALID_REACTION_TYPES)}'}), 400

    exists = PostReaction.query.filter_by(
        post_id=post.id,
        user_id=current_user_id,
        reaction_type=reaction_type
    ).first()
    if exists:
        return jsonify({'message': 'Reaction already exists'}), 200

    db.session.add(PostReaction(post_id=post.id, user_id=current_user_id, reaction_type=reaction_type))
    db.session.commit()
    return jsonify({'message': 'Reaction added', 'reaction_type': reaction_type}), 201


@app.route('/api/posts/<int:post_id>/reactions/<string:reaction_type>', methods=['DELETE'])
@jwt_required()
def delete_post_reaction(post_id, reaction_type):
    current_user_id = int(get_jwt_identity())
    db.get_or_404(Post, post_id)

    reaction_type = (reaction_type or '').strip().lower()
    if reaction_type not in VALID_REACTION_TYPES:
        return jsonify({'error': f'Invalid reaction_type. Allowed: {sorted(VALID_REACTION_TYPES)}'}), 400

    reaction = PostReaction.query.filter_by(
        post_id=post_id,
        user_id=current_user_id,
        reaction_type=reaction_type
    ).first()
    if not reaction:
        return jsonify({'error': 'Reaction not found'}), 404

    db.session.delete(reaction)
    db.session.commit()
    return jsonify({'message': 'Reaction removed'}), 200


@app.route('/api/listen-later', methods=['GET', 'POST'])
@jwt_required()
def listen_later():
    current_user_id = int(get_jwt_identity())

    if request.method == 'GET':
        items = ListenLaterItem.query.filter_by(user_id=current_user_id).order_by(ListenLaterItem.added_at.desc()).all()
        return jsonify([item.to_dict() for item in items]), 200

    data = request.get_json() or {}
    track_title = sanitize_string(data.get('track_title', ''), 200)
    artist = sanitize_string(data.get('artist', ''), 200)
    if not track_title or not artist:
        return jsonify({'error': 'track_title and artist are required'}), 400

    source_url = sanitize_string(data.get('source_url', ''), MAX_URL_LEN)
    album_art_url = sanitize_string(data.get('album_art_url', ''), MAX_URL_LEN)
    if source_url and not validate_url(source_url):
        return jsonify({'error': 'Invalid source_url'}), 400
    if album_art_url and not validate_url(album_art_url):
        return jsonify({'error': 'Invalid album_art_url'}), 400

    item = ListenLaterItem(
        user_id=current_user_id,
        track_title=track_title,
        artist=artist,
        album=sanitize_string(data.get('album', ''), 200),
        album_art_url=album_art_url,
        source_service=sanitize_string(data.get('source_service', ''), 50),
        source_url=source_url,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@app.route('/api/listen-later/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_listen_later(item_id):
    current_user_id = int(get_jwt_identity())
    item = ListenLaterItem.query.filter_by(id=item_id, user_id=current_user_id).first()
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Item removed'}), 200


@app.route('/api/notifications/preferences', methods=['GET', 'PUT'])
@jwt_required()
def notification_preferences():
    current_user_id = int(get_jwt_identity())
    prefs = _get_or_create_notification_preferences(current_user_id)

    if request.method == 'GET':
        return jsonify(prefs.to_dict()), 200

    data = request.get_json() or {}
    for key in ('notify_new_post', 'notify_now_playing', 'notify_collection_add', 'notify_mentions', 'notify_replies'):
        if key in data:
            setattr(prefs, key, bool(data[key]))

    db.session.commit()
    return jsonify(prefs.to_dict()), 200


@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    current_user_id = int(get_jwt_identity())
    post = db.get_or_404(Post, post_id)

    if post.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(post)
    db.session.commit()
    return jsonify({'message': 'Post deleted'})


@app.route('/api/explore', methods=['GET'])
@jwt_required()
def explore():
    try:
        current_user_id = int(get_jwt_identity())
        page = request.args.get('page', 1, type=int)
        genre = request.args.get('genre', '')

        # Validate pagination
        if page < 1:
            page = 1

        query = db.session.query(Post)
        if genre:
            # Sanitize genre input to prevent SQL injection
            genre_safe = sanitize_string(genre, 100)
            if genre_safe:
                query = query.filter(Post.genre.ilike(f'%{genre_safe}%'))
            
        # Trending logic: limit to posts from last 7 days, order by like count
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        query = query.filter(Post.created_at >= seven_days_ago)
        
        # Outer join with likes so we can count them
        query = query.outerjoin(track_likes).group_by(Post.id)
        query = query.order_by(db.func.count(track_likes.c.user_id).desc(), Post.created_at.desc())
        
        posts = query.paginate(page=page, per_page=30, error_out=False)

        return jsonify({
            'posts': [p.to_dict(current_user_id=current_user_id) for p in posts.items],
            'total': posts.total,
            'pages': posts.pages,
        })

    except Exception as e:
        app.logger.error(f'Explore error: {str(e)}')
        return jsonify({'error': 'Failed to load explore feed'}), 500

# ─── Notifications Routes ──────────────────────────────────────────────────────

@app.route('/api/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    current_user_id = int(get_jwt_identity())
    notifs = Notification.query.filter_by(recipient_id=current_user_id).order_by(Notification.created_at.desc()).limit(50).all()
    
    # Also return the unread count
    unread_count = Notification.query.filter_by(recipient_id=current_user_id, is_read=False).count()
    return jsonify({
        'notifications': [n.to_dict() for n in notifs],
        'unread_count': unread_count
    })

@app.route('/api/notifications/<int:notif_id>/read', methods=['PUT'])
@jwt_required()
def mark_notification_read(notif_id):
    current_user_id = int(get_jwt_identity())
    n = db.get_or_404(Notification, notif_id)
    if n.recipient_id == current_user_id:
        n.is_read = True
        db.session.commit()
    return jsonify({'success': True})
    
@app.route('/api/notifications/read_all', methods=['PUT'])
@jwt_required()
def mark_all_notifications_read():
    current_user_id = int(get_jwt_identity())
    Notification.query.filter_by(recipient_id=current_user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})


# ─── Collection Routes ─────────────────────────────────────────────────────────

@app.route('/api/collection', methods=['GET'])
@jwt_required()
def get_collection():
    """Get user's physical media collection."""
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            user_id = int(get_jwt_identity())

        media_type = request.args.get('type')  # Filter by media type (vinyl, cd, etc.)

        all_user_items = CollectionItem.query.filter_by(user_id=user_id).all()
        
        # Calculate stats
        vinyl_count = sum(1 for i in all_user_items if i.media_type == 'vinyl')
        cd_count = sum(1 for i in all_user_items if i.media_type == 'cd')
        cassette_count = sum(1 for i in all_user_items if i.media_type == 'cassette')
        
        artist_counts = {}
        for item in all_user_items:
            if item.artist:
                artist_counts[item.artist] = artist_counts.get(item.artist, 0) + 1
        
        top_artist: str | None = max(artist_counts.items(), key=lambda x: x[1])[0] if artist_counts else None

        stats = {
            'total': len(all_user_items),
            'vinyl_count': vinyl_count,
            'cd_count': cd_count,
            'cassette_count': cassette_count,
            'top_artist': top_artist
        }

        query = CollectionItem.query.filter_by(user_id=user_id)
        if media_type:
            query = query.filter_by(media_type=media_type)

        items = query.order_by(CollectionItem.created_at.desc()).all()

        return jsonify({
            'items': [item.to_dict() for item in items],
            'total': len(items),
            'stats': stats
        })

    except Exception as e:
        app.logger.error(f'Collection fetch error: {str(e)}')
        return jsonify({'error': 'Failed to load collection'}), 500


@app.route('/api/collection', methods=['POST'])
@jwt_required()
def add_to_collection():
    """Add item to user's collection."""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        album_title = sanitize_string(data.get('album_title', ''), 200)
        artist = sanitize_string(data.get('artist', ''), 200)
        
        if not album_title or not artist:
            return jsonify({'error': 'Album title and artist are required'}), 400
        
        media_type = data.get('media_type', 'vinyl')
        if media_type not in ['vinyl', 'cd', 'cassette', 'digital']:
            return jsonify({'error': 'Invalid media type'}), 400
        
        album_art_url = sanitize_string(data.get('album_art_url', ''), MAX_URL_LEN)
        if album_art_url and not validate_url(album_art_url):
            return jsonify({'error': 'Invalid album art URL'}), 400
        
        # Parse purchase date if provided
        purchase_date = None
        if data.get('purchase_date'):
            try:
                purchase_date = datetime.fromisoformat(data['purchase_date'].replace('Z', '+00:00')).date()
            except:
                pass
        
        item = CollectionItem(
            user_id=current_user_id,
            media_type=media_type,
            album_title=album_title,
            artist=artist,
            album_art_url=album_art_url,
            release_year=data.get('release_year'),
            notes=sanitize_string(data.get('notes', ''), MAX_CAPTION_LEN),
            condition=sanitize_string(data.get('condition', ''), 50),
            purchase_date=purchase_date
        )
        
        db.session.add(item)
        db.session.commit()
        
        return jsonify(item.to_dict()), 201
    
    except Exception as e:
        app.logger.error(f'Add to collection error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to add item to collection'}), 500


@app.route('/api/collection/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_collection(item_id):
    """Remove item from user's collection."""
    try:
        current_user_id = int(get_jwt_identity())
        item = db.get_or_404(CollectionItem, item_id)
        
        if item.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(item)
        db.session.commit()
        
        return jsonify({'message': 'Item removed from collection'})
    
    except Exception as e:
        app.logger.error(f'Remove from collection error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to remove item'}), 500


@app.route('/api/collection/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_collection_item(item_id):
    """Update collection item details."""
    try:
        current_user_id = int(get_jwt_identity())
        item = db.get_or_404(CollectionItem, item_id)
        
        if item.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        if 'notes' in data:
            item.notes = sanitize_string(data['notes'], MAX_CAPTION_LEN)
        if 'condition' in data:
            item.condition = sanitize_string(data['condition'], 50)
        if 'album_art_url' in data:
            url = sanitize_string(data['album_art_url'], MAX_URL_LEN)
            if url and not validate_url(url):
                return jsonify({'error': 'Invalid URL'}), 400
            item.album_art_url = url
        if 'media_type' in data:
            # Validate media type
            valid_types = ['vinyl', 'cd', 'cassette', 'digital']
            media_type = data['media_type']
            if media_type not in valid_types:
                return jsonify({'error': 'Invalid media type'}), 400
            item.media_type = media_type
        if 'release_year' in data:
            year = data['release_year']
            if year is not None:
                if not isinstance(year, int) or year < 1900 or year > 2100:
                    return jsonify({'error': 'Invalid release year'}), 400
            item.release_year = year
        if 'purchase_date' in data:
            date_str = data['purchase_date']
            if date_str:
                try:
                    item.purchase_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
                except (ValueError, AttributeError):
                    return jsonify({'error': 'Invalid purchase date format'}), 400
            else:
                item.purchase_date = None
        
        db.session.flush()
        db.session.commit()
        return jsonify(item.to_dict())
    
    except Exception as e:
        app.logger.error(f'Update collection error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Failed to update item'}), 500


# ─── Activity Feed Routes ──────────────────────────────────────────────────────

@app.route('/api/activity', methods=['GET'])
@jwt_required()
def get_activity_feed():
    """Real-time activity feed showing what friends are listening to."""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = db.get_or_404(User, current_user_id)
        page = request.args.get('page', 1, type=int)
        
        # Get IDs of people the user follows
        followed_ids = [u.id for u in current_user.followed]
        followed_ids.append(current_user_id)  # Include own activity
        
        # Get recent posts with different activity types prioritized
        # Show now_playing posts first (real-time), then other types
        posts = Post.query.filter(Post.user_id.in_(followed_ids)).order_by(
                db.case(
                    (Post.post_type == 'now_playing', 0),
                    (Post.post_type == 'loved', 1),
                    else_=2
                ),
                Post.created_at.desc()
            ).paginate(page=page, per_page=30, error_out=False)
        
        return jsonify({
            'activities': [p.to_dict(current_user_id=current_user_id) for p in posts.items],
            'total': posts.total,
            'pages': posts.pages,
        })
    
    except Exception as e:
        app.logger.error(f'Activity feed error: {str(e)}')
        return jsonify({'error': 'Failed to load activity feed'}), 500


# ─── Music Search (iTunes API proxy) ──────────────────────────────────────────
import urllib.request
import json as json_lib

@app.route('/api/music/search', methods=['GET'])
@jwt_required()
def search_music():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])
    try:
        encoded = urllib.parse.quote(q)
        url = f'https://itunes.apple.com/search?term={encoded}&media=music&limit=15&entity=song'
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json_lib.loads(response.read())
        results = []
        for item in data.get('results', []):
            results.append({
                'track_title': item.get('trackName', ''),
                'artist': item.get('artistName', ''),
                'album': item.get('collectionName', ''),
                'album_art_url': item.get('artworkUrl100', '').replace('100x100', '500x500'),
                'preview_url': item.get('previewUrl', ''),
                'genre': item.get('primaryGenreName', ''),
                'track_id': item.get('trackId'),
            })
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/music/search_albums', methods=['GET'])
@jwt_required()
def search_albums():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])
    try:
        encoded = urllib.parse.quote(q)
        url = f'https://itunes.apple.com/search?term={encoded}&media=music&limit=15&entity=album'
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json_lib.loads(response.read())
        results = []
        for item in data.get('results', []):
            results.append({
                'track_title': '',
                'artist': item.get('artistName', ''),
                'album': item.get('collectionName', ''),
                'album_art_url': item.get('artworkUrl100', '').replace('100x100', '500x500'),
                'preview_url': '',
                'genre': item.get('primaryGenreName', ''),
                'track_id': item.get('collectionId'),
            })
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/music/barcode/<barcode>', methods=['GET'])
@jwt_required()
def search_by_barcode(barcode):
    """Search for album by barcode using MusicBrainz API."""
    try:
        # MusicBrainz API - search by barcode
        url = f'https://musicbrainz.org/ws/2/release/?query=barcode:{barcode}&fmt=json'
        headers = {'User-Agent': 'MusicShareApp/1.0'}
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json_lib.loads(response.read())
        
        releases = data.get('releases', [])
        if not releases:
            return jsonify({'error': 'No album found for this barcode'}), 404
        
        # Get the first release (most relevant)
        release = releases[0]
        
        # Try to get cover art from Cover Art Archive
        album_art_url = None
        release_id = release.get('id')
        if release_id:
            try:
                art_url = f'https://coverartarchive.org/release/{release_id}/front-250'
                art_req = urllib.request.Request(art_url, headers=headers)
                with urllib.request.urlopen(art_req, timeout=5) as art_response:
                    if art_response.status == 200:
                        album_art_url = art_url
            except:
                pass  # Cover art not available
        
        # Extract artist names
        artists = release.get('artist-credit', [])
        artist_name = ', '.join([a.get('name', '') for a in artists if isinstance(a, dict) and 'name' in a])
        
        result = {
            'album': release.get('title', ''),
            'artist': artist_name,
            'album_art_url': album_art_url,
            'barcode': barcode,
            'release_date': release.get('date', ''),
            'country': release.get('country', ''),
            'label': release.get('label-info', [{}])[0].get('label', {}).get('name', '') if release.get('label-info') else '',
        }
        
        return jsonify(result)
    
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return jsonify({'error': 'No album found for this barcode'}), 404
        return jsonify({'error': f'MusicBrainz API error: {e.code}'}), 500
    except Exception as e:
        app.logger.error(f'Barcode lookup error: {str(e)}')
        return jsonify({'error': 'Failed to lookup barcode'}), 500


import urllib.parse

# ─── Static Files ──────────────────────────────────────────────────────────────

@app.route('/uploads/<path:subpath>/<filename>')
def serve_upload(subpath, filename):
    """Serve uploaded files (avatars, etc.)"""
    from flask import send_from_directory
    uploads_dir = os.path.join(_BASE_DIR, 'uploads', subpath)
    return send_from_directory(uploads_dir, filename)


# --- Background Sync --------------------------------------------------------
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

def sync_spotify_history():
    '''Runs periodically to fetch and sync users' Spotify history so they don't have to keep the app open.'''
    with app.app_context():
        # Get users with linked spotify
        users = User.query.filter(User.spotify_refresh_token.isnot(None), User.spotify_refresh_token != '').all()
        for user in users:
            try:
                # 1. Sync History
                data, err = _spotify_get(user, 'me/player/recently-played?limit=20')
                if not err and data:
                    items = data.get('items', [])
                    if items:
                        added_count = 0
                        # iterate from oldest to newest correctly
                        for item in reversed(items):
                            t = item.get('track', {})
                            played_at_str = item.get('played_at')
                            if not played_at_str or not t:
                                continue

                            # parse played_at: e.g. "2023-11-20T14:42:15.000Z"
                            try:
                                played_at_dt = datetime.fromisoformat(played_at_str.replace('Z', '+00:00'))
                            except Exception:
                                continue

                            # Check if post already exists
                            existing = Post.query.filter_by(
                                user_id=user.id,
                                post_type='history',
                                listened_at=played_at_dt
                            ).first()

                            if not existing:
                                post = Post(
                                    user_id=user.id,
                                    track_title=(t.get('name') or '')[:200],
                                    artist=', '.join((a.get('name') or '') for a in (t.get('artists') or []))[:200],
                                    album=((t.get('album') or {}).get('name') or '')[:200],
                                    album_art_url=(((t.get('album') or {}).get('images') or [{}])[0].get('url') or '')[:500],
                                    caption='',
                                    post_type='history',
                                    preview_url=(t.get('preview_url') or '')[:500],
                                    spotify_url=((t.get('external_urls') or {}).get('spotify') or '')[:500],
                                    listened_at=played_at_dt,
                                    created_at=played_at_dt
                                )
                                db.session.add(post)
                                added_count += 1

                        if added_count > 0:
                            db.session.commit()
                            app.logger.info(f"[Spotify Sync] Synced {added_count} new historical tracks for user {user.id}")

                # 2. Sync Currently Playing (Now Playing integration)
                live_data, live_err = _spotify_get(user, 'me/player/currently-playing')
                
                # Find the existing now_playing post
                now_playing_post = Post.query.filter_by(
                    user_id=user.id,
                    post_type='now_playing'
                ).first()
                
                is_playing = live_data and live_data.get('is_playing') == True
                
                if not live_err and is_playing and live_data.get('item'):
                    t = live_data.get('item', {})
                    if t.get('type') == 'track':
                        # They are playing something right now
                        track_title=(t.get('name') or '')[:200]
                        artist=', '.join((a.get('name') or '') for a in (t.get('artists') or []))[:200]
                        album=((t.get('album') or {}).get('name') or '')[:200]
                        album_art_url=(((t.get('album') or {}).get('images') or [{}])[0].get('url') or '')[:500]
                        
                        if now_playing_post:
                            # Update if changed
                            if now_playing_post.track_title != track_title or now_playing_post.artist != artist:
                                now_playing_post.track_title = track_title
                                now_playing_post.artist = artist
                                now_playing_post.album = album
                                now_playing_post.album_art_url = album_art_url
                                now_playing_post.preview_url = (t.get('preview_url') or '')[:500]
                                now_playing_post.spotify_url = ((t.get('external_urls') or {}).get('spotify') or '')[:500]
                                now_playing_post.created_at = datetime.utcnow()
                                db.session.commit()
                        else:
                            # Create new now_playing post
                            post = Post(
                                user_id=user.id,
                                track_title=track_title,
                                artist=artist,
                                album=album,
                                album_art_url=album_art_url,
                                caption='Listening Now',
                                post_type='now_playing',
                                preview_url=(t.get('preview_url') or '')[:500],
                                spotify_url=((t.get('external_urls') or {}).get('spotify') or '')[:500],
                            )
                            db.session.add(post)
                            db.session.commit()
                else:
                    # Nothing is playing or player paused, remove the now playing post
                    if now_playing_post:
                        db.session.delete(now_playing_post)
                        db.session.commit()
            except Exception as e:
                db.session.rollback()
                import traceback
                app.logger.error(f"[Spotify Sync] Error syncing history for user {user.id}: {traceback.format_exc()}")

scheduler = BackgroundScheduler()
scheduler.add_job(
    func=sync_spotify_history, 
    trigger=IntervalTrigger(minutes=1), 
    id='spotify_history_sync', 
    replace_existing=True,
    next_run_time=datetime.utcnow()
)
scheduler.start()


if __name__ == '__main__':
    with app.app_context():
        os.makedirs(os.path.join(_BASE_DIR, 'instance'), exist_ok=True)
        db.create_all()

    # Use environment variable for debug mode (default to False for security)
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 'yes')
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
