from flask import Flask, request, jsonify, redirect, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone
from sqlalchemy import inspect, text, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
import os
import re
import json
import time
import unicodedata
import hmac
import hashlib
import threading
import smtplib
import ssl
import random
import string
from difflib import SequenceMatcher
from email.message import EmailMessage
import jwt as pyjwt
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# CORS Configuration
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

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

# ─── Security: require SECRET_KEY and JWT_SECRET_KEY to be set explicitly ──────
_secret_key = os.getenv('SECRET_KEY')
_jwt_secret_key = os.getenv('JWT_SECRET_KEY')

_INSECURE_DEFAULTS = {'dev-secret-key-change-in-production', 'dev-secret-change-in-production', ''}

if not _secret_key or _secret_key in _INSECURE_DEFAULTS:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set or is using an insecure default. "
        "Set a strong, random SECRET_KEY before starting the server."
    )
if not _jwt_secret_key or _jwt_secret_key in _INSECURE_DEFAULTS:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set or is using an insecure default. "
        "Set a strong, random JWT_SECRET_KEY before starting the server."
    )

app.config['SECRET_KEY'] = _secret_key
app.config['JWT_SECRET_KEY'] = _jwt_secret_key
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)  # Reduced from 30 days
app.config['EXPOSE_ERROR_DETAILS'] = os.getenv('EXPOSE_ERROR_DETAILS', 'false').lower() in ('true', '1', 'yes')
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "pool_recycle": 280,
    "pool_pre_ping": True,
}

db = SQLAlchemy(app)
jwt = JWTManager(app)

# ─── Clerk config (optional subsystem — misconfiguration should 503 the ────────
# clerk-exchange route only, not crash the whole app like SECRET_KEY does) ──────
CLERK_SECRET_KEY = os.getenv('CLERK_SECRET_KEY')
CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL')
_clerk_jwks_client = pyjwt.PyJWKClient(CLERK_JWKS_URL) if CLERK_JWKS_URL else None


class ClerkVerificationError(Exception):
    pass


def _verify_clerk_token(token: str) -> dict:
    if not _clerk_jwks_client:
        raise ClerkVerificationError('Clerk is not configured on this server')
    try:
        signing_key = _clerk_jwks_client.get_signing_key_from_jwt(token)
        return pyjwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            options={'require': ['exp', 'iat', 'sub']},
        )
    except pyjwt.PyJWTError as e:
        raise ClerkVerificationError(str(e))


def _fetch_clerk_user(clerk_user_id: str) -> dict:
    if not CLERK_SECRET_KEY:
        raise ClerkVerificationError('Clerk is not configured on this server')
    resp = requests.get(
        f'https://api.clerk.com/v1/users/{clerk_user_id}',
        headers={'Authorization': f'Bearer {CLERK_SECRET_KEY}'},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _error_payload(message: str, detail: str | None = None) -> dict:
    payload = {'error': message}
    if app.config.get('EXPOSE_ERROR_DETAILS') and detail:
        payload['detail'] = detail
    return payload

# ─── Admin static handler and other helpers ───────────────────────────────────
@app.route('/admin', methods=['GET'])
@app.route('/admin/', methods=['GET'])
def serve_admin():
    """Serve the standalone admin dashboard."""
    admin_dir = os.path.join(os.path.dirname(_BASE_DIR), 'admin')
    return send_from_directory(admin_dir, 'index.html')

# ─── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[],          # No global limit; we apply per-route limits
    storage_uri=os.getenv('RATELIMIT_STORAGE_URI', 'memory://'),
)

# ─── Global JSON Error Handlers ───────────────────────────────────────────────
# Ensure the API always responds with JSON, never with Flask's default HTML pages.

@app.errorhandler(404)
def not_found(e):
    return jsonify(_error_payload('Not found', str(e))), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def internal_error(e):
    app.logger.error(f'[500] Unhandled server error: {str(e)}')
    db.session.rollback()
    return jsonify(_error_payload('Internal server error', str(e))), 500

@app.errorhandler(Exception)
def unhandled_exception(e):
    app.logger.error(f'[Unhandled Exception] {type(e).__name__}: {str(e)}')
    db.session.rollback()
    return jsonify(_error_payload('Unexpected server error', str(e))), 500

from functools import wraps

def admin_required():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = db.session.get(User, int(user_id))
            if not user or not user.is_admin:
                return jsonify({'error': 'Admin access required'}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper


# ─── OAuth CSRF-state helpers ──────────────────────────────────────────────────
_STATE_SEP = ':'
_STATE_EXPIRY_SECONDS = 600  # 10 minutes

def _generate_oauth_state(user_id: int) -> str:
    """Return a signed state token encoding user_id + timestamp.
    Format: '<user_id>:<timestamp>:<hmac_hex>'
    The HMAC prevents tampering – an attacker cannot forge a valid state
    even if they know the user_id, because they don't know SECRET_KEY.
    """
    ts = int(time.time())
    payload = f"{user_id}{_STATE_SEP}{ts}"
    sig = hmac.new(
        app.config['SECRET_KEY'].encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}{_STATE_SEP}{sig}"

def _verify_oauth_state(state: str) -> int | None:
    """Verify a signed OAuth state token.  Returns user_id on success, None on failure."""
    try:
        parts = state.split(_STATE_SEP)
        if len(parts) != 3:
            return None
        user_id_str, ts_str, received_sig = parts
        payload = f"{user_id_str}{_STATE_SEP}{ts_str}"
        expected_sig = hmac.new(
            app.config['SECRET_KEY'].encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(received_sig, expected_sig):
            return None
        # Check expiry
        if int(time.time()) - int(ts_str) > _STATE_EXPIRY_SECONDS:
            return None
        return int(user_id_str)
    except Exception:
        return None

def _ensure_phase0_schema():
    """
    Idempotent DDL migrations for columns added after initial deploy.
    Uses SQLAlchemy inspector to be database-agnostic (works on SQLite and Postgres).
    """
    from sqlalchemy import text, inspect
    import time as _t

    # 1. Ensure all tables exist first.
    #    Retry to tolerate a cold-start database: managed Postgres (e.g. Neon free tier)
    #    auto-suspends when idle, and the very first connection at deploy time can time
    #    out while it wakes. Without a retry, that one failure would leave the app running
    #    with NO tables (every query then fails with 'relation "user" does not exist'),
    #    because this is the only place tables get created.
    _create_err = None
    for _attempt in range(1, 6):
        try:
            db.create_all()
            _create_err = None
            break
        except Exception as e:
            _create_err = e
            app.logger.warning(f'create_all attempt {_attempt}/5 failed (DB may be waking up): {e}')
            _t.sleep(min(3 * _attempt, 15))
    if _create_err is not None:
        app.logger.error(f'CRITICAL: could not create tables after retries — the app will 500 on '
                         f'every DB query until this is resolved. Last error: {_create_err}')
        return

    # 2. Check and add missing columns manually for older DBs
    inspector = inspect(db.engine)
    
    # Note: 'user' table name might be quoted in some dialects, but inspector expects the raw name
    user_cols = {c['name'] for c in inspector.get_columns('user')}
    post_cols = {c['name'] for c in inspector.get_columns('post')}
    comment_cols = {c['name'] for c in inspector.get_columns('comment')}
    
    statements = []
    
    # User additions
    # Note: Using double quotes for table name "user" because it is a reserved keyword in Postgres
    if 'last_synced_at' not in user_cols:
        statements.append('ALTER TABLE "user" ADD COLUMN last_synced_at TIMESTAMP')
    if 'kawarp_config' not in user_cols:
        statements.append('ALTER TABLE "user" ADD COLUMN kawarp_config VARCHAR(1000)')
    if 'is_admin' not in user_cols:
        statements.append('ALTER TABLE "user" ADD COLUMN is_admin BOOLEAN DEFAULT FALSE')
    if 'is_banned' not in user_cols:
        statements.append('ALTER TABLE "user" ADD COLUMN is_banned BOOLEAN DEFAULT FALSE')
    if 'clerk_user_id' not in user_cols:
        statements.append('ALTER TABLE "user" ADD COLUMN clerk_user_id VARCHAR(64)')
    # Nullable-safe unique index (multiple NULLs allowed) — works on SQLite and Postgres.
    statements.append('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_clerk_user_id ON "user" (clerk_user_id)')
    # Clerk-authenticated users have no local password/email captured at signup time.
    # SQLite can't drop a NOT NULL constraint without a full table rebuild, so this is
    # Postgres-only; local SQLite dev DBs are disposable and can be recreated instead.
    if db.engine.dialect.name == 'postgresql':
        statements.append('ALTER TABLE "user" ALTER COLUMN password_hash DROP NOT NULL')
        statements.append('ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL')

    # Post additions
    if 'pinned_comment_id' not in post_cols:
        statements.append('ALTER TABLE post ADD COLUMN pinned_comment_id INTEGER')
        
    # Comment additions
    if 'parent_id' not in comment_cols:
        statements.append('ALTER TABLE comment ADD COLUMN parent_id INTEGER')
        
    # IMPORTANT: run each DDL statement in its OWN transaction. On Postgres, the first
    # failing statement aborts the whole transaction ("current transaction is aborted,
    # commands ignored until end of transaction block"), which would silently skip every
    # later statement — including ADD COLUMN clerk_user_id — if any earlier one errored
    # (e.g. a column that already exists). db.engine.begin() commits on success and rolls
    # back only that one statement on failure, so the rest still apply. (SQLite doesn't
    # have this abort-cascade, which is why it never surfaced in local dev.)
    for stmt in statements:
        try:
            with db.engine.begin() as conn:
                conn.execute(text(stmt))
            app.logger.info(f"Applied migration: {stmt}")
        except Exception as e:
            app.logger.warning(f"Migration statement failed (continuing): {stmt} - Error: {str(e)}")

    # Log the resulting user-table columns so the deploy logs make it obvious whether the
    # critical clerk_user_id column actually landed (its absence is what 500s login and
    # clerk-exchange). Uses a fresh inspector so it reflects post-migration state.
    try:
        final_user_cols = {c['name'] for c in inspect(db.engine).get_columns('user')}
        app.logger.info(f"user table columns after migration: {sorted(final_user_cols)}")
        if 'clerk_user_id' not in final_user_cols:
            app.logger.error("CRITICAL: 'clerk_user_id' column is MISSING after migration — "
                             "login and clerk-exchange will 500 until it is added.")
    except Exception as e:
        app.logger.warning(f"Could not inspect user columns after migration: {str(e)}")

    # Optional bootstrap flow for first admin account (disabled by default).
    try:
        bootstrap_enabled = os.getenv('BOOTSTRAP_ADMIN_ON_STARTUP', 'false').lower() in ('true', '1', 'yes')
        bootstrap_identifier = os.getenv('BOOTSTRAP_ADMIN_IDENTIFIER', '').strip().lower()
        bootstrap_password = os.getenv('BOOTSTRAP_ADMIN_PASSWORD', '')

        if bootstrap_enabled:
            if not bootstrap_identifier:
                app.logger.warning('BOOTSTRAP_ADMIN_ON_STARTUP is enabled but BOOTSTRAP_ADMIN_IDENTIFIER is missing.')
            else:
                target_user = User.query.filter(
                    (User.username == bootstrap_identifier) | (User.email == bootstrap_identifier)
                ).first()
                if target_user:
                    target_user.is_admin = True
                    if bootstrap_password:
                        target_user.password_hash = generate_password_hash(bootstrap_password)
                    db.session.commit()
                    app.logger.info('Bootstrap admin flow applied for configured account.')
                else:
                    app.logger.warning('Bootstrap admin identifier was not found in database.')
    except Exception as e:
        app.logger.warning(f"Bootstrap admin flow failed: {str(e)}")

    app.logger.info('Phase-0 schema migrations completed.')



# Run migrations immediately upon startup
with app.app_context():
    try:
        _ensure_phase0_schema()
    except Exception as e:
        app.logger.warning(f'Phase 0 schema ensure skipped: {str(e)}')



# Root route for standard health checks (avoids 404 for bots/Render)
@app.route('/', methods=['GET'])
def index_health():
    return jsonify({
        'status': 'online',
        'service': 'Music Share Backend',
        'message': 'Welcome! Use /api/ to access endpoints.'
    })

# Basic liveness endpoints for hosting platform health checks
@app.route('/api/', methods=['GET'])
def root_health():
    return jsonify({'status': 'ok', 'service': 'music-share-backend'}), 200


@app.route('/api/health', methods=['GET'])
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
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=True)
    clerk_user_id = db.Column(db.String(64), unique=True, nullable=True)
    bio = db.Column(db.String(300), default='')
    avatar_url = db.Column(db.String(500), default='')
    favorite_genres = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_post_date = db.Column(db.Date, nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_banned = db.Column(db.Boolean, default=False, nullable=False)

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

    # Tracks when background Spotify sync last ran for this user
    last_synced_at = db.Column(db.DateTime, nullable=True)

    # Stores Kawarp background customization as JSON string
    kawarp_config = db.Column(db.String(1000), nullable=True)

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
            'followers_count': self.followers_list.count() if hasattr(self, 'followers_list') else 0,
            'following_count': self.followed.count() if hasattr(self, 'followed') else 0,
            'posts_count': len(self.posts) if hasattr(self, 'posts') else 0,
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at and self.created_at.tzinfo is None else (self.created_at.isoformat() if self.created_at else None)),
            'has_spotify_linked': bool(self.spotify_access_token),
            'has_youtube_linked': bool(self.youtube_access_token),
            'has_apple_music_linked': bool(self.apple_music_user_token),
            'has_tidal_linked': bool(self.tidal_access_token),
            'has_qobuz_linked': bool(self.qobuz_user_auth_token),
            'has_deezer_linked': bool(self.deezer_access_token),
            'collection_count': len(self.collection_items) if hasattr(self, 'collection_items') else 0,
            'kawarp_config': self.kawarp_config,
            'is_admin': self.is_admin,
            'is_banned': self.is_banned,
            'email': self.email,  # Useful for management
        }
        if current_user_id:
            try:
                # Use simple query check to avoid session.get issues
                if int(current_user_id) == self.id:
                    data['is_following'] = False # cannot follow self usually
                else:
                    data['is_following'] = self.followers_list.filter(followers.c.follower_id == current_user_id).count() > 0
            except Exception as e:
                app.logger.error(f"Error calculating is_following: {e}")
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


