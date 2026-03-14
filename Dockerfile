FROM python:3.11-slim

WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install dependencies from the backend folder
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY backend/ .

# Ensure instance folder exists
RUN mkdir -p instance

# Add a script to run DB migrations and start Gunicorn properly
RUN echo '#!/bin/sh\npython -c "from app import db, app; app.app_context().push(); db.create_all()"\nexec gunicorn app:app --bind 0.0.0.0:${PORT:-5000}' > /start.sh
RUN chmod +x /start.sh

# Run the boot script
CMD ["/start.sh"]
