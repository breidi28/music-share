# Gunicorn configuration loaded by default when "gunicorn" is run in this repo.
# Ensures the WSGI app is correctly referenced in the backend package.

# The Flask app object
wsgi_app = "backend.app:app"

# Bind to Railway port (Railway uses PORT env var, fallback to 8080)
import os
port = int(os.environ.get('PORT', 8080))
bind = f"0.0.0.0:{port}"

# Worker settings
workers = int(os.environ.get('WEB_CONCURRENCY', 2))
threads = int(os.environ.get('GUNICORN_THREADS', 2))

# Logging
loglevel = 'info'
accesslog = '-'
errorlog = '-'

# Graceful shutdown
timeout = 120

# Prevent gunicorn from reading a different config
raw_env = [f"PORT={port}"]