class CollabList(db.Model):
    __tablename__ = 'collab_lists'

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(500), default='')
    is_weekly_challenge = db.Column(db.Boolean, default=False, nullable=False)
    starts_at = db.Column(db.DateTime, nullable=True)
    ends_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    owner = db.relationship('User', backref=db.backref('owned_collab_lists', lazy=True))

    def to_dict(self, current_user_id: int | None = None, include_tracks: bool = False):
        tracks_query = CollabListTrack.query.filter_by(list_id=self.id)
        tracks = tracks_query.order_by(CollabListTrack.created_at.desc()).all() if include_tracks else []

        member_count = CollabListMember.query.filter_by(list_id=self.id).count()
        role = None
        if current_user_id is not None:
            if self.owner_id == current_user_id:
                role = 'owner'
            else:
                membership = CollabListMember.query.filter_by(list_id=self.id, user_id=current_user_id).first()
                role = membership.role if membership else None

        return {
            'id': self.id,
            'owner_id': self.owner_id,
            'name': self.name,
            'description': self.description,
            'is_weekly_challenge': bool(self.is_weekly_challenge),
            'starts_at': (self.starts_at.isoformat() + 'Z' if self.starts_at and self.starts_at.tzinfo is None else self.starts_at.isoformat()) if self.starts_at else None,
            'ends_at': (self.ends_at.isoformat() + 'Z' if self.ends_at and self.ends_at.tzinfo is None else self.ends_at.isoformat()) if self.ends_at else None,
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
            'owner': self.owner.to_dict(current_user_id=current_user_id),
            'member_count': member_count,
            'track_count': tracks_query.count(),
            'my_role': role,
            'tracks': [t.to_dict() for t in tracks],
        }


class CollabListMember(db.Model):
    __tablename__ = 'collab_list_members'

    list_id = db.Column(db.Integer, db.ForeignKey('collab_lists.id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    role = db.Column(db.String(20), default='member', nullable=False)

    collab_list = db.relationship('CollabList', backref=db.backref('memberships', lazy=True, cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('collab_list_memberships', lazy=True))


class CollabListTrack(db.Model):
    __tablename__ = 'collab_list_tracks'

    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('collab_lists.id'), nullable=False, index=True)
    added_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    track_title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(200), nullable=False)
    album = db.Column(db.String(200), default='')
    album_art_url = db.Column(db.String(500), default='')
    source_service = db.Column(db.String(50), default='')
    source_url = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    collab_list = db.relationship('CollabList', backref=db.backref('tracks', lazy=True, cascade='all, delete-orphan'))
    added_by_user = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'list_id': self.list_id,
            'added_by': self.added_by,
            'track_title': self.track_title,
            'artist': self.artist,
            'album': self.album,
            'album_art_url': self.album_art_url,
            'source_service': self.source_service,
            'source_url': self.source_url,
            'created_at': (self.created_at.isoformat() + 'Z' if self.created_at.tzinfo is None else self.created_at.isoformat()),
            'added_by_user': self.added_by_user.to_dict() if self.added_by_user else None,
        }


