FROM python:3.11-slim

WORKDIR /app

# Install Stockfish binary
RUN apt-get update && apt-get install -y stockfish && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
