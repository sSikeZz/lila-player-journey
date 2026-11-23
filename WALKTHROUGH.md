# Walkthrough

A 5-minute tour of every feature. It's written so it can also be read aloud as a script for a screen recording.

## 1. The aggregate view (first screen)
- The tool opens on **Ambrose Valley** with all 566 matches overlaid.
- Each **cyan line** is a human's path, each **dashed orange line** a bot's. The left panel shows how many of each are on the map.
- Markers have a distinct shape and colour per event:
  - ⊕ player kill
  - ✕ bot kill
  - red ⊗ death by player
  - pink ⊗ death by bot
  - ◆ storm death
  - ■ loot (off by default: 13k markers would drown everything else)
- **Hover** any marker to see the event, who did it (human/bot + ID), the match time and which match.
- **Drag** to pan. **Scroll** or **double-click** to zoom. Use **+ / − / ⤢** (top right) to zoom or re-fit.

## 2. Filters
- **Map:** Ambrose Valley / Grand Rift / Lockdown. The minimap and data switch together.
- **Date:** pick one or more days. Feb 14 is marked `*` because it's a partial day.
- **Show:** toggle humans, bots, movement paths, and the **A1–H8 zone grid**, which is used to name areas in INSIGHTS.md.
- **Events:** toggle each marker type independently. Counts update with every filter.

## 3. Heatmaps
- **Traffic** shows where players spend time (movement samples taken every ~5 s).
- **Kills / Deaths / Storm / Loot** show where each kind of event happens.
- While a heatmap is on, paths and markers fade back so the heatmap reads clearly. Use the opacity slider to adjust.
- Heatmaps respect every filter. *Try:* Lockdown → Storm → turn the grid on, and the E4–G4 band lights up.

## 4. The timeline in aggregate view
- With no match selected, all filtered matches are **aligned at t = 0**.
- Drag the slider back to 3:00, then press **Play**. You'll see when in a match deaths start to pile up. Storm deaths never appear before ~11:00.

## 5. Replaying a single match
- Sort the match list by **Most journeys** or **Most combat**, then click a match.
- The header shows the date, start time (UTC), duration, and how many humans and bots took part.
- Press **Play** (or `Space`). Choose a speed from 1× to 60×. Use `←` / `→` to jump 5 s.
- **Moving dots** are each player's live position. Each human gets their own colour.
- The **roster** (bottom-left) shows each human live: Alive, Died (by bot / player / storm, with the time), or Survived (with the time they left).
- **Coloured ticks** under the slider mark every kill and death. Click one to jump straight to it.
- A **white ring** marks where a survivor was last seen (most likely their extraction).
- Press `Esc` or **← All matches** to go back.

## 6. Sharing
- The URL always holds the current map, match, dates and heatmap.
- Copy it and send it to a colleague, and it opens on the same view.
