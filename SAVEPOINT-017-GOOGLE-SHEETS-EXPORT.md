# Savepoint 017 — Google Sheets CSV Export (682 Leads)

**Date:** September 22, 2026  
**Repository:** [osasbenny/AUREUM-CAP-V0.1](https://github.com/osasbenny/AUREUM-CAP-V0.1.git)  
**Status:** Created export script (`scripts/export-leads-csv.mjs`) generating `data/all-682-leads-export.csv` containing all **682 leads** formatted specifically for direct import into Google Sheets (`https://docs.google.com/spreadsheets/d/1eexclQS170Mtylt8NzHQlobOzqxbW-FkFfdi0_5zR8E/edit`).

---

## 1. Export Summary
- **Total Leads Exported:** 682 records.
- **File Path:** `C:\AUREUM-CAP-V0.1\data\all-682-leads-export.csv`
- **Columns Included:** ID, Business Name, Category, Location, Phone, Email, Website, Website Status, Email Status, Stage.

---

## 2. Instructions for Google Sheets Import
1. Open your Google Sheet: [Link](https://docs.google.com/spreadsheets/d/1eexclQS170Mtylt8NzHQlobOzqxbW-FkFfdi0_5zR8E/edit)
2. Go to **File > Import**.
3. Upload or select `all-682-leads-export.csv` from `C:\AUREUM-CAP-V0.1\data\`.
4. Choose **Replace spreadsheet** or **Append to current sheet** and click **Import data**.

---

## 3. Verification Results
```json
{
  "total_exported": 682,
  "format": "CSV",
  "target_google_sheet": "https://docs.google.com/spreadsheets/d/1eexclQS170Mtylt8NzHQlobOzqxbW-FkFfdi0_5zR8E/edit",
  "status": "READY_FOR_IMPORT"
}
```
