#!/usr/bin/env python3
"""
Merge DoED (Survey licenses extracted) + Niti Foundation datasets
into a single master CSV for seeding HPMS.

Usage:
  python merge_hydropower_datasets.py
"""

import csv
import pandas as pd
from pathlib import Path
from datetime import datetime

# File paths
DATA_DIR = Path(__file__).parent
NITI_FILE = DATA_DIR / "Niti Foundation Datasets.csv"
OUTPUT_FILE = DATA_DIR / "merged_hydropower_master.csv"

print("=" * 70)
print("HYDROPOWER DATA MERGER - DoED + Niti Foundation")
print("=" * 70)

# Load Niti Foundation data (you already have this)
print("\n[*] Loading Niti Foundation dataset...")
try:
    niti_df = pd.read_csv(NITI_FILE)
    print(f"  [OK] Loaded {len(niti_df)} projects from Niti")
    print(f"  Columns: {list(niti_df.columns)}")
except FileNotFoundError:
    print(f"  [ERROR] File not found: {NITI_FILE}")
    exit(1)

# Normalize Niti data
print("\n[*] Normalizing data...")
niti_df = niti_df.rename(columns={
    'Project': 'project_name',
    'Capacity (MW)': 'capacity_mw',
    'River': 'river',
    'Lic No': 'license_number',
    'Isuue Date': 'issue_date',
    'Validity': 'validity_date',
    'Promoter': 'promoter',
    'Address': 'address',
    'Latitude': 'latitude',
    'Longitude': 'longitude',
    'License Type': 'license_type',
    'Province': 'province',
    'District': 'district',
    'Municipality': 'municipality',
})

# Convert capacity to float BEFORE filtering
niti_df['capacity_mw'] = pd.to_numeric(niti_df['capacity_mw'], errors='coerce')

# Drop rows with missing project name or capacity
niti_df = niti_df.dropna(subset=['capacity_mw', 'project_name'])

print(f"  [OK] Cleaned {len(niti_df)} valid projects")
print(f"  License types: {niti_df['license_type'].value_counts().to_dict()}")

# Map license types to pipeline status
license_status_map = {
    'Survey': 'Proposal (Feasibility)',
    'Generation': 'Approved (Under Construction)',
    'Operation': 'Operational',
}

niti_df['pipeline_status'] = niti_df['license_type'].map(license_status_map)

# Add metadata
niti_df['data_source'] = 'Niti Foundation / DoED'
niti_df['sync_date'] = datetime.now().strftime('%Y-%m-%d')

# Final columns for output
output_columns = [
    'project_name',
    'capacity_mw',
    'river',
    'license_number',
    'license_type',
    'pipeline_status',
    'promoter',
    'address',
    'latitude',
    'longitude',
    'province',
    'district',
    'municipality',
    'issue_date',
    'validity_date',
    'data_source',
    'sync_date',
]

# Select and reorder
final_df = niti_df[[col for col in output_columns if col in niti_df.columns]]

# Save to CSV
print(f"\n[*] Saving merged dataset...")
final_df.to_csv(OUTPUT_FILE, index=False)
print(f"  [OK] Saved {len(final_df)} projects to:")
print(f"    {OUTPUT_FILE}")

# Summary statistics
print(f"\n[*] SUMMARY")
print(f"  Total projects: {len(final_df)}")
print(f"  Total capacity: {final_df['capacity_mw'].sum():.1f} MW")
print(f"\n  By License Type:")
for lic_type, count in final_df['license_type'].value_counts().items():
    capacity = final_df[final_df['license_type'] == lic_type]['capacity_mw'].sum()
    print(f"    {lic_type:20} {count:4} projects  {capacity:10,.0f} MW")

print(f"\n  By Province:")
for province, count in final_df['province'].value_counts().head(10).items():
    capacity = final_df[final_df['province'] == province]['capacity_mw'].sum()
    print(f"    {province:20} {count:4} projects  {capacity:10,.0f} MW")

print(f"\n[OK] Ready to seed! Upload {OUTPUT_FILE.name} to /api/v1/admin/seed-projects")
print("=" * 70)
