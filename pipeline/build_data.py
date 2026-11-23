"""
Convert raw LILA BLACK telemetry (parquet, one file per player-per-match) into
compact, static JSON the web app can load directly.

    python pipeline/build_data.py --src ../player_data --out public

Outputs
  public/data/index.json          map config + per-map summary
  public/data/<MapId>.json        every match on that map with journeys + events
  public/minimaps/<MapId>.webp    minimap resized to 2048x2048

All coordinate mapping happens HERE, once, so the frontend only deals with
normalised image coordinates (0..1, origin top-left).
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter, defaultdict

import pandas as pd
import pyarrow.parquet as pq
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # Lockdown minimap is 9000x9000

# README "Map Configuration". World (x, z) -> UV via (p - origin) / scale.
MAPS = {
    "AmbroseValley": {"scale": 900, "ox": -370, "oz": -473, "img": "AmbroseValley_Minimap.png"},
    "GrandRift": {"scale": 581, "ox": -290, "oz": -290, "img": "GrandRift_Minimap.png"},
    "Lockdown": {"scale": 1000, "ox": -500, "oz": -500, "img": "Lockdown_Minimap.jpg"},
}
MINIMAP_OUT_PX = 2048

# Compact integer codes for non-movement events (kept in sync with src/data.ts)
EVENT_CODES = {"Kill": 0, "Killed": 1, "BotKill": 2, "BotKilled": 3, "KilledByStorm": 4, "Loot": 5}
MOVE_EVENTS = {"Position", "BotPosition"}
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def world_to_image(map_id: str, x: pd.Series, z: pd.Series) -> tuple[pd.Series, pd.Series]:
    """World (x, z) -> normalised image coords (ix, iy), origin top-left.

    u = (x - origin_x) / scale ; v = (z - origin_z) / scale
    image y is flipped because world +z points "up" on the minimap.
    Multiply by the rendered image size to get pixels (resolution independent).
    """
    c = MAPS[map_id]
    u = (x - c["ox"]) / c["scale"]
    v = (z - c["oz"]) / c["scale"]
    return u, 1.0 - v


def load_raw(src: str) -> pd.DataFrame:
    frames, skipped = [], []
    for day in sorted(os.listdir(src)):
        day_dir = os.path.join(src, day)
        if not (os.path.isdir(day_dir) and day.startswith("February_")):
            continue
        for fname in sorted(os.listdir(day_dir)):
            if fname.startswith("."):
                continue
            try:
                df = pq.read_table(os.path.join(day_dir, fname)).to_pandas()
            except Exception as exc:  # corrupt / non-parquet file
                skipped.append((day, fname, str(exc)[:60]))
                continue
            df["day"] = day
            df["file"] = fname
            frames.append(df)
    if skipped:
        print(f"skipped {len(skipped)} unreadable files: {skipped[:3]}")
    return pd.concat(frames, ignore_index=True)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    # event column is bytes in parquet
    df["event"] = df["event"].map(lambda e: e.decode("utf-8") if isinstance(e, (bytes, bytearray)) else str(e))

    # `ts` is typed timestamp[ms] but the stored integers are Unix *seconds*
    # (1_770_727_161 -> 2026-02-10). Read the raw integer and treat it as seconds.
    # Cast to ms resolution first so the raw integer is right whatever unit pandas picked.
    df["ts"] = df["ts"].astype("datetime64[ms]").astype("int64")

    before = len(df)
    df = df.drop_duplicates(subset=["file", "ts", "event", "x", "y", "z"]).copy()
    print(f"dropped {before - len(df)} exact duplicate rows")

    # match_id carries a '.nakama-0' server-instance suffix; strip for display only
    df["match"] = df["match_id"].str.replace(r"\.nakama-\d+$", "", regex=True)
    df["date"] = df["day"].str.replace("February_", "2026-02-")
    return df


def classify_journeys(df: pd.DataFrame) -> pd.DataFrame:
    """Bot vs human, per journey (file).

    README rule: UUID user_id = human, numeric = bot. In practice 17 numeric-ID
    journeys emit *human* telemetry (Position/Loot) inside otherwise all-bot
    matches. We trust the telemetry stream: a journey that emits `Position` is
    human-controlled, one that emits `BotPosition` is a bot. Disagreements with
    the ID rule are flagged (`idMismatch`) so the UI can surface them.
    """
    g = df.groupby("file")
    info = pd.DataFrame({
        "user_id": g["user_id"].first(),
        "has_pos": g["event"].agg(lambda s: (s == "Position").any()),
        "has_botpos": g["event"].agg(lambda s: (s == "BotPosition").any()),
    })
    info["id_is_uuid"] = info["user_id"].map(lambda u: bool(UUID_RE.match(u)))
    info["bot"] = info.apply(
        lambda r: (not r.has_pos) if (r.has_pos or r.has_botpos) else (not r.id_is_uuid), axis=1)
    info["idMismatch"] = info["bot"] == info["id_is_uuid"]
    print(f"journeys: {len(info)}, bots: {int(info.bot.sum())}, "
          f"ID/telemetry mismatches: {int(info.idMismatch.sum())}")
    return info


def r4(v: float) -> float:
    return round(float(v), 4)


def build(src: str, out: str) -> None:
    df = clean(load_raw(src))
    jinfo = classify_journeys(df)

    # Match clock: t = 0 at the earliest event of any journey in that match.
    df["t0"] = df.groupby("match_id")["ts"].transform("min")
    df["t"] = (df["ts"] - df["t0"]).astype(int)

    ix, iy = [], []
    for map_id, part in df.groupby("map_id"):
        a, b = world_to_image(map_id, part["x"], part["z"])
        ix.append(a)
        iy.append(b)
    df["ix"] = pd.concat(ix)
    df["iy"] = pd.concat(iy)
    oob = ((df.ix < 0) | (df.ix > 1) | (df.iy < 0) | (df.iy > 1)).sum()
    print(f"points outside minimap bounds: {oob}")

    # stable chronological order; ties keep file order
    df = df.sort_values(["match_id", "file", "ts"], kind="stable")

    os.makedirs(os.path.join(out, "data"), exist_ok=True)
    index = {"maps": [], "events": EVENT_CODES}

    for map_id, mdf in df.groupby("map_id"):
        matches = []
        for match_id, g in mdf.groupby("match_id"):
            journeys = []
            counts: Counter = Counter()
            for fname, j in g.groupby("file", sort=False):
                ji = jinfo.loc[fname]
                # Path = movement samples ONLY (Position/BotPosition, ~5 s apart),
                # so the traffic heatmap measures time spent, not event density.
                # The frontend merges event locations back in for drawing so a
                # line still ends exactly where the player died (data.ts).
                path = []
                last = None
                mv = j[j["event"].isin(MOVE_EVENTS)]
                for t, x, y in zip(mv["t"], mv["ix"], mv["iy"]):
                    pt = (int(t), r4(x), r4(y))
                    if pt != last:
                        path.extend(pt)
                        last = pt
                evs = []
                for e, t, x, y in zip(j["event"], j["t"], j["ix"], j["iy"]):
                    if e in MOVE_EVENTS:
                        continue
                    counts[e] += 1
                    evs.extend((EVENT_CODES[e], int(t), r4(x), r4(y)))
                died = bool(j["event"].isin(["Killed", "BotKilled", "KilledByStorm"]).any())
                journey = {
                    "id": ji.user_id,
                    "bot": bool(ji.bot),
                    "path": path,
                    "ev": evs,
                    # human with no death event = survived to the end (extracted / still alive)
                    "out": "died" if died else "survived",
                }
                if ji.idMismatch:
                    journey["idMismatch"] = True
                journeys.append(journey)

            humans = sum(1 for j in journeys if not j["bot"])
            matches.append({
                "id": match_id.replace(".nakama-0", ""),
                # a match spanning two day-folders is assigned to the earliest one
                "date": g["date"].min(),
                "start": int(g["t0"].iloc[0]),
                "dur": int(g["t"].max()),
                "humans": humans,
                "bots": len(journeys) - humans,
                "counts": dict(counts),
                "journeys": journeys,
            })
        matches.sort(key=lambda m: m["start"])

        with open(os.path.join(out, "data", f"{map_id}.json"), "w") as fh:
            json.dump({"map": map_id, "matches": matches}, fh, separators=(",", ":"))

        index["maps"].append({
            "id": map_id,
            "image": f"minimaps/{map_id}.webp",
            **{k: MAPS[map_id][k] for k in ("scale", "ox", "oz")},
            "matches": len(matches),
            "dates": sorted({m["date"] for m in matches}),
        })
        print(f"{map_id}: {len(matches)} matches")

    with open(os.path.join(out, "data", "index.json"), "w") as fh:
        json.dump(index, fh, indent=1)

    # Minimaps: sources are 4320², 2160x2158 and 9000² (README says 1024²).
    # Mapping is in normalised UV space so any square resolution works; we
    # resize to 2048² (GrandRift's 2px aspect difference is absorbed).
    os.makedirs(os.path.join(out, "minimaps"), exist_ok=True)
    for map_id, cfg in MAPS.items():
        img = Image.open(os.path.join(src, "minimaps", cfg["img"])).convert("RGB")
        img = img.resize((MINIMAP_OUT_PX, MINIMAP_OUT_PX), Image.LANCZOS)
        img.save(os.path.join(out, "minimaps", f"{map_id}.webp"), "WEBP", quality=82, method=6)
        print(f"minimap {map_id}: {cfg['img']} -> {MINIMAP_OUT_PX}px webp")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="../player_data")
    ap.add_argument("--out", default="public")
    args = ap.parse_args()
    build(args.src, args.out)
