import os, socket, psycopg
from pathlib import Path
from urllib.parse import urlparse

# Load api/.env explicitly (works no matter where you run from)
env_path = Path(__file__).resolve().parents[1] / ".env"
assert env_path.exists(), f".env not found at: {env_path}"
# Minimal loader (no extra deps needed)
for line in env_path.read_text(encoding="utf-8").splitlines():
    if line.strip().startswith("DATABASE_URL="):
        os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()

url = os.getenv("DATABASE_URL")
assert url, "DATABASE_URL not set in .env"

# Show parsed host to catch hidden-character issues
u = urlparse(url)
host = u.hostname
assert host, f"Could not parse host from URL: {url!r}"
print("Parsed host:", host)

# DNS sanity
socket.getaddrinfo(host, 5432)
print("DNS OK")

with psycopg.connect(url) as conn, conn.cursor() as cur:
    cur.execute("select count(*) from prizes;")
    print("prize_count =", cur.fetchone()[0])
