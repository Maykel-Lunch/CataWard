# FINAL_TERM — CataWard
This repository serves as the final project for IT-112 (Web Systems and Technology). It aims to provide valuable tips on disaster preparedness and provide guidance on actions to be taken before, during, and after disasters occur.

<Project-Information>
    This repo implements a content-based folder structure for the overall arrangement of the files<br> <br>
	Group Members:

-  Christopher James Sayson
-  Michael N. Lonceras
-  Valerie Soreda
-  John Russel Soreda
  
</Project-Information>

---

## Sorsogon Hazard Map

An interactive disaster-readiness map for Sorsogon Province, Philippines, integrated into
the CataWard site. It provides hazard layer toggles (Typhoon, Flood, Earthquake, Landslide,
Tsunami), a municipality/city selector, emergency contacts, and links back to each existing
hazard preparedness guide.

### How to run the site locally

The site is plain HTML/CSS/JS with no build step. However, because `map.js` fetches
`assets/data/sources.json` via the `fetch()` API, the page **must be served over HTTP**
(not opened directly from the filesystem via `file://`).

**Option 1 — Python (simplest, no installation needed on most systems)**

```bash
cd "Final_Project - CataWard"
python3 -m http.server 8080
```
Then open http://localhost:8080 in a browser.

**Option 2 — Node.js `npx serve`**

```bash
cd "Final_Project - CataWard"
npx serve .
```

**Option 3 — VS Code Live Server extension**
Right-click `index.html` → "Open with Live Server".

> ⚠️ Opening HTML files directly via `file://` will cause `fetch()` to fail with a CORS
> error and the hazard layer info will not load.

---

### Map datasets — authoritative sources

All dataset information is also recorded in
`Final_Project - CataWard/assets/data/sources.json`
and `Final_Project - CataWard/assets/data/README.md`.

| Layer | Status | Source | URL |
|-------|--------|--------|-----|
| Province boundary | ✅ Included | GADM v4.1, non-commercial | https://gadm.org/ |
| OSM basemap tiles | ✅ Included | OpenStreetMap / CARTO Positron | https://carto.com/attributions |
| Typhoon hazard polygons | ❌ Not yet available | PAGASA | https://bagong.pagasa.dost.gov.ph/ |
| Flood susceptibility | ❌ Not yet available | MGB / DENR | https://mgb.gov.ph/ |
| Earthquake / fault lines | ❌ Not yet available | PHIVOLCS | https://www.phivolcs.dost.gov.ph/ |
| Landslide susceptibility | ❌ Not yet available | MGB / DENR | https://mgb.gov.ph/ |
| Tsunami inundation | ❌ Not yet available | PHIVOLCS | https://www.phivolcs.dost.gov.ph/ |
| Evacuation centers | ❌ Not yet available | Sorsogon PDRRMO / DSWD Region V | Contact LGU |
| Hospitals | ❌ Not yet available | DOH Health Facility Registry | https://hfr.doh.gov.ph/ |

Emergency contact numbers are sourced from NDRRMC and agency websites as of 2026-09-27.
Local Sorsogon LGU numbers were not independently verified and are marked as such.

---

### Data that remains unavailable or unverified

All five hazard layers (Typhoon, Flood, Earthquake, Landslide, Tsunami) and both point
layers (Evacuation Centers, Hospitals) are currently **not populated**. The map clearly
shows each as "No data" and explains what authoritative source is needed. This is
intentional — no fabricated or approximate data has been substituted.

Reasons each layer is unavailable:
- **PAGASA** provincial storm-surge/typhoon hazard maps for Sorsogon were not available
  as a publicly downloadable GeoJSON/shapefile endpoint as of 2026-09-27.
- **MGB** (flood & landslide) publishes hazard maps but does not provide a public
  GeoJSON download for individual provinces; data must be requested from Regional Office V.
- **PHIVOLCS** (earthquake faults & tsunami) publishes PDFs and KML files; these require
  GIS conversion and licensing verification before inclusion.
- **PDRRMO / DSWD** evacuation center lists change frequently and require direct request
  from the Sorsogon Provincial DRRM Office to ensure accuracy.
- **DOH HFR** hospital data is accessible via a web interface but bulk GeoJSON export
  was not confirmed as of 2026-09-27.

---

### How to safely update or add a dataset

See `Final_Project - CataWard/assets/data/README.md` for step-by-step instructions.

Summary:
1. Obtain the dataset from the authoritative source listed in `sources.json`.
2. Convert to GeoJSON if needed (use `ogr2ogr`).
3. Place the file in `assets/data/` with the expected filename.
4. Update `sources.json`: set `"status": "available"` and fill in `"accessed"`.
5. Serve locally (see above) and verify the layer loads correctly.
6. Commit the GeoJSON and updated `sources.json` together.

---

### Current limitations

- **All hazard layer data is absent** pending authoritative source acquisition.
- The province boundary shown is a **simplified GADM polygon** for reference only;
  it is not a precise cadastral or administrative boundary.
- The municipality selector uses **approximate town-centre coordinates** from
  OpenStreetMap Nominatim (2026-09-27); they are for navigation convenience only.
- **No data is real-time or live.** The map does not connect to PAGASA, PHIVOLCS,
  or any live alert feed. When hazard data is added it will still be static/historical
  unless a verified live API endpoint is explicitly integrated.
- The site has no backend; all data is loaded as static files via `fetch()`.
- Geolocation is opt-in and positions are never stored or transmitted.
