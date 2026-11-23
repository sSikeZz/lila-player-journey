# Architecture

## Stack and why

| Layer | Choice | Why |
|---|---|---|
| Data pipeline | **Python + pyarrow** (offline, one script) | The input is parquet. pyarrow reads it natively. The full dataset (89k rows) processes in about 4 s, so a database or server isn't needed. |
| Data format | **Static, compact JSON**, one file per map | 2 MB total (~450 KB gzipped for the largest map). The browser loads one map at a time and caches it. Hosting needs nothing beyond a CDN. |
| Frontend | **React + TypeScript + Vite** | React holds the filter/UI state. TypeScript keeps the flattened data arrays honest. Vite builds in under 1 s. |
| Rendering | **Canvas 2D**, no map/chart library | About 1,200 polylines plus several thousand markers redraw every frame during playback. Canvas handles that easily, and I control pan/zoom, hit-testing and layer order directly. |
| Hosting | **Static site** (Netlify/Vercel) | No backend, so nothing to keep running. Share links encode map, match, dates and heatmap in the URL hash. |

## Data flow

```
player_data/February_*/{user}_{match}.nakama-0   (1,242 parquet files)
        │  pipeline/build_data.py
        │   1. read every file, record its day-folder
        │   2. decode event bytes -> str; treat ts integer as seconds; drop 1,505 exact duplicate rows
        │   3. classify each journey human/bot (see assumptions)
        │   4. match clock: t = ts − min(ts in match)  (seconds)
        │   5. world (x,z) -> normalised image coords (0..1)
        │   6. group by map -> match -> journey; flatten to number arrays
        ▼
public/data/index.json            map config + dates
public/data/<Map>.json            matches[] → journeys[] { path:[t,x,y,…] (movement only), ev:[code,t,x,y,…] }
public/minimaps/<Map>.webp        resized to 2048², 160–200 KB each
        │  fetch (lazy, per map, cached)
        ▼
on load: track = merge(path, event locations) by time   (drawn line ends exactly at the death/loot spot)
        ▼
React state (map, dates, match, toggles, t)
  → filter matches → JourneyRef[] → heatmap grid (256², box-blurred) + canvas draw (paths ≤ t, markers ≤ t)
```

Every view is a function of `(filters, t)`. The **timeline** drives a single match's replay, and it also drives the aggregate view: there, all filtered matches are aligned at t=0, so dragging the slider shows *when* in a match deaths and kills accumulate. Heatmaps follow the same filters and the same `t`.

## Coordinate mapping

The README gives a per-map `scale` and `origin` and a 2-step transform. I apply it **once, in the pipeline**:

```
u = (x − origin_x) / scale          # world x → 0..1 across the image
v = (z − origin_z) / scale          # world z → 0..1 up the image
image_x = u
image_y = 1 − v                     # flip: image origin is top-left, world +z is "up"
```

- **Use `x` and `z`, ignore `y`.** `y` is elevation (100–163 on Ambrose Valley). Plotting it would compress every path into a band.
- **I store normalised coordinates, not pixels.** The README says minimaps are 1024², but the files are actually 4320², 2160×2158 and 9000². The frontend multiplies by `base × zoom`, so the mapping stays correct at any image resolution and any zoom level. GrandRift's 2 px aspect difference is absorbed when it's resized to 2048².
- **Verification:**
  - I worked the README's sample point (Ambrose −301.45, −355.55 → px 78, 890) by hand.
  - 0 of 89k points fall outside [0,1].
  - Plotting every sample over each minimap shows paths following roads and doorways and never entering Lockdown's sea.

## Assumptions and data quirks

| What I found | What I did |
|---|---|
| `ts` is typed `timestamp[ms]`, but the integers are **Unix seconds**: 1,770,727,161 → 2026‑02‑10. Read as ms, every match lasts 0.4 "seconds" and samples are 5 ms apart. | I read the raw int64 as seconds. Matches then last 13 s to 14:50 and position samples are ~5 s apart. |
| 1,505 rows are exact duplicates (same file, ts, event, xyz). | Dropped. |
| **17 numeric-ID journeys emit human telemetry** (`Position`, `Loot`), not `BotPosition`. IDs 1379/1402/1429 sit in otherwise all-bot matches, and the same ID is a bot elsewhere. | Classified per journey **by telemetry stream** (`Position` → human), since the ID rule is only a proxy. They're flagged `idMismatch` and the tooltip says "numeric ID". |
| `BotKill`/`BotKilled` also appear in **bot** files. | Events are read from the journey owner's point of view: a kill-type event means the owner killed someone there, a death-type event means the owner died there. |
| Events carry coordinates too, so mixing them into "traffic" would over-weight loot spots (~15% of located samples are events). | **Traffic = movement samples only** (Position/BotPosition are sampled every ~5 s, so density ≈ time spent). Events go back into the *drawn* line only. |
| No "extracted" event exists. | A human with no death event "survived". Their last sample is marked with a white ring in replay. |
| 743 of 796 matches contain a single journey. Only 53 have 2+ journeys, and those are mostly humans with bots. | I show this honestly. There's a "2+ journeys only" filter, and the aggregate view is the main tool for spatial patterns. |
| One match spans two day-folders (starts 23:51 Feb 10). Folder dates don't align exactly with UTC. | The **folder name is the date**. A cross-folder match goes to its earliest folder. |
| Feb 14 is partial. | Marked with `*` in the date filter. |

## Trade-offs

| Considered | Chose | Because |
|---|---|---|
| Parse parquet in the browser (DuckDB-WASM / hyparquet) vs pre-process | **Pre-process to JSON** | A smaller payload, no 5 MB WASM, and the data quirks get fixed once in testable Python. The cost: new data needs `npm run data` and a redeploy. |
| Server API (FastAPI + DuckDB) vs static files | **Static** | The whole dataset fits in the browser. Nothing to host, scale or wake up. A backend would only pay off at ~100× the data. |
| Pre-computed heatmap tiles vs client-side KDE | **Client-side** (256² grid, 3-pass box blur, p99.5 normalisation) | Heatmaps react instantly to every filter and to the timeline. That costs ~5 ms per rebuild. |
| Leaflet/deck.gl vs raw canvas | **Raw canvas** | One fixed image, simple affine zoom. A map library would add weight without adding capability. |
| Streamlit vs custom web app | **Custom** | Playback needs 60 fps animation and custom interaction. Level designers get a fast, focused UI, not a notebook. |
| Show all loot markers by default | **Loot off by default** | 13k markers swamp everything else. The Loot heatmap is the better view for it. |
