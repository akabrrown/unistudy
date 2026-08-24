# Use the official Ollama image (has the server + models)
FROM ollama/ollama:0.3.6

# Install Python + needed libs
RUN apt-get update && apt-get install -y python3-pip poppler-utils tesseract-ocr libreoffice fonts-liberation fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Python script
COPY main.py .

# Expose both FastAPI (8000) and Ollama (11434)
EXPOSE 8000 11434

# Start Ollama, pull the model, then launch FastAPI
CMD ["sh", "-c", "\
  ollama serve & \
  sleep 5 && \
  ollama pull ${OLLAMA_MODEL:-phi3} && \
  uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
