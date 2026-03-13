web: cd backend && python3 -c "from app import db, app; app.app_context().push(); db.create_all()" && gunicorn app:app
