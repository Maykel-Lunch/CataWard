# CataWard — Map Data Directory

This folder holds the data catalog (`sources.json`) and, once verified datasets
are obtained, the GeoJSON layer files used by the Sorsogon Hazard Map.

---

## Directory structure

```
assets/data/
├── sources.json              ← Data source catalog (always present; edit this first)
├── typhoon_hazard.geojson    ← ADD when PAGASA data is obtained
├── flood_hazard.geojson      ← ADD when MGB flood data is obtained
├── earthquake_faults.geojson ← ADD when PHIVOLCS fault data is obtained
├── landslide_hazard.geojson  ← ADD when MGB landslide data is obtained
├── tsunami_inundation.geojson← ADD when PHIVOLCS tsunami data is obtained
├── evacuation_centers.geojson← ADD when PDRRMO/DSWD data is obtained
└── hospitals.geojson         ← ADD when DOH HFR data is obtained
```

---

## How to add a verified dataset

1. **Obtain data from the authoritative source** listed in `sources.json`.
   - Do not use crowd-sourced, AI-generated, or unverified data.
   - Record the dataset title, source URL, and the date you accessed it.

2. **Convert to GeoJSON** if needed.
   - Shapefiles → GeoJSON: `ogr2ogr -f GeoJSON output.geojson input.shp`
   - KML → GeoJSON: `ogr2ogr -f GeoJSON output.geojson input.kml`
   - Keep the source's original attribute names. Do not rename classification fields.

3. **Place the file** in this directory with the exact filename the map expects
   (see directory structure above).

4. **Update `sources.json`**:
   - Change `"status": "unavailable"` → `"status": "available"`.
   - Fill in `"accessed": "YYYY-MM-DD"`.
   - Do not change `"source_organization"` or `"dataset_title"` unless the
     dataset actually changed.

5. **Serve the site over HTTP** (see root README) and verify the layer loads.
   - Open the map and click the hazard toggle.
   - Confirm the layer info panel shows the correct source and access date.
   - Confirm the "No data" badge changes to "Active".

6. **Commit the GeoJSON and the updated sources.json** together so the record
   and the data stay in sync.

---

## GeoJSON feature schema (expected by map.js)

The map reads arbitrary GeoJSON. The following `properties` keys are used for
display when present; all are optional:

| Property key    | Used for                     |
|-----------------|------------------------------|
| `name`          | Feature label in pop-up and list |
| `hazard_level`  | Alternative label (e.g. "High", "Low") |
| `description`   | Supplementary text in pop-up |
| `source`        | Source string shown in pop-up |

Keep all original source attributes; only the keys above are surfaced in the UI.

---

## Current data status (2026-09-27)

| Layer | Status | Reason |
|-------|--------|--------|
| Province boundary | ✅ Available | Inline GADM v4.1 simplified polygon (non-commercial use) |
| Typhoon hazard | ❌ Not yet available | PAGASA provincial storm-surge/wind hazard GeoJSON not found at a public endpoint |
| Flood hazard | ❌ Not yet available | MGB flood susceptibility shapefile not available for free download |
| Earthquake hazard | ❌ Not yet available | PHIVOLCS active fault KML requires GIS conversion and verification |
| Landslide hazard | ❌ Not yet available | MGB landslide susceptibility data not publicly downloadable in GeoJSON form |
| Tsunami hazard | ❌ Not yet available | PHIVOLCS tsunami inundation polygons for Sorsogon not found at a public endpoint |
| Evacuation centers | ❌ Not yet available | Must be requested from Sorsogon PDRRMO or DSWD Region V |
| Hospitals | ❌ Not yet available | DOH HFR web interface available; bulk GeoJSON export not confirmed |

---

## License notes

- **GADM boundary data**: non-commercial use only. See https://gadm.org/license.html.
- **PAGASA, PHIVOLCS, MGB data**: Philippine government data. Always check the
  agency's terms of use before redistribution.
- **OpenStreetMap / CARTO tiles**: ODbL for data; see https://carto.com/legal/
  for tile terms. Attribution is displayed in the map interface.

---

## What this data is NOT

- Real-time alerts or live hazard monitoring.
- A personalised risk assessment or guarantee of safety.
- An official evacuation order or emergency instruction.

Always direct users to follow current DRRMO, PAGASA, and PHIVOLCS instructions
in any actual emergency.
