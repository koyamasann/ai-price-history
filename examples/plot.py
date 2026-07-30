#!/usr/bin/env python3
"""Plot a daily median price series from the public AICostIndex CSV."""

import csv
import sys
from collections import defaultdict
from pathlib import Path
from statistics import median

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
MODEL = sys.argv[1] if len(sys.argv) > 1 else "GPT-4o"
FIELD = sys.argv[2] if len(sys.argv) > 2 else "input"
OUTPUT = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "examples/price-history-example.svg"

series = defaultdict(list)
with (ROOT / "data/ai-prices.csv").open(newline="", encoding="utf-8") as source:
    for row in csv.DictReader(source):
        if row["model"] == MODEL and row["field"] == FIELD:
            series[row["date"]].append(float(row["usd"]))

if not series:
    raise SystemExit(f"No rows found for model={MODEL!r}, field={FIELD!r}")

dates = sorted(series)
values = [median(series[date]) for date in dates]

plt.figure(figsize=(9, 4.5))
plt.plot(dates, values, color="#f48120", linewidth=2)
plt.fill_between(dates, values, color="#f48120", alpha=0.12)
plt.title(f"{MODEL}: median USD {FIELD} price")
plt.xlabel("Verification date (UTC)")
plt.ylabel("USD per 1M tokens")
plt.grid(axis="y", alpha=0.25)
plt.xticks(dates[:: max(1, len(dates) // 8)], rotation=30, ha="right")
plt.tight_layout()
image_format = OUTPUT.suffix.removeprefix(".").lower() or "svg"
plt.savefig(OUTPUT, format=image_format, metadata={"Creator": "AICostIndex"})
print(OUTPUT)