class WeeklyRecap(db.Model):
    __tablename__ = 'weekly_recaps'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    week_start = db.Column(db.Date, nullable=False, index=True)
    summary_json = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(500), default='')
    generated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = db.relationship('User', backref=db.backref('weekly_recaps', lazy=True, cascade='all, delete-orphan'))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'week_start', name='uq_weekly_recap_user_week'),
    )

    def to_dict(self):
        try:
            summary = json.loads(self.summary_json or '{}')
        except Exception:
            summary = {}

        normalized_summary = {
            'top_artist': summary.get('top_artist'),
            'top_genre': summary.get('top_genre'),
            'posts_shared': int(summary.get('posts_shared', 0) or 0),
            'now_playing_posts': int(summary.get('now_playing_posts', 0) or 0),
            'collection_adds': int(summary.get('collection_adds', 0) or 0),
            'total_scrobbles': int(summary.get('total_scrobbles', summary.get('posts_shared', 0)) or 0),
            'unique_artists': int(summary.get('unique_artists', 0) or 0),
            'unique_tracks': int(summary.get('unique_tracks', 0) or 0),
            'unique_albums': int(summary.get('unique_albums', 0) or 0),
            'active_days': int(summary.get('active_days', 0) or 0),
            'busiest_day': summary.get('busiest_day'),
            'top_artists': summary.get('top_artists') if isinstance(summary.get('top_artists'), list) else [],
            'top_tracks': summary.get('top_tracks') if isinstance(summary.get('top_tracks'), list) else [],
            'top_albums': summary.get('top_albums') if isinstance(summary.get('top_albums'), list) else [],
        }

        return {
            'id': self.id,
            'user_id': self.user_id,
            'week_start': self.week_start.isoformat() if self.week_start else None,
            'summary': normalized_summary,
            'image_url': self.image_url,
            'generated_at': (self.generated_at.isoformat() + 'Z' if self.generated_at.tzinfo is None else self.generated_at.isoformat()),
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





def _generate_apple_music_token():
    """Generate a JWT for Apple Music API (Developer Token)."""
    if not APPLE_MUSIC_KEY_ID or not APPLE_MUSIC_TEAM_ID or not APPLE_MUSIC_PRIVATE_KEY:
        return None

    try:
        current_time = int(time.time())
        # Token valid for 30 minutes
        payload = {
            'iss': APPLE_MUSIC_TEAM_ID,
            'iat': current_time,
            'exp': current_time + 1800
        }
        headers = {
            'alg': 'ES256',
            'kid': APPLE_MUSIC_KEY_ID
        }

        # Clear newlines from private key if needed
        pk = APPLE_MUSIC_PRIVATE_KEY
        if "-----BEGIN PRIVATE KEY-----" not in pk:
            pk = f"-----BEGIN PRIVATE KEY-----\n{pk}\n-----END PRIVATE KEY-----"

        return jwt.encode(payload, pk, algorithm='ES256', headers=headers)
    except Exception as e:
        app.logger.error(f'Failed to generate Apple Music developer token: {str(e)}')
        return None


class PasswordResetCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    code = db.Column(db.String(6), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship('User')

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


def _week_start_utc(dt: datetime | None = None) -> datetime.date:
    now = dt or datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    return monday.date()


def _build_weekly_recap_summary(user_id: int, week_start: datetime.date) -> dict:
    week_start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    week_end_dt = week_start_dt + timedelta(days=7)

    # ── App posts ──────────────────────────────────────────────────────────
    posts = Post.query.filter(
        Post.user_id == user_id,
        Post.created_at >= week_start_dt,
        Post.created_at < week_end_dt,
    ).all()

    post_count = len(posts)
    now_playing_count = 0
    collection_add_count = CollectionItem.query.filter(
        CollectionItem.user_id == user_id,
        CollectionItem.created_at >= week_start_dt,
        CollectionItem.created_at < week_end_dt,
    ).count()

    # ── Spotify recently-played scrobbles ──────────────────────────────────
    spotify_plays = []
    user = db.session.get(User, user_id)
    if user and user.spotify_access_token:
        after_ms = int(week_start_dt.timestamp() * 1000)
        data, err = _spotify_get(user, f'me/player/recently-played?limit=50&after={after_ms}')
        if not err and data:
            for item in data.get('items', []):
                played_at_str = item.get('played_at', '')
                try:
                    played_at = datetime.fromisoformat(played_at_str.replace('Z', '+00:00'))
                    if week_start_dt <= played_at < week_end_dt:
                        track = item.get('track') or {}
                        images = (track.get('album') or {}).get('images') or []
                        spotify_plays.append({
                            'title': track.get('name', ''),
                            'artist': ', '.join(
                                a['name'] for a in track.get('artists', []) if a.get('name')
                            ),
                            'album': (track.get('album') or {}).get('name', ''),
                            'album_art_url': images[-1].get('url', '') if images else '',
                            'played_date': played_at.date().isoformat(),
                        })
                except Exception:
                    pass

    # ── Aggregate posts + Spotify plays ────────────────────────────────────
    artists: dict[str, int] = {}
    genres: dict[str, int] = {}
    tracks: dict[str, dict] = {}
    albums: dict[str, dict] = {}
    active_days: set[str] = set()
    day_counts: dict[str, int] = {}

    for p in posts:
        if p.post_type == 'now_playing':
            now_playing_count += 1
        if p.artist:
            artists[p.artist] = artists.get(p.artist, 0) + 1
        if p.genre:
            genres[p.genre] = genres.get(p.genre, 0) + 1

        track_key = f"{(p.track_title or '').strip().lower()}::{(p.artist or '').strip().lower()}"
        if track_key not in tracks:
            tracks[track_key] = {
                'title': p.track_title,
                'artist': p.artist,
                'plays': 0,
                'album_art_url': p.album_art_url or '',
            }
        tracks[track_key]['plays'] += 1

        if p.album:
            album_key = f"{p.album.strip().lower()}::{(p.artist or '').strip().lower()}"
            if album_key not in albums:
                albums[album_key] = {
                    'name': p.album,
                    'artist': p.artist,
                    'plays': 0,
                    'album_art_url': p.album_art_url or '',
                }
            albums[album_key]['plays'] += 1

        created_date = p.created_at.date().isoformat() if p.created_at else None
        if created_date:
            active_days.add(created_date)
            day_counts[created_date] = day_counts.get(created_date, 0) + 1

    for sp in spotify_plays:
        if sp['artist']:
            artists[sp['artist']] = artists.get(sp['artist'], 0) + 1

        track_key = f"{sp['title'].strip().lower()}::{sp['artist'].strip().lower()}"
        if track_key not in tracks:
            tracks[track_key] = {
                'title': sp['title'],
                'artist': sp['artist'],
                'plays': 0,
                'album_art_url': sp['album_art_url'],
            }
        tracks[track_key]['plays'] += 1

        if sp['album']:
            album_key = f"{sp['album'].strip().lower()}::{sp['artist'].strip().lower()}"
            if album_key not in albums:
                albums[album_key] = {
                    'name': sp['album'],
                    'artist': sp['artist'],
                    'plays': 0,
                    'album_art_url': sp['album_art_url'],
                }
            albums[album_key]['plays'] += 1

        if sp['played_date']:
            active_days.add(sp['played_date'])
            day_counts[sp['played_date']] = day_counts.get(sp['played_date'], 0) + 1

    top_artist = max(artists.items(), key=lambda x: x[1])[0] if artists else None
    top_genre = max(genres.items(), key=lambda x: x[1])[0] if genres else None

    top_artists = [
        {'name': name, 'plays': plays}
        for name, plays in sorted(artists.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    top_tracks = sorted(tracks.values(), key=lambda x: x['plays'], reverse=True)[:5]
    top_albums = sorted(albums.values(), key=lambda x: x['plays'], reverse=True)[:5]

    busiest_day = None
    if day_counts:
        busiest_date_str = max(day_counts.items(), key=lambda x: x[1])[0]
        try:
            busiest_day = datetime.strptime(busiest_date_str, '%Y-%m-%d').strftime('%A')
        except Exception:
            busiest_day = busiest_date_str

    return {
        'top_artist': top_artist,
        'top_genre': top_genre,
        'posts_shared': post_count,
        'now_playing_posts': now_playing_count,
        'collection_adds': collection_add_count,
        'total_scrobbles': post_count + len(spotify_plays),
        'unique_artists': len(artists),
        'unique_tracks': len(tracks),
        'unique_albums': len(albums),
        'active_days': len(active_days),
        'busiest_day': busiest_day,
        'top_artists': top_artists,
        'top_tracks': top_tracks,
        'top_albums': top_albums,
    }


def _get_or_generate_weekly_recap(user_id: int, week_start: datetime.date) -> WeeklyRecap:
    existing = WeeklyRecap.query.filter_by(user_id=user_id, week_start=week_start).first()
    if existing:
        try:
            existing_summary = json.loads(existing.summary_json or '{}')
        except Exception:
            existing_summary = {}

        # Backfill older recap rows so clients immediately get Last.fm-style fields.
        if not isinstance(existing_summary.get('top_tracks'), list):
            refreshed_summary = _build_weekly_recap_summary(user_id=user_id, week_start=week_start)
            existing.summary_json = json.dumps(refreshed_summary)
            db.session.commit()
        return existing

    summary = _build_weekly_recap_summary(user_id=user_id, week_start=week_start)
    recap = WeeklyRecap(
        user_id=user_id,
        week_start=week_start,
        summary_json=json.dumps(summary),
        image_url='',
    )
    db.session.add(recap)
    try:
        db.session.commit()
        return recap
    except IntegrityError:
        # Another request created the same recap row in the meantime.
        db.session.rollback()
        existing_after_race = WeeklyRecap.query.filter_by(user_id=user_id, week_start=week_start).first()
        if existing_after_race:
            return existing_after_race
        raise



@app.route('/api/auth/register', methods=['POST'])
@limiter.limit('10 per hour; 3 per minute')
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
@limiter.limit('20 per hour; 5 per minute')
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Backward-compatible identifier parsing for web/admin/mobile clients.
        identifier = (
            data.get('identifier', '')
            or data.get('username', '')
            or data.get('email', '')
        )
        identifier = identifier.strip().lower()
        password = data.get('password', '')

        if not identifier or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400

        # Accept either username or email
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()
        # Clerk-only users have no password_hash — fail cleanly instead of
        # raising inside check_password_hash(None, ...).
        if not user or not user.password_hash or not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401

        token = create_access_token(identity=str(user.id))
        return jsonify({'token': token, 'user': user.to_dict(current_user_id=user.id)}), 200

    except Exception as e:
        import traceback
        app.logger.error(f'Login error: {str(e)}\n{traceback.format_exc()}')
        return jsonify(_error_payload('Login failed', str(e))), 500


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    return jsonify(user.to_dict(current_user_id=user_id))


@app.route('/api/auth/clerk-exchange', methods=['POST'])
@limiter.limit('30 per hour; 10 per minute')
def clerk_exchange():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing Clerk session token'}), 401
    clerk_token = auth_header[len('Bearer '):].strip()

    try:
        claims = _verify_clerk_token(clerk_token)
    except ClerkVerificationError as e:
        app.logger.warning(f'Clerk token verification failed: {str(e)}')
        return jsonify({'error': 'Invalid session'}), 401

    clerk_user_id = claims.get('sub')
    if not clerk_user_id:
        return jsonify({'error': 'Invalid session'}), 401

    # Wrap the DB/profile work so any unexpected error is logged with a traceback
    # (matching the login() route) and returns a clean message instead of the raw
    # global 500 handler — critical for diagnosing prod-only issues like a schema
    # column that failed to migrate.
    try:
        user = User.query.filter_by(clerk_user_id=clerk_user_id).first()

        if not user:
            try:
                profile = _fetch_clerk_user(clerk_user_id)
            except Exception as e:
                app.logger.error(f'Failed to fetch Clerk user profile: {str(e)}')
                return jsonify({'error': 'Could not reach Clerk, please try again'}), 502

            email = None
            email_addresses = profile.get('email_addresses') or []
            primary_email_id = profile.get('primary_email_address_id')
            primary = next((e for e in email_addresses if e.get('id') == primary_email_id), None)
            candidate = (primary or (email_addresses[0] if email_addresses else {})).get('email_address')
            if candidate:
                candidate = sanitize_string(candidate.strip().lower(), MAX_EMAIL_LEN)
                if validate_email(candidate):
                    email = candidate

            username_base = profile.get('username') or (email.split('@')[0] if email else None) or f'user_{clerk_user_id[-8:]}'
            username_base = sanitize_string(username_base.lower(), MAX_USERNAME_LEN) or f'user_{clerk_user_id[-8:]}'
            username = username_base
            suffix_attempt = 0
            while User.query.filter(User.username.ilike(username)).first():
                suffix_attempt += 1
                username = f'{username_base}{random.randint(1000, 9999)}'
                if suffix_attempt > 20:
                    return jsonify({'error': 'Could not allocate a username, please try again'}), 500

            display_name = ' '.join(
                part for part in [profile.get('first_name'), profile.get('last_name')] if part
            ).strip() or username
            display_name = sanitize_string(display_name, MAX_DISPLAY_NAME_LEN) or username

            user = User(
                username=username,
                display_name=display_name,
                email=email,
                clerk_user_id=clerk_user_id,
            )
            db.session.add(user)
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                # Race between two concurrent first-time exchanges for the same Clerk user.
                user = User.query.filter_by(clerk_user_id=clerk_user_id).first()
                if not user:
                    return jsonify({'error': 'Could not create account, please try again'}), 500

        token = create_access_token(identity=str(user.id))
        return jsonify({'token': token, 'user': user.to_dict(current_user_id=user.id)}), 200

    except Exception as e:
        import traceback
        app.logger.error(f'Clerk exchange error: {str(e)}\n{traceback.format_exc()}')
        db.session.rollback()
        return jsonify(_error_payload('Clerk exchange failed', str(e))), 500

# ─── Spotify OAuth ─────────────────────────────────────────────────────────────

import requests
import base64
from ytmusicapi import YTMusic, OAuthCredentials
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

# Spotify live endpoint cache settings (short-lived, stale-while-revalidate).
SPOTIFY_LIVE_CACHE_TTL_SECONDS = int(os.getenv('SPOTIFY_LIVE_CACHE_TTL_SECONDS', '12'))
SPOTIFY_LIVE_CACHE_STALE_SECONDS = int(os.getenv('SPOTIFY_LIVE_CACHE_STALE_SECONDS', '45'))
_spotify_live_cache = {}
_spotify_live_cache_lock = threading.Lock()
_spotify_live_refreshing = set()


def _spotify_live_cache_get(user_id: int):
    with _spotify_live_cache_lock:
        entry = _spotify_live_cache.get(user_id)

    if not entry:
        return None, None

    age = time.time() - entry['fetched_at']
    if age <= SPOTIFY_LIVE_CACHE_TTL_SECONDS:
        return entry['data'], 'fresh'
    if age <= (SPOTIFY_LIVE_CACHE_TTL_SECONDS + SPOTIFY_LIVE_CACHE_STALE_SECONDS):
        return entry['data'], 'stale'
    return None, None


def _spotify_live_cache_set(user_id: int, data: dict):
    with _spotify_live_cache_lock:
        _spotify_live_cache[user_id] = {
            'data': data,
            'fetched_at': time.time(),
        }


def _spotify_live_cache_delete(user_id: int):
    with _spotify_live_cache_lock:
        _spotify_live_cache.pop(user_id, None)


def _build_spotify_live_payload(data: dict | None) -> dict:
    if not data or not data.get('item'):
        return {'is_playing': False}

    item = data['item']
    return {
        'is_playing': data.get('is_playing', False),
        'track_title': item.get('name', ''),
        'artist': ', '.join([a.get('name', '') for a in item.get('artists', [])]),
        'album': item.get('album', {}).get('name', ''),
        'album_art_url': item.get('album', {}).get('images', [{}])[0].get('url', ''),
        'preview_url': item.get('preview_url', ''),
        'spotify_url': item.get('external_urls', {}).get('spotify', ''),
        'progress_ms': data.get('progress_ms', 0),
        'duration_ms': item.get('duration_ms', 0),
    }


def _refresh_spotify_live_cache_async(user_id: int):
    with _spotify_live_cache_lock:
        if user_id in _spotify_live_refreshing:
            return
        _spotify_live_refreshing.add(user_id)

    def _worker():
        try:
            with app.app_context():
                user = db.session.get(User, user_id)
                if not user or not user.spotify_access_token:
                    return
                data, err = _spotify_get(user, 'me/player/currently-playing')
                if err:
                    return
                payload = _build_spotify_live_payload(data)
                _spotify_live_cache_set(user_id, payload)
        except Exception:
            pass
        finally:
            with _spotify_live_cache_lock:
                _spotify_live_refreshing.discard(user_id)

    # FIX: actually start the background thread
    import threading
    threading.Thread(target=_worker, daemon=True).start()

@app.route('/api/auth/oauth-state', methods=['GET'])
@jwt_required()
def get_oauth_state():
    """Return a short-lived HMAC-signed state token for the calling user.
    The mobile client passes this as ?state= when initiating OAuth so the
    callback can verify it wasn't tampered with (CSRF protection).
    """
    user_id = int(get_jwt_identity())
    state = _generate_oauth_state(user_id)
    return jsonify({'state': state})


@app.route('/api/integrations/spotify/callback', methods=['GET', 'POST'])
def spotify_callback():
    """Handle Spotify OAuth callback. Supports both GET (direct redirect) and POST (frontend relay)."""
    try:
        if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
            # For GET requests, return a simple string error, for POST, jsonify
            if request.method == 'GET':
                return "Spotify integration not configured", 503
            return jsonify({'error': 'Spotify integration not configured'}), 503

        # Check if it's a direct redirect (GET) or a frontend relay (POST)
        if request.method == 'GET':
            code = request.args.get('code')
            state = request.args.get('state')
            if not state:
                return "Missing state parameter", 400
            # Validate HMAC-signed state token
            user_id = _verify_oauth_state(state)
            if user_id is None:
                app.logger.warning("[Spotify] Invalid or expired OAuth state parameter")
                return "Invalid or expired OAuth state. Please try linking Spotify again.", 400
            # Use exact env var to prevent OAuth mismatches
            redirect_uri = SPOTIFY_REDIRECT_URI
        else:
            # For POST requests, jwt_required() is expected to be applied,
            # but since it's a shared endpoint, we'll handle it manually.
            # If it's a POST, we expect a JWT token.
            try:
                verify_jwt_in_request()
                current_user_id = int(get_jwt_identity())
            except Exception:
                return jsonify({'error': 'Authentication required for POST callback'}), 401
            
            data = request.get_json() or {}
            code = data.get('code')
            user_id = current_user_id
            redirect_uri = data.get('redirect_uri', SPOTIFY_REDIRECT_URI)

        if not code:
            if request.method == 'GET':
                return "Authorization code is required", 400
            return jsonify({'error': 'Authorization code is required'}), 400

        user = db.session.get(User, user_id)
        if not user:
            if request.method == 'GET':
                return "User not found", 404
            return jsonify({'error': 'User not found'}), 404

        app.logger.info(f"[Spotify] Exchanging code for user {user_id} with redirect_uri: {redirect_uri}")

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
            app.logger.warning(f"Spotify error for user {user_id}: {token_info.get('error')}")
            if request.method == 'GET':
                return f"Failed to connect to Spotify: {token_info.get('error', 'unknown error')}", 400
            return jsonify({'error': 'Failed to connect to Spotify'}), 400
            
        user.spotify_access_token = token_info.get('access_token', '')
        if 'refresh_token' in token_info:
            user.spotify_refresh_token = token_info['refresh_token']
            
        expires_in = token_info.get('expires_in', 3600)
        user.spotify_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        db.session.commit()

        if request.method == 'GET':
            # Support both Native Deep Link and Web Popup closing
            html_response = """
            <!DOCTYPE html>
            <html>
            <head>
                <script>
                    window.location.replace("musicshare://auth-success?service=spotify");
                    setTimeout(function() {
                        if (window.opener) {
                            window.close();
                        }
                    }, 500);
                </script>
            </head>
            <body style="background:#000; color:#fff; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <h2>Successfully connected to Spotify</h2>
                <p>Returning you to the app...</p>
            </body>
            </html>
            """
            return html_response
        return jsonify({'message': 'Spotify linked successfully', 'user': user.to_dict(user_id)})
        
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

    cached, cache_state = _spotify_live_cache_get(user.id)
    if cached and cache_state == 'fresh':
        return jsonify(cached)

    if cached and cache_state == 'stale':
        _refresh_spotify_live_cache_async(user.id)
        return jsonify(cached)

    data, err = _spotify_get(user, 'me/player/currently-playing')
    if err:
        # If we have stale data from earlier, serve it on transient upstream failures.
        if cached:
            return jsonify(cached)
        return jsonify({'is_playing': False, 'error': err})

    track_data = _build_spotify_live_payload(data)
    _spotify_live_cache_set(user.id, track_data)
    return jsonify(track_data)


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
    try:
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
            t = item.get('track') or {}
            if not t:
                continue
            tracks.append({
                'track_title': t.get('name', ''),
                'artist': ', '.join(a['name'] for a in t.get('artists', [])),
                'album': t.get('album', {}).get('name', ''),
                'album_art_url': (t.get('album', {}).get('images') or [{}])[0].get('url', ''),
                'spotify_url': t.get('external_urls', {}).get('spotify', ''),
                'played_at': item.get('played_at', ''),
            })
        return jsonify(tracks)
    except Exception as e:
        app.logger.error(f'[Spotify Recent] Unexpected error: {str(e)}')
        return jsonify({'error': 'Failed to fetch recent tracks', 'detail': str(e)}), 500


@app.route('/api/integrations/spotify/top-artists', methods=['GET'])
@jwt_required()
def spotify_top_artists():
    """Top 10 artists (medium term ≈ last 6 months) for a user."""
    try:
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
    except Exception as e:
        app.logger.error(f'[Spotify Top Artists] Unexpected error: {str(e)}')
        return jsonify({'error': 'Failed to fetch top artists', 'detail': str(e)}), 500


@app.route('/api/integrations/spotify/playlists', methods=['GET'])
@jwt_required()
def spotify_playlists():
    """User's public + private playlists (first 20)."""
    try:
        user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
        user = db.get_or_404(User, user_id)

        data, err = _spotify_get(user, 'me/playlists?limit=20')
        if err:
            return jsonify({'error': err}), 400

        items = data.get('items', []) if data else []

        playlists = []
        for p in items:
            if not p:  # Spotify can return null items
                continue
            playlists.append({
                'name': p.get('name', ''),
                'image_url': (p.get('images') or [{}])[0].get('url', ''),
                'track_count': p.get('tracks', {}).get('total', 0),
                'spotify_url': p.get('external_urls', {}).get('spotify', ''),
                'owner': p.get('owner', {}).get('display_name', ''),
                'public': p.get('public', True),
            })
        return jsonify(playlists)
    except Exception as e:
        app.logger.error(f'[Spotify Playlists] Unexpected error: {str(e)}')
        return jsonify({'error': 'Failed to fetch playlists', 'detail': str(e)}), 500


@app.route('/api/integrations/spotify/disconnect', methods=['DELETE'])
@jwt_required()
def spotify_disconnect():
    """Unlink Spotify from the user's account."""
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)
    user.spotify_access_token = ''
    user.spotify_refresh_token = ''
    user.spotify_token_expires_at = None
    _spotify_live_cache_delete(user_id)
    db.session.commit()
    return jsonify({'message': 'Spotify disconnected', 'user': user.to_dict(current_user_id=user_id)})


# ─── YouTube Music Integration ────────────────────────────────────────────────

def _youtube_api_get(user, path: str, params: dict = None):
    """Make an authenticated GET request to the YouTube Data API v3.
    Refreshes the access token if expired. Returns (json, error_str)."""
    if not user.youtube_access_token:
        return None, 'YouTube Music not linked'

    # Refresh token if expired
    if user.youtube_token_expires_at and datetime.utcnow() > user.youtube_token_expires_at:
        if not user.youtube_refresh_token:
            return None, 'YouTube Music token expired — please reconnect'
        try:
            res = requests.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': user.youtube_refresh_token,
                    'client_id': YOUTUBE_CLIENT_ID,
                    'client_secret': YOUTUBE_CLIENT_SECRET,
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10,
            )
            info = res.json()
            if 'access_token' in info:
                user.youtube_access_token = info['access_token']
                user.youtube_token_expires_at = datetime.utcnow() + timedelta(seconds=info.get('expires_in', 3600))
                db.session.commit()
                app.logger.info(f'[YouTube] Token refreshed for user {user.id}')
            else:
                app.logger.error(f'[YouTube] Token refresh failed: {info}')
                return None, 'Token refresh failed — please reconnect YouTube Music'
        except Exception as e:
            return None, str(e)

    base = 'https://www.googleapis.com/youtube/v3'
    try:
        r = requests.get(
            f'{base}/{path}',
            headers={'Authorization': f'Bearer {user.youtube_access_token}'},
            params=params or {},
            timeout=10,
        )
        if r.status_code == 401:
            return None, 'Unauthorized — please reconnect YouTube Music'
        if r.status_code >= 400:
            app.logger.error(f'[YouTube API] {r.status_code}: {r.text[:300]}')
            return None, f'YouTube API error {r.status_code}'
        return r.json(), None
    except Exception as e:
        return None, str(e)


@app.route('/api/integrations/youtube/callback', methods=['GET', 'POST'])
def youtube_callback():
    """Handle YouTube (Google) OAuth callback. Supports GET (direct) and POST (relay)."""
    try:
        # Check if it's a direct redirect (GET) or a frontend relay (POST)
        if request.method == 'GET':
            code = request.args.get('code')
            state = request.args.get('state')
            if not state:
                return "Missing state parameter", 400
            # Validate HMAC-signed state token (same pattern as Spotify)
            user_id = _verify_oauth_state(state)
            if user_id is None:
                app.logger.warning("[YouTube] Invalid or expired OAuth state parameter")
                return "Invalid or expired OAuth state. Please try linking YouTube Music again.", 400
            # Always use the exact env var — must match what was registered in Google Cloud Console
            redirect_uri = YOUTUBE_REDIRECT_URI
        else:
            try:
                verify_jwt_in_request()
                current_user_id = int(get_jwt_identity())
            except Exception:
                return jsonify({'error': 'Authentication required'}), 401
            
            data = request.get_json() or {}
            code = data.get('code')
            user_id = current_user_id
            redirect_uri = data.get('redirect_uri', YOUTUBE_REDIRECT_URI)
        
        if not code:
            if request.method == 'GET':
                return "Missing authorization code", 400
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
            app.logger.warning(f"YouTube error for user {user_id}: {token_info.get('error')}")
            if request.method == 'GET':
                return f"Failed to connect to YouTube: {token_info.get('error')}", 400
            return jsonify({'error': 'Failed to connect to YouTube Music'}), 400
            
        user = db.session.get(User, user_id)
        if not user:
            return "User not found", 404

        user.youtube_access_token = token_info.get('access_token', '')
        if 'refresh_token' in token_info:
            user.youtube_refresh_token = token_info['refresh_token']
            
        expires_in = token_info.get('expires_in', 3600)
        user.youtube_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        db.session.commit()

        if request.method == 'GET':
            html_response = """
            <!DOCTYPE html>
            <html>
            <head>
                <script>
                    window.location.replace("musicshare://auth-success?service=youtube");
                    setTimeout(function() {
                        if (window.opener) {
                            window.close();
                        }
                    }, 500);
                </script>
            </head>
            <body style="background:#000; color:#fff; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <h2>Successfully connected to YouTube Music</h2>
                <p>Returning you to the app...</p>
            </body>
            </html>
            """
            return html_response

        return jsonify({'message': 'YouTube Music linked successfully', 'user': user.to_dict(user_id)})
        
    except Exception as e:
        app.logger.error(f'YouTube callback error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500


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
    """User's YouTube playlists via YouTube Data API v3."""
    try:
        user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
        user = db.get_or_404(User, user_id)

        data, err = _youtube_api_get(user, 'playlists', {
            'part': 'snippet,contentDetails',
            'mine': 'true',
            'maxResults': 25,
        })
        if err:
            app.logger.error(f'[YouTube Playlists] Error for user {user_id}: {err}')
            return jsonify({'error': err}), 400

        items = (data or {}).get('items', [])
        playlists = []
        for p in items:
            snippet = p.get('snippet', {})
            thumbs = snippet.get('thumbnails', {})
            thumb_url = (thumbs.get('high') or thumbs.get('medium') or thumbs.get('default') or {}).get('url', '')
            playlists.append({
                'name': snippet.get('title', ''),
                'description': snippet.get('description', ''),
                'image_url': thumb_url,
                'track_count': p.get('contentDetails', {}).get('itemCount', 0),
                'youtube_url': f"https://www.youtube.com/playlist?list={p.get('id', '')}",
            })
        return jsonify(playlists)
    except Exception as e:
        app.logger.error(f'[YouTube Playlists] Unexpected error: {str(e)}')
        return jsonify({'error': 'Failed to fetch playlists', 'detail': str(e)}), 500


@app.route('/api/integrations/youtube/history', methods=['GET'])
@jwt_required()
def youtube_history():
    """User's recently liked/watched videos as a history proxy via YouTube Data API v3.
    Note: YouTube Data API does not expose watch history for privacy reasons.
    We return the user's liked videos as a reasonable substitute.
    """
    try:
        user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
        user = db.get_or_404(User, user_id)

        # Fetch items from the 'Liked videos' playlist (playlistId = 'LL')
        data, err = _youtube_api_get(user, 'playlistItems', {
            'part': 'snippet',
            'playlistId': 'LL',
            'maxResults': 20,
        })
        if err:
            app.logger.error(f'[YouTube History] Error for user {user_id}: {err}')
            return jsonify({'error': err}), 400

        items = (data or {}).get('items', [])
        tracks = []
        for item in items:
            snippet = item.get('snippet', {})
            thumbs = snippet.get('thumbnails', {})
            thumb = (thumbs.get('high') or thumbs.get('medium') or thumbs.get('default') or {}).get('url', '')
            vid_id = snippet.get('resourceId', {}).get('videoId', '')
            tracks.append({
                'title': snippet.get('title', ''),
                'artist': snippet.get('videoOwnerChannelTitle', ''),
                'album': '',
                'image_url': thumb,
                'duration': 0,
                'youtube_url': f'https://www.youtube.com/watch?v={vid_id}' if vid_id else '',
            })
        return jsonify(tracks)
    except Exception as e:
        app.logger.error(f'[YouTube History] Unexpected error: {str(e)}')
        return jsonify({'error': 'Failed to fetch history', 'detail': str(e)}), 500


@app.route('/api/integrations/youtube/liked', methods=['GET'])
@jwt_required()
def youtube_liked():
    """User's liked videos from YouTube via YouTube Data API v3."""
    try:
        user_id = request.args.get('user_id', type=int) or int(get_jwt_identity())
        user = db.get_or_404(User, user_id)

        data, err = _youtube_api_get(user, 'playlistItems', {
            'part': 'snippet',
            'playlistId': 'LL',
            'maxResults': 25,
        })
        if err:
            app.logger.error(f'[YouTube Liked] Error for user {user_id}: {err}')
            return jsonify({'error': err}), 400

        items = (data or {}).get('items', [])
        songs = []
        for item in items:
            snippet = item.get('snippet', {})
            thumbs = snippet.get('thumbnails', {})
            thumb = (thumbs.get('high') or thumbs.get('medium') or thumbs.get('default') or {}).get('url', '')
            vid_id = snippet.get('resourceId', {}).get('videoId', '')
            songs.append({
                'title': snippet.get('title', ''),
                'artist': snippet.get('videoOwnerChannelTitle', ''),
                'album': '',
                'image_url': thumb,
                'duration': 0,
                'youtube_url': f'https://www.youtube.com/watch?v={vid_id}' if vid_id else '',
            })
        return jsonify(songs)
    except Exception as e:
        app.logger.error(f'[YouTube Liked] Unexpected error: {str(e)}')
        return jsonify({'error': 'Failed to fetch liked songs', 'detail': str(e)}), 500


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
    try:
        dev_token = _generate_apple_music_token()
        if not dev_token:
            return jsonify({'error': 'Apple Music developer token not configured'}), 500

        app.logger.debug(f'[Apple Music] Fetching playlists for user {user_id}')
        r = requests.get(
            'https://api.music.apple.com/v1/me/library/playlists',
            headers={
                'Authorization': f"Bearer {dev_token}",
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

@app.route('/api/integrations/deezer/callback', methods=['GET', 'POST'])
def deezer_callback():
    """Handle Deezer OAuth callback. Supports both GET (direct) and POST (frontend relay)."""
    try:
        # Check if it's a direct redirect (GET) or a frontend relay (POST)
        if request.method == 'GET':
            code = request.args.get('code')
            state = request.args.get('state') # We expect the user_id in the state
            if not state:
                return "Missing state parameter (user_id required)", 400
            user_id = int(state)
        else:
            try:
                verify_jwt_in_request()
                current_user_id = int(get_jwt_identity())
            except Exception:
                return jsonify({'error': 'Authentication required'}), 401
            
            data = request.get_json() or {}
            code = data.get('code')
            user_id = current_user_id
        
        if not code:
            if request.method == 'GET':
                return "Missing authorization code", 400
            return jsonify({'error': 'Missing authorization code'}), 400
            
        if not DEEZER_APP_ID or not DEEZER_APP_SECRET:
            app.logger.error('[Deezer] Missing credentials in environment')
            return "Deezer not configured", 500
        
        # Exchange code for access token
        # Deezer sometimes returns query string, sometimes JSON depending on Content-Type/Output param
        token_url = 'https://connect.deezer.com/oauth/access_token.php'
        params = {
            'app_id': DEEZER_APP_ID,
            'secret': DEEZER_APP_SECRET,
            'code': code,
            'output': 'json'
        }
        
        response = requests.get(token_url, params=params, timeout=10)
        
        if response.status_code != 200:
            if request.method == 'GET':
                return "Failed to exchange code with Deezer", 400
            return jsonify({'error': 'Failed to exchange code for token'}), 400
            
        # Try to parse as JSON first
        try:
            token_data = response.json()
            access_token = token_data.get('access_token')
            expires = token_data.get('expires', 0)
        except:
            # Fallback to query string
            from urllib.parse import parse_qs
            token_data = parse_qs(response.text)
            access_token = token_data.get('access_token', [''])[0]
            expires = int(token_data.get('expires', [0])[0])

        if not access_token:
            if request.method == 'GET':
                return "No access token received from Deezer", 400
            return jsonify({'error': 'No access token received'}), 400
            
        user = db.session.get(User, user_id)
        if not user:
            return "User not found", 404

        # Fetch Deezer User ID
        user_info_req = requests.get('https://api.deezer.com/user/me', params={'access_token': access_token}, timeout=10)
        if user_info_req.status_code == 200:
            user_info = user_info_req.json()
            user.deezer_user_id = str(user_info.get('id', ''))

        user.deezer_access_token = access_token
        if expires > 0:
            user.deezer_token_expires_at = datetime.utcnow() + timedelta(seconds=expires)
        else:
            # Set a long default for offline access
            user.deezer_token_expires_at = datetime.utcnow() + timedelta(days=365)
        
        db.session.commit()

        if request.method == 'GET':
            return redirect("musicshare://auth-success?service=deezer")

        return jsonify({'message': 'Deezer linked successfully', 'user': user.to_dict(user_id)})
        
    except Exception as e:
        app.logger.error(f'Deezer callback error: {str(e)}')
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

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


@app.route('/api/users/mention-search', methods=['GET'])
@jwt_required()
def mention_search_users():
    current_user_id = int(get_jwt_identity())
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])

    users = User.query.filter(
        User.id != current_user_id,
        User.username.ilike(f'{q}%')
    ).order_by(User.username.asc()).limit(8).all()

    return jsonify([
        {
            'id': u.id,
            'username': u.username,
            'display_name': u.display_name,
            'avatar_url': u.avatar_url,
        }
        for u in users
    ])


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
        if 'kawarp_config' in data:
            # save the json string directly
            user.kawarp_config = str(data['kawarp_config'])[:1000] if data['kawarp_config'] else None

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

    # selectinload(Post.author) batches author fetches into 1 extra query.
    # NOTE: liked_by is lazy='dynamic' and cannot use selectinload.
    # Instead we fetch like counts and is_liked in two bulk queries below.
    posts_page = Post.query \
        .filter(Post.user_id.in_(followed_ids)) \
        .options(selectinload(Post.author)) \
        .order_by(Post.created_at.desc()) \
        .paginate(page=page, per_page=20, error_out=False)

    post_ids = [p.id for p in posts_page.items]

    # Batch like counts — one query for all posts on this page
    like_counts = dict(
        db.session.query(track_likes.c.post_id, db.func.count(track_likes.c.user_id))
        .filter(track_likes.c.post_id.in_(post_ids))
        .group_by(track_likes.c.post_id)
        .all()
    ) if post_ids else {}

    # Batch is_liked — one query for all posts on this page
    liked_set = set(
        row[0] for row in
        db.session.query(track_likes.c.post_id)
        .filter(
            track_likes.c.post_id.in_(post_ids),
            track_likes.c.user_id == current_user_id
        )
        .all()
    ) if post_ids else set()

    result = []
    for p in posts_page.items:
        d = p.to_dict(current_user_id=None)   # skip liked_by inside to_dict
        d['likes_count'] = like_counts.get(p.id, 0)
        d['is_liked']    = p.id in liked_set
        result.append(d)

    return jsonify({
        'posts': result,
        'total': posts_page.total,
        'pages': posts_page.pages,
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

        if parent_id is not None and parent_comment.user_id != current_user_id:
            _notify(recipient_id=parent_comment.user_id, actor_id=current_user_id, notif_type='comment', post_id=post.id)

        # Notify mentioned users using @username syntax.
        mentioned_usernames = set(re.findall(r'@([A-Za-z0-9_]{2,50})', text))
        for uname in mentioned_usernames:
            mentioned_user = User.query.filter(db.func.lower(User.username) == uname.lower()).first()
            if mentioned_user:
                _notify(recipient_id=mentioned_user.id, actor_id=current_user_id, notif_type='mention', post_id=post.id)
        
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


@app.route('/api/posts/<int:post_id>/pin-comment', methods=['DELETE'])
@jwt_required()
def unpin_comment(post_id):
    current_user_id = int(get_jwt_identity())
    post = db.get_or_404(Post, post_id)

    if post.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    post.pinned_comment_id = None
    db.session.commit()
    return jsonify({'message': 'Pinned comment cleared', 'pinned_comment_id': None}), 200


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


def _is_collab_list_member(list_id: int, user_id: int) -> bool:
    return CollabListMember.query.filter_by(list_id=list_id, user_id=user_id).first() is not None


@app.route('/api/collab-lists', methods=['GET', 'POST'])
@jwt_required()
def collab_lists():
    current_user_id = int(get_jwt_identity())

    if request.method == 'GET':
        lists = CollabList.query.outerjoin(
            CollabListMember, CollabList.id == CollabListMember.list_id
        ).filter(
            (CollabList.owner_id == current_user_id) | (CollabListMember.user_id == current_user_id)
        ).distinct().order_by(CollabList.created_at.desc()).all()

        return jsonify([l.to_dict(current_user_id=current_user_id, include_tracks=True) for l in lists]), 200

    data = request.get_json() or {}
    name = sanitize_string(data.get('name', ''), 120)
    description = sanitize_string(data.get('description', ''), 500)
    if not name:
        return jsonify({'error': 'name is required'}), 400

    starts_at = None
    ends_at = None
    if data.get('starts_at'):
        try:
            starts_at = datetime.fromisoformat(str(data['starts_at']).replace('Z', '+00:00'))
        except Exception:
            return jsonify({'error': 'Invalid starts_at format'}), 400
    if data.get('ends_at'):
        try:
            ends_at = datetime.fromisoformat(str(data['ends_at']).replace('Z', '+00:00'))
        except Exception:
            return jsonify({'error': 'Invalid ends_at format'}), 400

    collab_list = CollabList(
        owner_id=current_user_id,
        name=name,
        description=description,
        is_weekly_challenge=bool(data.get('is_weekly_challenge', False)),
        starts_at=starts_at,
        ends_at=ends_at,
    )
    db.session.add(collab_list)
    db.session.flush()

    db.session.add(CollabListMember(list_id=collab_list.id, user_id=current_user_id, role='owner'))
    db.session.commit()
    return jsonify(collab_list.to_dict(current_user_id=current_user_id, include_tracks=True)), 201


@app.route('/api/collab-lists/<int:list_id>/invite', methods=['POST'])
@jwt_required()
def invite_to_collab_list(list_id):
    current_user_id = int(get_jwt_identity())
    collab_list = db.get_or_404(CollabList, list_id)

    if collab_list.owner_id != current_user_id:
        return jsonify({'error': 'Only list owner can invite members'}), 403

    data = request.get_json() or {}
    invited_user_id = data.get('user_id')
    try:
        invited_user_id = int(invited_user_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'user_id is required and must be an integer'}), 400

    invited_user = User.query.filter_by(id=invited_user_id).first()
    if not invited_user:
        return jsonify({'error': 'User not found'}), 404

    existing = CollabListMember.query.filter_by(list_id=list_id, user_id=invited_user_id).first()
    if existing:
        return jsonify({'message': 'User already a member'}), 200

    db.session.add(CollabListMember(list_id=list_id, user_id=invited_user_id, role='member'))
    db.session.commit()
    return jsonify({'message': 'Member invited'}), 201


@app.route('/api/collab-lists/<int:list_id>/tracks', methods=['POST'])
@jwt_required()
def add_collab_list_track(list_id):
    current_user_id = int(get_jwt_identity())
    collab_list = db.get_or_404(CollabList, list_id)

    if collab_list.owner_id != current_user_id and not _is_collab_list_member(list_id, current_user_id):
        return jsonify({'error': 'Not a member of this list'}), 403

    data = request.get_json() or {}
    track_title = sanitize_string(data.get('track_title', ''), 200)
    artist = sanitize_string(data.get('artist', ''), 200)
    if not track_title or not artist:
        return jsonify({'error': 'track_title and artist are required'}), 400

    album_art_url = sanitize_string(data.get('album_art_url', ''), MAX_URL_LEN)
    source_url = sanitize_string(data.get('source_url', ''), MAX_URL_LEN)
    if album_art_url and not validate_url(album_art_url):
        return jsonify({'error': 'Invalid album_art_url'}), 400
    if source_url and not validate_url(source_url):
        return jsonify({'error': 'Invalid source_url'}), 400

    track = CollabListTrack(
        list_id=list_id,
        added_by=current_user_id,
        track_title=track_title,
        artist=artist,
        album=sanitize_string(data.get('album', ''), 200),
        album_art_url=album_art_url,
        source_service=sanitize_string(data.get('source_service', ''), 50),
        source_url=source_url,
    )
    db.session.add(track)
    db.session.commit()
    return jsonify(track.to_dict()), 201


@app.route('/api/collab-lists/<int:list_id>/tracks/<int:track_id>', methods=['DELETE'])
@jwt_required()
def delete_collab_list_track(list_id, track_id):
    current_user_id = int(get_jwt_identity())
    collab_list = db.get_or_404(CollabList, list_id)
    track = CollabListTrack.query.filter_by(id=track_id, list_id=list_id).first()
    if not track:
        return jsonify({'error': 'Track not found'}), 404

    if current_user_id not in (collab_list.owner_id, track.added_by):
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(track)
    db.session.commit()
    return jsonify({'message': 'Track removed'}), 200


@app.route('/api/recap/latest', methods=['GET'], strict_slashes=False)
@app.route('/api/recaps/latest', methods=['GET'], strict_slashes=False)
@jwt_required()
def recap_latest():
    current_user_id = int(get_jwt_identity())
    week_start = _week_start_utc()

    # Always recompute the current week so new Spotify plays are picked up
    summary = _build_weekly_recap_summary(user_id=current_user_id, week_start=week_start)
    existing = WeeklyRecap.query.filter_by(user_id=current_user_id, week_start=week_start).first()
    if existing:
        existing.summary_json = json.dumps(summary)
        db.session.commit()
        recap = existing
    else:
        recap = WeeklyRecap(
            user_id=current_user_id,
            week_start=week_start,
            summary_json=json.dumps(summary),
            image_url='',
        )
        db.session.add(recap)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            recap = WeeklyRecap.query.filter_by(user_id=current_user_id, week_start=week_start).first()

    return jsonify(recap.to_dict()), 200


@app.route('/api/recap/history', methods=['GET'], strict_slashes=False)
@app.route('/api/recaps/history', methods=['GET'], strict_slashes=False)
@jwt_required()
def recap_history():
    current_user_id = int(get_jwt_identity())
    recaps = WeeklyRecap.query.filter_by(user_id=current_user_id).order_by(WeeklyRecap.week_start.desc()).limit(12).all()

    if not recaps:
        recaps = [_get_or_generate_weekly_recap(user_id=current_user_id, week_start=_week_start_utc())]

    return jsonify([r.to_dict() for r in recaps]), 200


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


@app.route('/api/explore/recommendations', methods=['GET'], strict_slashes=False)
@app.route('/api/recommendations/explore', methods=['GET'], strict_slashes=False)
@jwt_required()
def explore_recommendations():
    try:
        current_user_id = int(get_jwt_identity())
        current_user = db.get_or_404(User, current_user_id)

        own_posts = Post.query.filter_by(user_id=current_user_id).order_by(Post.created_at.desc()).limit(200).all()

        genre_counts: dict[str, int] = {}
        artist_counts: dict[str, int] = {}
        for p in own_posts:
            if p.genre:
                g = p.genre.strip()
                if g:
                    genre_counts[g] = genre_counts.get(g, 0) + 1
            if p.artist:
                a = p.artist.strip()
                if a:
                    artist_counts[a] = artist_counts.get(a, 0) + 1

        top_genres = [g for g, _ in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:6]]
        top_artists = [a for a, _ in sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)[:6]]

        followed_ids = [u.id for u in current_user.followed.limit(200).all()]

        rec_query = Post.query.filter(Post.user_id != current_user_id)

        should_filter = bool(followed_ids or top_genres or top_artists)
        if should_filter:
            filters = []
            if followed_ids:
                filters.append(Post.user_id.in_(followed_ids))
            if top_genres:
                filters.append(Post.genre.in_(top_genres))
            if top_artists:
                filters.append(Post.artist.in_(top_artists))
            rec_query = rec_query.filter(db.or_(*filters))

        candidate_posts = rec_query.order_by(Post.created_at.desc()).limit(120).all()

        because_you_liked = []
        seen_post_ids: set[int] = set()

        for p in candidate_posts:
            reason = None
            if p.artist and p.artist in top_artists:
                reason = f"Because you liked {p.artist}"
            elif p.genre and p.genre in top_genres:
                reason = f"Because you liked {p.genre}"

            if reason and p.id not in seen_post_ids:
                because_you_liked.append({
                    'reason': reason,
                    'post': p.to_dict(current_user_id=current_user_id),
                })
                seen_post_ids.add(p.id)

            if len(because_you_liked) >= 8:
                break

        candidate_genre_counts: dict[str, int] = {}
        candidate_artist_counts: dict[str, int] = {}
        for p in candidate_posts:
            if p.genre:
                candidate_genre_counts[p.genre] = candidate_genre_counts.get(p.genre, 0) + 1
            if p.artist:
                candidate_artist_counts[p.artist] = candidate_artist_counts.get(p.artist, 0) + 1

        genre_chips = [
            g for g, _ in sorted(candidate_genre_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        artist_chips = [
            a for a, _ in sorted(candidate_artist_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        return jsonify({
            'because_you_liked': because_you_liked,
            'genre_chips': genre_chips,
            'artist_chips': artist_chips,
        }), 200

    except Exception as e:
        app.logger.error(f'Explore recommendations error: {str(e)}')
        return jsonify({'error': 'Failed to load recommendations'}), 500


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


def _normalize_album_title_key(title: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', (title or '').lower()).strip()


def _normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', (value or ''))
    ascii_only = normalized.encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', ' ', ascii_only.lower()).strip()


def _tokenize_search_text(value: str) -> list[str]:
    return [token for token in _normalize_search_text(value).split() if token]


def _similarity_ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _field_match_score(query: str, query_tokens: list[str], candidate_field: str) -> float:
    candidate_norm = _normalize_search_text(candidate_field)
    if not candidate_norm:
        return 0.0

    score = 0.0
    if candidate_norm == query:
        score += 220.0
    elif candidate_norm.startswith(query):
        score += 170.0
    elif query and query in candidate_norm:
        score += 130.0

    candidate_tokens = candidate_norm.split()
    candidate_token_set = set(candidate_tokens)
    for token in query_tokens:
        if token in candidate_token_set:
            score += 26.0
            continue

        best_token_sim = max((_similarity_ratio(token, ct) for ct in candidate_tokens), default=0.0)
        if best_token_sim >= 0.92:
            score += 18.0
        elif best_token_sim >= 0.85:
            score += 10.0

    score += _similarity_ratio(query, candidate_norm) * 65.0
    return score


def _album_search_score_components(query: str, album: str, artist: str, track: str) -> dict[str, float]:
    query_norm = _normalize_search_text(query)
    query_tokens = _tokenize_search_text(query_norm)
    if not query_norm or not query_tokens:
        return {
            'album': 0.0,
            'artist': 0.0,
            'track': 0.0,
            'coverage': 0.0,
        }

    album_score = _field_match_score(query_norm, query_tokens, album)
    artist_score = _field_match_score(query_norm, query_tokens, artist)
    track_score = _field_match_score(query_norm, query_tokens, track)

    combined = " ".join(
        part for part in (
            _normalize_search_text(album),
            _normalize_search_text(artist),
            _normalize_search_text(track),
        ) if part
    )
    combined_tokens = set(combined.split())
    token_hits = sum(1 for token in query_tokens if token in combined_tokens)
    coverage = token_hits / max(len(query_tokens), 1)

    return {
        'album': album_score,
        'artist': artist_score,
        'track': track_score,
        'coverage': coverage,
    }


def _score_album_search_result(query: str, album: str, artist: str, track: str) -> float:
    components = _album_search_score_components(query, album, artist, track)
    album_score = components.get('album', 0.0)
    artist_score = components.get('artist', 0.0)
    track_score = components.get('track', 0.0)
    coverage = components.get('coverage', 0.0)

    weighted = (album_score * 1.55) + (artist_score * 1.25) + (track_score * 1.10)
    weighted += coverage * 95.0

    if album and _is_likely_single_or_ep(album):
        weighted -= 25.0

    return weighted


def _is_likely_single_or_ep(title: str) -> bool:
    name = (title or '').lower().strip()
    return ('single' in name) or bool(re.search(r'\bep\b', name))


def _is_likely_non_studio_album(title: str) -> bool:
    name = (title or '').lower().strip()
    non_studio_markers = [
        'live',
        'remix',
        'remixes',
        'karaoke',
        'instrumental',
        'acoustic',
        'greatest hits',
        'best of',
        'essentials',
        'anthology',
        'compilation',
        'mixtape',
        'soundtrack',
        'motion picture',
        'tribute',
    ]
    return any(marker in name for marker in non_studio_markers)


def _is_likely_studio_album_item(item: dict, strict_artist_name_lc: str = '') -> bool:
    if item.get('wrapperType') != 'collection':
        return False
    if (item.get('collectionType') or '').lower() != 'album':
        return False

    artist_name_lc = (item.get('artistName') or '').lower().strip()
    if strict_artist_name_lc and artist_name_lc and artist_name_lc != strict_artist_name_lc:
        return False

    collection_artist_lc = (item.get('collectionArtistName') or '').lower().strip()
    if collection_artist_lc == 'various artists':
        return False

    genre_lc = (item.get('primaryGenreName') or '').lower().strip()
    if genre_lc == 'compilations':
        return False

    album_name = item.get('collectionName', '') or ''
    if _is_likely_single_or_ep(album_name) or _is_likely_non_studio_album(album_name):
        return False

    track_count = item.get('trackCount')
    if track_count is not None:
        try:
            if int(track_count) <= 5:
                return False
        except (TypeError, ValueError):
            pass

    return True


def _fetch_artist_album_catalog(artist_query: str) -> list[dict]:
    """Fetch album-only catalog for an artist from iTunes lookup endpoint."""
    try:
        artist_resp = requests.get(
            'https://itunes.apple.com/search',
            params={
                'term': artist_query,
                'media': 'music',
                'entity': 'musicArtist',
                'limit': 8,
            },
            timeout=8,
        )
        if artist_resp.status_code != 200:
            return []

        candidates = artist_resp.json().get('results', [])
        query_lc = (artist_query or '').lower().strip()

        def _name_score(name: str) -> int:
            name_lc = (name or '').lower().strip()
            if name_lc == query_lc:
                return 3
            if query_lc in name_lc:
                return 2
            return 1

        candidates = sorted(candidates, key=lambda c: _name_score(c.get('artistName', '')), reverse=True)
        if not candidates:
            return []

        selected = candidates[0]
        artist_id = selected.get('artistId')
        selected_name_lc = (selected.get('artistName') or '').lower().strip()
        if not artist_id:
            return []

        lookup_resp = requests.get(
            'https://itunes.apple.com/lookup',
            params={
                'id': artist_id,
                'entity': 'album',
                'limit': 200,
            },
            timeout=8,
        )
        if lookup_resp.status_code != 200:
            return []

        albums = []
        seen = set()
        for item in lookup_resp.json().get('results', []):
            if not _is_likely_studio_album_item(item, strict_artist_name_lc=selected_name_lc):
                continue

            album_name = item.get('collectionName', '')

            key = _normalize_album_title_key(album_name)
            if not key or key in seen:
                continue
            seen.add(key)

            albums.append({
                'track_title': '',
                'artist': item.get('artistName', ''),
                'album': album_name,
                'album_art_url': (item.get('artworkUrl100') or '').replace('100x100', '500x500'),
                'preview_url': '',
                'genre': item.get('primaryGenreName', ''),
                'track_id': item.get('collectionId'),
            })

        return sorted(albums, key=lambda a: (a.get('album') or '').lower())
    except Exception:
        return []


@app.route('/api/collection/artist-progress', methods=['GET'])
@jwt_required()
def collection_artist_progress():
    """Summary progress for artists in a user's collection."""
    try:
        current_user_id = int(get_jwt_identity())
        user_id = request.args.get('user_id', type=int) or current_user_id
        limit = request.args.get('limit', 12, type=int) or 12
        limit = max(1, min(limit, 50))

        items = CollectionItem.query.filter_by(user_id=user_id).all()
        artists: dict[str, list[CollectionItem]] = {}
        for item in items:
            artist_name = (item.artist or '').strip()
            if not artist_name:
                continue
            artists.setdefault(artist_name, []).append(item)

        ranked = sorted(artists.items(), key=lambda kv: len(kv[1]), reverse=True)[:limit]

        payload = []
        for artist_name, artist_items in ranked:
            owned_keys = {
                _normalize_album_title_key(i.album_title)
                for i in artist_items
                if _normalize_album_title_key(i.album_title)
            }

            catalog = _fetch_artist_album_catalog(artist_name)
            catalog_keys = {
                _normalize_album_title_key(a.get('album', ''))
                for a in catalog
                if _normalize_album_title_key(a.get('album', ''))
            }

            if catalog_keys:
                owned_count = sum(1 for k in owned_keys if k in catalog_keys)
                total_known = len(catalog_keys)
                missing_preview = [
                    a.get('album', '')
                    for a in catalog
                    if _normalize_album_title_key(a.get('album', '')) not in owned_keys
                ][:3]
            else:
                owned_count = len(owned_keys)
                total_known = len(owned_keys)
                missing_preview = []

            completion_pct = int(round((owned_count / total_known) * 100)) if total_known > 0 else 0
            payload.append({
                'artist': artist_name,
                'owned_count': owned_count,
                'total_known': total_known,
                'missing_count': max(total_known - owned_count, 0),
                'completion_pct': completion_pct,
                'missing_preview': missing_preview,
            })

        payload.sort(key=lambda x: (x['completion_pct'], -x['total_known']))
        return jsonify(payload), 200
    except Exception as e:
        app.logger.error(f'Collection artist progress error: {str(e)}')
        return jsonify({'error': 'Failed to load artist progress'}), 500


@app.route('/api/collection/artist-progress/details', methods=['GET'])
@jwt_required()
def collection_artist_progress_details():
    """Detailed progress for one artist, including missing albums."""
    try:
        current_user_id = int(get_jwt_identity())
        user_id = request.args.get('user_id', type=int) or current_user_id
        artist = (request.args.get('artist', '') or '').strip()
        if not artist:
            return jsonify({'error': 'artist is required'}), 400

        artist_items = CollectionItem.query.filter_by(user_id=user_id).all()
        artist_items = [
            i for i in artist_items
            if (i.artist or '').strip().lower() == artist.lower()
        ]

        owned_keys = {
            _normalize_album_title_key(i.album_title)
            for i in artist_items
            if _normalize_album_title_key(i.album_title)
        }
        owned_albums = sorted({i.album_title for i in artist_items if i.album_title})

        catalog = _fetch_artist_album_catalog(artist)
        catalog_keys = {
            _normalize_album_title_key(a.get('album', ''))
            for a in catalog
            if _normalize_album_title_key(a.get('album', ''))
        }

        missing_albums = [
            a for a in catalog
            if _normalize_album_title_key(a.get('album', '')) not in owned_keys
        ]

        total_known = len(catalog_keys) if catalog_keys else len(owned_keys)
        owned_count = sum(1 for k in owned_keys if (k in catalog_keys if catalog_keys else True))
        completion_pct = int(round((owned_count / total_known) * 100)) if total_known > 0 else 0

        return jsonify({
            'artist': artist,
            'owned_count': owned_count,
            'total_known': total_known,
            'completion_pct': completion_pct,
            'owned_albums': owned_albums,
            'missing_albums': missing_albums,
        }), 200
    except Exception as e:
        app.logger.error(f'Collection artist progress details error: {str(e)}')
        return jsonify({'error': 'Failed to load artist details'}), 500


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
    albums_only = request.args.get('albums_only', 'false').lower() in ('1', 'true', 'yes')
    if not q:
        return jsonify([])
    try:
        encoded = urllib.parse.quote(q)
        source_items = []
        selected_artist_name = q.lower().strip()

        if albums_only:
            # Build a more complete discography by resolving artist first, then looking up albums.
            artist_search_url = f'https://itunes.apple.com/search?term={encoded}&media=music&entity=musicArtist&limit=8'
            with urllib.request.urlopen(artist_search_url, timeout=5) as response:
                artist_data = json_lib.loads(response.read())

            artist_candidates = artist_data.get('results', [])
            query_lc = q.lower().strip()

            def _name_score(item_name: str) -> int:
                name_lc = (item_name or '').lower().strip()
                if name_lc == query_lc:
                    return 3
                if query_lc in name_lc:
                    return 2
                return 1

            artist_candidates = sorted(
                artist_candidates,
                key=lambda a: _name_score(a.get('artistName', '')),
                reverse=True
            )

            artist_id = artist_candidates[0].get('artistId') if artist_candidates else None
            selected_artist_name = (artist_candidates[0].get('artistName', '') if artist_candidates else q).lower().strip()

            if artist_id:
                lookup_url = f'https://itunes.apple.com/lookup?id={artist_id}&entity=album&limit=200'
                with urllib.request.urlopen(lookup_url, timeout=6) as response:
                    lookup_data = json_lib.loads(response.read())
                source_items = lookup_data.get('results', [])

                source_items = [
                    item for item in source_items
                    if _is_likely_studio_album_item(item, strict_artist_name_lc=selected_artist_name)
                ]

            if not source_items:
                # Fallback: standard album search if lookup cannot resolve artist.
                fallback_url = f'https://itunes.apple.com/search?term={encoded}&media=music&limit=40&entity=album'
                with urllib.request.urlopen(fallback_url, timeout=5) as response:
                    fallback_data = json_lib.loads(response.read())
                source_items = fallback_data.get('results', [])
        else:
            # Build richer candidates so album, artist, and song-intent queries surface better album matches.
            ranked_candidates: dict[tuple[str, str], dict] = {}

            def _upsert_candidate(item: dict, source: str):
                album_name = (item.get('collectionName') or '').strip()
                artist_name = (item.get('artistName') or '').strip()
                if not album_name or not artist_name:
                    return

                collection_id = item.get('collectionId') or item.get('trackId')
                track_title = (item.get('trackName') or '').strip()
                artist_key = _normalize_search_text(artist_name)
                album_key = _normalize_album_title_key(album_name)
                if not album_key:
                    return

                key = (album_key, artist_key)
                components = _album_search_score_components(q, album_name, artist_name, track_title)
                score = _score_album_search_result(q, album_name, artist_name, track_title)
                if source == 'album':
                    score += 20.0
                elif source == 'artist_lookup':
                    score += 12.0
                elif source == 'song':
                    score += 8.0

                field_scores = {
                    'album': components.get('album', 0.0),
                    'artist': components.get('artist', 0.0),
                    'track': components.get('track', 0.0),
                }
                matched_on = max(field_scores, key=field_scores.get)
                if field_scores.get(matched_on, 0.0) <= 0:
                    matched_on = 'album'

                if matched_on == 'artist':
                    match_reason = f"Matched artist: {artist_name}"
                elif matched_on == 'track' and track_title:
                    match_reason = f"Matched song: {track_title}"
                else:
                    match_reason = f"Matched album: {album_name}"

                candidate = {
                    'track_title': track_title,
                    'artist': artist_name,
                    'album': album_name,
                    'album_art_url': (item.get('artworkUrl100') or '').replace('100x100', '500x500'),
                    'preview_url': item.get('previewUrl', ''),
                    'genre': item.get('primaryGenreName', ''),
                    'track_id': collection_id,
                    '_score': score,
                    '_source': source,
                    '_matched_on': matched_on,
                    '_match_reason': match_reason,
                }

                existing = ranked_candidates.get(key)
                if not existing or score > existing.get('_score', 0):
                    ranked_candidates[key] = candidate

            album_resp = requests.get(
                'https://itunes.apple.com/search',
                params={'term': q, 'media': 'music', 'limit': 40, 'entity': 'album'},
                timeout=8,
            )
            if album_resp.status_code == 200:
                for item in album_resp.json().get('results', []):
                    _upsert_candidate(item, 'album')

            song_resp = requests.get(
                'https://itunes.apple.com/search',
                params={'term': q, 'media': 'music', 'limit': 45, 'entity': 'song'},
                timeout=8,
            )
            if song_resp.status_code == 200:
                for item in song_resp.json().get('results', []):
                    _upsert_candidate(item, 'song')

            artist_resp = requests.get(
                'https://itunes.apple.com/search',
                params={'term': q, 'media': 'music', 'entity': 'musicArtist', 'limit': 5},
                timeout=8,
            )
            artist_results = artist_resp.json().get('results', []) if artist_resp.status_code == 200 else []
            artist_results = sorted(
                artist_results,
                key=lambda a: _field_match_score(
                    _normalize_search_text(q),
                    _tokenize_search_text(q),
                    a.get('artistName', ''),
                ),
                reverse=True,
            )[:3]

            for artist_item in artist_results:
                artist_id = artist_item.get('artistId')
                if not artist_id:
                    continue
                lookup_resp = requests.get(
                    'https://itunes.apple.com/lookup',
                    params={'id': artist_id, 'entity': 'album', 'limit': 120},
                    timeout=8,
                )
                if lookup_resp.status_code != 200:
                    continue
                for item in lookup_resp.json().get('results', []):
                    if item.get('wrapperType') != 'collection':
                        continue
                    if (item.get('collectionType') or '').lower() != 'album':
                        continue
                    _upsert_candidate(item, 'artist_lookup')

            source_items = sorted(
                ranked_candidates.values(),
                key=lambda r: (-r.get('_score', 0), (r.get('album') or '').lower(), (r.get('artist') or '').lower()),
            )[:30]

        results = []
        seen_collection_ids = set()
        for item in source_items:
            collection_id = item.get('track_id') if '_score' in item else item.get('collectionId')
            if collection_id is not None:
                if collection_id in seen_collection_ids:
                    continue
                seen_collection_ids.add(collection_id)

            album_name = item.get('album') if '_score' in item else (item.get('collectionName', '') or '')
            if albums_only and not _is_likely_studio_album_item(item, strict_artist_name_lc=selected_artist_name):
                continue

            results.append({
                'track_title': item.get('track_title', ''),
                'artist': item.get('artist') if '_score' in item else item.get('artistName', ''),
                'album': album_name,
                'album_art_url': (item.get('album_art_url') if '_score' in item else item.get('artworkUrl100', '')).replace('100x100', '500x500'),
                'preview_url': item.get('preview_url', ''),
                'genre': item.get('genre') if '_score' in item else item.get('primaryGenreName', ''),
                'track_id': collection_id,
                'matched_on': item.get('_matched_on', 'album') if '_score' in item else 'album',
                'match_reason': item.get('_match_reason', f"Matched album: {album_name}") if '_score' in item else f"Matched album: {album_name}",
                'match_source': item.get('_source', 'album') if '_score' in item else 'album',
            })

        if albums_only:
            # Keep deterministic ordering for discography completeness tracking.
            results = sorted(results, key=lambda r: (r.get('album') or '').lower())

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

# Minimum time between Spotify syncs per user (5 minutes)
_SPOTIFY_SYNC_MIN_INTERVAL_SECONDS = 300

def sync_spotify_history():
    '''Runs periodically to fetch and sync users' Spotify history so they don't have to keep the app open.'''
    with app.app_context():
        cutoff = datetime.utcnow() - timedelta(seconds=_SPOTIFY_SYNC_MIN_INTERVAL_SECONDS)
        # Only sync users whose token hasn't been checked recently
        users = User.query.filter(
            User.spotify_refresh_token.isnot(None),
            User.spotify_refresh_token != '',
            db.or_(
                User.last_synced_at.is_(None),
                User.last_synced_at < cutoff,
            )
        ).all()
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
            finally:
                # Always stamp last_synced_at so we don't hammer failing users
                try:
                    user.last_synced_at = datetime.utcnow()
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            # end try
            # Note: the outer try/except is now replaced by finally above
            # Kept here for legacy; original except block converted to finally

def cleanup_expired_password_reset_codes():
    """Delete used or expired PasswordResetCode records older than 1 day."""
    with app.app_context():
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=1)
            deleted = PasswordResetCode.query.filter(
                db.or_(
                    PasswordResetCode.used == True,
                    PasswordResetCode.expires_at < cutoff,
                )
            ).delete(synchronize_session=False)
            if deleted:
                db.session.commit()
                app.logger.info(f"[Cleanup] Deleted {deleted} expired password reset codes.")
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"[Cleanup] Failed to delete reset codes: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(
    func=sync_spotify_history,
    trigger=IntervalTrigger(minutes=1),
    id='spotify_history_sync',
    replace_existing=True,
    next_run_time=datetime.utcnow()
)
scheduler.add_job(
    func=cleanup_expired_password_reset_codes,
    trigger=IntervalTrigger(hours=6),
    id='password_reset_cleanup',
    replace_existing=True,
)
scheduler.start()


def send_reset_email(to_email, reset_code):
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', 465))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASSWORD')

    if not smtp_user or not smtp_pass:
        app.logger.warning(f"Email credentials not set. Would have sent code {reset_code} to {to_email}")
        return True # Pretend it succeeded in dev

    msg = EmailMessage()
    msg.set_content(f"Your password reset code is: {reset_code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.")
    msg['Subject'] = "Password Reset Code - musicshare"
    msg['From'] = smtp_user
    msg['To'] = to_email

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True
    except Exception as e:
        app.logger.error(f"Failed to send email to {to_email}: {e}")
        return False

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        user = User.query.filter(User.email.ilike(email)).first()
        if not user:
            # Return success to prevent email enumeration attacks
            return jsonify({'message': 'If an account exists, a code has been sent.'}), 200

        # Generate a 6-digit code
        reset_code = ''.join(random.choices(string.digits, k=6))
        expires = datetime.now(timezone.utc) + timedelta(minutes=15)

        # Invalidate old unused codes
        PasswordResetCode.query.filter_by(user_id=user.id, used=False).update({'used': True})

        record = PasswordResetCode(user_id=user.id, code=reset_code, expires_at=expires)
        db.session.add(record)
        db.session.commit()

        # Send it
        success = send_reset_email(user.email, reset_code)
        if not success:
            return jsonify({'error': 'Failed to send email. Please try again later.'}), 500

        return jsonify({'message': 'If an account exists, a code has been sent.'}), 200

    except Exception as e:
        app.logger.error(f"Forgot password error: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()
        new_password = data.get('new_password', '')

        if not all([email, code, new_password]):
            return jsonify({'error': 'Email, code, and new password are required'}), 400

        user = User.query.filter(User.email.ilike(email)).first()
        if not user:
            return jsonify({'error': 'Invalid email or code'}), 400

        # Find valid code
        reset_record = PasswordResetCode.query.filter(
            PasswordResetCode.user_id == user.id,
            PasswordResetCode.code == code,
            PasswordResetCode.used == False,
            PasswordResetCode.expires_at > datetime.now(timezone.utc)
        ).first()

        if not reset_record:
            return jsonify({'error': 'Invalid or expired code'}), 400

        # Validate new password
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        # Apply reset
        user.set_password(new_password)
        reset_record.used = True
        db.session.commit()

        return jsonify({'message': 'Password successfully reset. You can now log in.'}), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Reset password error: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500


# ─── Administrative Endpoints ───────────────────────────────────────────────────

@app.route('/api/admin/stats', methods=['GET'])
@admin_required()
def admin_stats():
    """General app usage statistics for the admin dashboard."""
    user_count = User.query.count()
    post_count = Post.query.count()
    comment_count = Comment.query.count()
    
    # Last 24 hours
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    new_users_24h = User.query.filter(User.created_at >= since_24h).count()
    new_posts_24h = Post.query.filter(Post.created_at >= since_24h).count()
    
    # Service linked counts
    spotify_linked = User.query.filter(User.spotify_access_token != '').count()
    youtube_linked = User.query.filter(User.youtube_access_token != '').count()
    
    return jsonify({
        'users': user_count,
        'posts': post_count,
        'comments': comment_count,
        'new_users_24h': new_users_24h,
        'new_posts_24h': new_posts_24h,
        'linked_services': {
            'spotify': spotify_linked,
            'youtube': youtube_linked
        }
    })

@app.route('/api/admin/users', methods=['GET'])
@admin_required()
def admin_get_users():
    """List users for management (supports optional search + pagination)."""
    q = request.args.get('q', '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('per_page', 200))))

    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.display_name.ilike(like),
                User.email.ilike(like),
            )
        )

    users_paginated = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'items': [u.to_dict() for u in users_paginated.items],
        'total': users_paginated.total,
        'page': page,
        'pages': users_paginated.pages,
        'has_next': users_paginated.has_next,
    })

@app.route('/api/admin/users/<int:user_id>/ban', methods=['POST'])
@admin_required()
@limiter.limit('120 per hour; 20 per minute')
def admin_toggle_ban(user_id):
    """Ban/unban a user."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    user.is_banned = not user.is_banned
    db.session.commit()
    return jsonify({
        'message': f'User {"banned" if user.is_banned else "unbanned"} successfully',
        'is_banned': user.is_banned
    })

@app.route('/api/admin/users/<int:user_id>/admin', methods=['POST'])
@admin_required()
@limiter.limit('120 per hour; 20 per minute')
def admin_toggle_admin(user_id):
    """Promote/demote a user to/from admin."""
    # Prevent self-demotion
    current_admin_id = int(get_jwt_identity())
    if current_admin_id == user_id:
        return jsonify({'error': 'Cannot change your own admin status'}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    user.is_admin = not user.is_admin
    db.session.commit()
    return jsonify({
        'message': f'User {"promoted to" if user.is_admin else "demoted from"} admin successfully',
        'is_admin': user.is_admin
    })

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required()
def admin_edit_user(user_id):
    """Edit user basic details."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    data = request.json
    if 'username' in data:
        check = User.query.filter(User.username == data['username'], User.id != user_id).first()
        if check:
            return jsonify({'error': 'Username already taken'}), 400
        user.username = data['username']
        
    if 'email' in data:
        check = User.query.filter(User.email == data['email'], User.id != user_id).first()
        if check:
            return jsonify({'error': 'Email already taken'}), 400
        user.email = data['email']
        
    if 'display_name' in data:
        user.display_name = data['display_name']
    
    if 'bio' in data:
        user.bio = data['bio']

    if 'password' in data and data['password'].strip():
        user.set_password(data['password'].strip())

    try:
        db.session.commit()
        return jsonify(user.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user', 'details': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required()
def admin_delete_user(user_id):
    """Permanently delete a user and their data."""
    current_admin_id = int(get_jwt_identity())
    if current_admin_id == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    try:
        # Simplified deletion utilizing cascades. 
        # For full robust deletion, explicit mapping would be required.
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(str(e))
        return jsonify({'error': 'Failed to delete user. Please ensure all relations cascade or unlink first.'}), 500


def _admin_serialize_post(post: Post) -> dict:
    return {
        'id': post.id,
        'user_id': post.user_id,
        'author_username': post.author.username if post.author else None,
        'author_display_name': post.author.display_name if post.author else None,
        'track_title': post.track_title,
        'artist': post.artist,
        'album': post.album,
        'caption': post.caption,
        'post_type': post.post_type,
        'genre': post.genre,
        'likes_count': post.liked_by.count(),
        'comments_count': Comment.query.filter_by(post_id=post.id).count(),
        'created_at': (post.created_at.isoformat() + 'Z' if post.created_at and post.created_at.tzinfo is None else (post.created_at.isoformat() if post.created_at else None)),
    }


@app.route('/api/admin/posts', methods=['GET'])
@admin_required()
def admin_get_posts():
    """List posts for moderation with optional search + pagination."""
    q = request.args.get('q', '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('per_page', 50))))

    query = Post.query.join(User, Post.user_id == User.id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Post.track_title.ilike(like),
                Post.artist.ilike(like),
                Post.caption.ilike(like),
                Post.album.ilike(like),
                User.username.ilike(like),
                User.display_name.ilike(like),
            )
        )

    paginated = query.order_by(Post.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'items': [_admin_serialize_post(p) for p in paginated.items],
        'total': paginated.total,
        'page': page,
        'pages': paginated.pages,
        'has_next': paginated.has_next,
    })


@app.route('/api/admin/posts/<int:post_id>', methods=['DELETE'])
@admin_required()
@limiter.limit('180 per hour; 30 per minute')
def admin_delete_post(post_id):
    """Delete a post as an admin moderation action."""
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    db.session.delete(post)
    db.session.commit()
    return jsonify({'message': 'Post deleted successfully'})


@app.route('/api/admin/database/summary', methods=['GET'])
@admin_required()
def admin_database_summary():
    """Return read-only database visibility for admin dashboard."""
    table_models = [
        ('users', User),
        ('posts', Post),
        ('comments', Comment),
        ('notifications', Notification),
        ('collections', CollectionItem),
        ('post_reactions', PostReaction),
        ('listen_later_items', ListenLaterItem),
        ('collab_lists', CollabList),
        ('collab_list_tracks', CollabListTrack),
        ('weekly_recaps', WeeklyRecap),
    ]

    rows = []
    for name, model in table_models:
        rows.append({'table': name, 'rows': model.query.count()})

    uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    masked_uri = re.sub(r'://([^:/]+):([^@]+)@', r'://***:***@', uri) if uri else ''

    return jsonify({
        'engine': db.engine.dialect.name,
        'database_uri_masked': masked_uri,
        'tables': rows,
        'generated_at': datetime.now(timezone.utc).isoformat(),
    })






if __name__ == '__main__':
    with app.app_context():
        os.makedirs(os.path.join(_BASE_DIR, 'instance'), exist_ok=True)
        db.create_all()

    # Use environment variable for debug mode (default to False for security)
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 'yes')
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
