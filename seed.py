"""Root seed script forwarding to backend/seed.py for convenience."""
import os
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from seed import seed_data

if __name__ == "__main__":
    seed_data()

