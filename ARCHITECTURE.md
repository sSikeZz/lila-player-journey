# Architecture

## Stack
- **Python + pyarrow** (`pipeline/build_data.py`): an offline step that turns the parquet files into compact JSON. It processes all 89k rows in ~4 s, so no database or server is needed.
- **React + TypeScript + Vite, drawn with Canvas 2D:** about 1,200 paths and thousands of markers redraw smoothly during playback, without a map library.
- **Static hosting on Netlify:** nothing runs on a server. The URL hash stores map, match, dates and heatmap, so any view can be shared as a link.

## Data flow
```
parquet (1,242 files) → build_data.py → public/data/<Map>.json (2 MB total) + 2048² webp minimaps
  → browser loads one map at a time → filters (map/date/match/humans/bots) → timeline t
  → canvas: minimap → heatmap → paths → markers → live player positions
```
The pipeline:
1. Decodes the `event` bytes.
2. Fixes the timestamp units.
3. Drops 1,505 duplicate rows.
4. Labels each journey as human or bot.
5. Re-times every event as seconds since the match started.
6. Converts positions to minimap coordinates.

Each journey becomes a list of movement samples plus a list of events. The browser joins the two in time order when it draws, so a line ends exactly where the player died. Heatmaps are computed in the browser (256×256 grid, blurred), so they follow every filter and the timeline. With no match selected, all filtered matches are aligned at t=0, and scrubbing shows *when* deaths and kills happen.

## Coordinate mapping
```
u = (x − origin_x) / scale        v = (z − origin_z) / scale
image_x = u                       image_y = 1 − v      (image origin is top-left; world +z is up)
```
- **Only `x` and `z` are used.** `y` is elevation.
- **Positions are stored as fractions of the image (0–1), not pixels.** The README says the minimaps are 1024², but the real files are 4320², 2160×2158 and 9000². Fractions stay correct at any image size or zoom level.
- **Checked three ways:**
  - The README's sample point maps to pixel (78, 890), matching the README.
  - 0 of 89k points fall outside the map.
  - Plotting every sample shows paths following roads and never entering Lockdown's sea.

## Assumptions and data quirks
| Found | Handled |
|---|---|
| `ts` is typed as milliseconds, but the values are **Unix seconds** (1,770,727,161 = Feb 10 2026). | Read as seconds. Matches then run 13 s–14:50, with position samples every ~5 s. |
| 1,505 exact duplicate rows | Dropped |
| 17 numeric (bot-style) IDs send *human* data (`Position`/`Loot`) | Labelled by the data they send, flagged as "numeric ID" in the tooltip |
| `BotKill`/`BotKilled` also appear in bot files | Read from the journey owner's view: a kill means the owner killed someone, a death means the owner died |
| No "extracted" event | Human with no death event = survived. Their last position is ringed during replay. |
| Events carry positions too | The Traffic heatmap uses movement samples only, so it shows time spent rather than loot spots |
| 743 of 796 matches have a single journey. One match spans two day folders. Feb 14 is partial. | "2+ journeys" filter. The folder name is the date (earliest folder wins). Feb 14 is marked `*`. |

## Trade-offs
| Considered | Chose | Why |
|---|---|---|
| Parse parquet in the browser (DuckDB-WASM) | Pre-process to JSON | Smaller download, no 5 MB WASM, quirks fixed once in Python. Cost: new data needs a rebuild. |
| API server (FastAPI + DuckDB) | Static files | The whole dataset fits in the browser. Nothing to host or scale. |
| Pre-rendered heatmap tiles | Heatmaps built in the browser | Instant response to filters and the timeline (~5 ms per rebuild) |
| Leaflet / deck.gl / Streamlit | Raw canvas + React | One fixed image and 60 fps playback. A library adds weight, not capability. |
| Loot markers on by default | Off by default | 13k markers bury everything else. The Loot heatmap shows it better. |
