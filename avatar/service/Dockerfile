# Avatar options service for ftc-embeds.com (see README.md). Built and started by scripts/avatars.sh.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# DejaVu fonts for the comparison sheet in the zip (campaign.py falls back to a tiny default font)
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY service.py campaign.py subject.py ./
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/avatar/health', timeout=2)"]
CMD ["python", "service.py"]
