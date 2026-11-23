# Three things the data says about LILA BLACK

Zones use the tool's **Zone grid** toggle (columns A–H left→right, rows 1–8 top→bottom). Every number can be reproduced with `python pipeline/insights.py`.

---

## 1. Bots decide matches, and they do it in four central zones

**What caught my eye:** I switched on the Deaths heatmap for Ambrose Valley, all days. Almost all the death markers are pink (killed by a bot), and they pile up on the central compound. Player-vs-player deaths barely register.

**Evidence** (798 human journeys, all maps):

| Outcome | Journeys | Share |
|---|---|---|
| Killed by a bot | 401 | **50%** |
| Survived / extracted | 355 | 44% |
| Killed by the storm | 39 | 5% |
| Killed by a player | 3 | **0.4%** |

On Ambrose Valley, zones **C4, C5, D4, D5** carry 24% of human traffic (time spent) but **163 of 316 human deaths (52%)** and 785 of the kills. A bot death happens at a median of 4:30 into the match.

**Actionable?** Yes. The PvE combat lives in a small area, and the "extraction shooter" tension is currently almost entirely PvE.
- *Actions:*
  - Audit bot density and aggro radius in C4–D5.
  - Add cover and flanking routes through the compound.
  - Consider seeding a few high-value spawns or objectives on the edges so the fight spreads out.
- *Metrics to watch:*
  - Bot-death rate (50% now).
  - Share of deaths in the top-4 zones (52% now).
  - Time-to-first-death.
  - PvP encounter rate.

**Why a level designer should care:** half of all runs end the same way in the same place. That says the centre's layout (sightlines, cover, bot placement) matters more to the game's feel than any other part of the map.

---

## 2. Some loot is free: Ambrose Valley's risk and reward are out of balance

**What caught my eye:** with the Loot heatmap on, A4 (the west compound) glows as brightly as the centre. With Deaths on, it's empty.

**Evidence** (Ambrose Valley, human journeys):

| Zone | Loot pickups | Deaths | Deaths per 100 pickups |
|---|---|---|---|
| **A4** (west compound) | 474 | **0** | **0.0** |
| **C7** | 593 | **0** | **0.0** |
| **E7** | 645 | 3 | 0.5 |
| C5 (centre) | 651 | 57 | 8.8 |
| C4 (centre) | 483 | 41 | 8.5 |
| D5 (centre) | 373 | 31 | 8.3 |

Players pick up as much loot in A4 or C7 as in the centre, at **zero risk**. A4 also gets only 1 kill in five days, so bots don't patrol there.

**Actionable?** Yes.
- *Actions:* either lower the loot tier in A4/C7/E7, or add threat there (bot patrols, an objective that draws players, or a storm path that crosses it). Alternatively, raise reward in the centre so the risk pays.
- *Metrics to watch:*
  - Deaths per 100 loot per zone. The goal is a smooth gradient, not 0 vs 9.
  - Extraction value per run by route.
  - Traffic share of safe zones.

**Why a level designer should care:** an extraction shooter depends on a risk-for-reward choice. Zones with zero risk become the solved, optimal route. Experienced players farm them, and the intended contested areas stay contested only by bots.

---

## 3. Lockdown's storm traps late players 3× more often than Ambrose Valley's

**What caught my eye:** the Storm death counter on Lockdown (17 in 171 matches) is the same as on Ambrose Valley (17 in 566 matches), despite Lockdown having a third of the matches.

**Evidence:**

| Map | Storm death rate (all humans) | Humans still in at 10:00 | …of whom die to storm |
|---|---|---|---|
| Ambrose Valley | 3.0% | 130 | **13%** |
| Lockdown | **9.9%** | 44 | **39%** |
| Grand Rift | 8.5% | 14 | 36% (small sample) |

Storm deaths never happen early. The earliest is 10:55 and the median is 12:41 on Lockdown. Lockdown's survivors leave at a median of 8:38. So the storm only catches players who stay past roughly 11 minutes. On Lockdown, those players die 3× as often as on Ambrose Valley. Lockdown's storm deaths cluster in **E4, F4, G4**, the east-centre band.

**Actionable?** Yes.
- *Actions:*
  - Check extraction point count, placement and signposting on Lockdown. Late players from E4–G4 can't reach one in time.
  - Add an extraction point or a faster route out of the east-centre.
  - Give a stronger storm warning around 10:00.
- *Metrics to watch:*
  - Storm death rate per map (9.9% → target the ~3% of Ambrose Valley).
  - Late-match (10:00+) survival rate.
  - Distance from storm-death location to the nearest extraction point.

**Why a level designer should care:** dying to the storm feels unfair, because the player lost to the map rather than to an opponent. On a small close-quarters map, it points to routing and extraction layout, which are level-design levers rather than tuning ones.

---

*Caveats:*
- 5 days of data, and most matches contain one recorded human.
- Grand Rift numbers are small (59 journeys).
- "Survived" means "no death event recorded", because the data has no explicit extraction event.
