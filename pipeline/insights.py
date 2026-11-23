"""
Reproduces the numbers quoted in INSIGHTS.md from the generated JSON.

    python pipeline/insights.py
"""

import json
import statistics as st
from collections import Counter, defaultdict

MAPS = ["AmbroseValley", "GrandRift", "Lockdown"]
DEATH = {1: "pvp", 3: "bot", 4: "storm"}
G = 8  # coarse grid for "zones" (8x8 over the minimap)


def zone(x, y):
    return min(G - 1, int(y * G)), min(G - 1, int(x * G))


def zname(z):
    r, c = z
    return f"{'ABCDEFGH'[c]}{r + 1}"  # column letter + row number, like a map grid


for m in MAPS:
    d = json.load(open(f"public/data/{m}.json"))
    humans = [j for mt in d["matches"] for j in mt["journeys"] if not j["bot"]]
    outcomes = Counter()
    death_t = defaultdict(list)
    life = []
    traffic, loot, deaths, kills, storm = Counter(), Counter(), Counter(), Counter(), []
    survivor_exit, late, late_storm = [], 0, 0
    for j in humans:
        ev = j["ev"]
        cause = None
        for i in range(0, len(ev), 4):
            code, t, x, y = ev[i : i + 4]
            z = zone(x, y)
            if code in DEATH:
                cause = DEATH[code]
                death_t[cause].append(t)
                deaths[z] += 1
                if code == 4:
                    storm.append((t, x, y))
            elif code == 5:
                loot[z] += 1
            elif code in (0, 2):
                kills[z] += 1
        outcomes[cause or "survived"] += 1
        p = j["path"]  # movement samples only (~5 s apart) => traffic = time spent
        times = p[0::3] + ev[1::4]
        start, end = min(times), max(times)
        life.append(end - start)
        if cause is None:
            survivor_exit.append(end)
        if end >= 600:
            late += 1
            late_storm += cause == "storm"
        for i in range(0, len(p), 3):
            traffic[zone(p[i + 1], p[i + 2])] += 1

    n = len(humans)
    print(f"\n=== {m}: {len(d['matches'])} matches, {n} human journeys")
    for k, v in outcomes.most_common():
        print(f"  {k:9s} {v:4d}  {100 * v / n:5.1f}%")
    for k, ts in death_t.items():
        print(f"  {k} death time: median {st.median(ts):.0f}s, p25 {sorted(ts)[len(ts) // 4]}s, n={len(ts)}")
    print(f"  journey length median {st.median(life):.0f}s; survivors leave at median {st.median(survivor_exit):.0f}s")
    print(f"  humans still in at 10:00: {late}, died to storm: {late_storm} ({100 * late_storm / max(1, late):.0f}%)")
    early = sum(1 for t in death_t["bot"] if t <= 120)
    print(f"  bot deaths in first 2 min: {early}/{len(death_t['bot'])}")

    tot_t = sum(traffic.values())
    visited = [z for z in traffic if traffic[z] > 0]
    top = traffic.most_common(5)
    print(f"  zones visited: {len(visited)}/{G * G}; top-5 zones = {100 * sum(v for _, v in top) / tot_t:.0f}% of traffic")
    centre = [(3, 2), (4, 2), (3, 3), (4, 3)]  # C4, C5, D4, D5 as (row, col)
    if m == "AmbroseValley":
        ct = sum(traffic[z] for z in centre)
        cd = sum(deaths[z] for z in centre)
        ck = sum(kills[z] for z in centre)
        print(f"  C4+C5+D4+D5: {100 * ct / tot_t:.1f}% traffic, {cd}/{sum(deaths.values())} deaths, {ck} kills")
    # loot vs danger per zone (zones with meaningful traffic)
    print("  zone  traffic%  loot  deaths  kills  deaths/100loot")
    rows = []
    for z, v in traffic.most_common(12):
        dl = 100 * deaths[z] / loot[z] if loot[z] else float("nan")
        rows.append((zname(z), 100 * v / tot_t, loot[z], deaths[z], kills[z], dl))
    for r in rows:
        print("  %-4s  %6.1f%%  %4d  %6d  %5d  %8.1f" % r)
    if storm:
        ts = [s[0] for s in storm]
        xs = [s[1] for s in storm]
        ys = [s[2] for s in storm]
        print(f"  storm deaths n={len(storm)} t median {st.median(ts):.0f}s min {min(ts)} | "
              f"x mean {st.mean(xs):.2f} [{min(xs):.2f},{max(xs):.2f}] y mean {st.mean(ys):.2f} [{min(ys):.2f},{max(ys):.2f}]")
        print("  storm zones:", Counter(zname(zone(x, y)) for _, x, y in storm).most_common(6))
