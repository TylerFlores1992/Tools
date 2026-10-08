# Counts overnight camping reservations per facility in Recreation.gov's historical reservation
# data (RIDB, ridb.recreation.gov/download), for ordering the waves by demand (population.mjs).
#
#   curl -O https://ridb.recreation.gov/downloads/reservations2025.zip      (FY2025, 487 MB)
#   unzip -p reservations2025.zip | python3 -I studio/campground-maps/reservations-count.py counts-fy25.json
#
# The file has one row per reservation, with customer ZIP codes among its columns. Only the
# inventory type, use type and facility id are read, and only per-facility totals are written:
# { "rows", "inventorytypes", "usetypes", "facilities": { facilityId: reservations } }.
import csv, collections, io, json, sys

reader = csv.DictReader(io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace", newline=""))
per = collections.Counter(); inv = collections.Counter(); use = collections.Counter(); rows = 0
for row in reader:
    rows += 1
    inv[row["inventorytype"]] += 1
    if row["inventorytype"] != "CAMPING":
        continue
    use[row["usetype"]] += 1
    if row["usetype"] == "Overnight":
        per[row["facilityid"]] += 1
json.dump({"rows": rows, "inventorytypes": inv.most_common(20), "usetypes": use.most_common(10), "facilities": dict(per)}, open(sys.argv[1], "w"))
print(f"{rows} rows; {len(per)} facilities with overnight camping reservations; {sum(per.values())} reservations")
