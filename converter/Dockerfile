FROM python:3.12-slim

# Install LibreOffice and required fonts for conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements from the converter folder and install dependencies
COPY converter/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code from the converter folder
COPY converter/ .

# Run Uvicorn. Render provides the PORT environment variable.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
