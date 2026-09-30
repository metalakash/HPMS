#!/usr/bin/env python3
"""
Direct seeding script: authenticate and upload CSV to seed-projects endpoint.
"""
import requests
import sys
from pathlib import Path

# Configuration
API_BASE = "https://hpms-api.onrender.com"
LOGIN_URL = f"{API_BASE}/api/v1/auth/login"
SEED_URL = f"{API_BASE}/api/v1/admin/seed-projects"
CSV_FILE = Path("C:/Users/ACER/HPMS/backend/data/Niti Foundation Datasets.csv")

print("=" * 70)
print("HPMS Seed Data Upload")
print("=" * 70)

# Step 1: Login as admin
print("\n[1/3] Authenticating as admin...")
try:
    login_response = requests.post(
        LOGIN_URL,
        json={"username": "admin", "password": "admin123"},
        timeout=30
    )
    login_response.raise_for_status()
    resp_json = login_response.json()
    # Token is at top level, not nested
    token = resp_json.get("access_token")
    if not token:
        print("  ERROR: No token in response")
        print(f"  Full response: {resp_json}")
        sys.exit(1)
    print(f"  OK: Authenticated, token: {token[:20]}...")
except Exception as e:
    print(f"  ERROR: Login failed: {e}")
    sys.exit(1)

# Step 2: Verify CSV file
print("\n[2/3] Checking CSV file...")
if not CSV_FILE.exists():
    print(f"  ERROR: File not found: {CSV_FILE}")
    sys.exit(1)
file_size = CSV_FILE.stat().st_size / (1024 * 1024)  # MB
print(f"  OK: File exists ({file_size:.1f} MB)")

# Step 3: Upload CSV
print("\n[3/3] Uploading projects...")
try:
    headers = {
        "Authorization": f"Bearer {token}"
    }
    with open(CSV_FILE, "rb") as f:
        files = {"file": f}
        params = {"limit": 572}
        response = requests.post(
            SEED_URL,
            headers=headers,
            files=files,
            params=params,
            timeout=60
        )

    print(f"  Response: {response.status_code}")
    if response.status_code == 201:
        data = response.json().get("data", {})
        inserted = data.get("inserted", 0)
        print(f"  OK: {inserted} projects seeded!")
        print(f"\nResponse: {response.json()}")
    else:
        print(f"  ERROR: {response.status_code}")
        print(f"  {response.text[:500]}")
        sys.exit(1)
except Exception as e:
    print(f"  ERROR: Upload failed: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("SUCCESS! Refresh https://hpms-web.vercel.app/projects to see data")
print("=" * 70)
