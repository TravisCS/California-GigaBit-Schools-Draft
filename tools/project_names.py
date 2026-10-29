#!/usr/bin/env python3
"""Give every funded BEAD project a readable name ("Comcast Fiber · Central Valley and North Valley (17 counties)")
and store it as "nm" in bead_areas.json, next to the official project ID, which stays the ID.

The names are made by this map, not by the CPUC: each project's area pieces are placed in counties (counties.json),
weighted by piece size; one to three main counties are named, a wider project is named by its main regions.
Smaller projects also get their main community, from sources/bead/project_cities.json: the cities of each project's
funded locations, counted with one statistics query to the CPUC BEAD map service layer "BSLs"
(groupByFieldsForStatistics=project_id,city, count of OBJECTID).
Run after tools/bead_areas.py:  python3 tools/project_names.py   (then python3 tools/stamp.py)
"""
import collections, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGION = {}
for region, names in {
    "Far North": "Del Norte Siskiyou Modoc Trinity Shasta Lassen Tehama Plumas",
    "North Coast": "Humboldt Mendocino Lake Sonoma Napa Marin",
    "North Valley": "Butte Glenn Colusa Sutter Yuba Yolo Sacramento",
    "Sierra Nevada": "Sierra Nevada Placer El_Dorado Amador Calaveras Tuolumne Mariposa Alpine Mono Inyo",
    "Bay Area": "San_Francisco San_Mateo Santa_Clara Alameda Contra_Costa Solano",
    "Central Valley": "San_Joaquin Stanislaus Merced Madera Fresno Kings Tulare Kern",
    "Central Coast": "Santa_Cruz Monterey San_Benito San_Luis_Obispo Santa_Barbara",
    "Southern California": "Ventura Los_Angeles Orange San_Bernardino Riverside San_Diego Imperial",
}.items():
    for n in names.split():
        REGION[n.replace("_", " ")] = region
SHORT = {"Stimulus Technologies of California": "Stimulus", "INTUS Smartcities": "INTUS", "Habematolel Pomo of Upper Lake": "Habematolel Pomo",
         "Personal Network Computing dba Valley Internet": "Valley Internet", "Zinnia Networks Inc dba Matrix Broadband": "Matrix Broadband",
         "Wi-Fiber of Northern California": "Wi-Fiber", "Hunter Communications & Technologies": "Hunter", "Mountain Tower and Network": "Mountain Tower",
         "Siskiyou Telephone": "Siskiyou Telephone", "Astound Broadband": "Astound", "Resound Networks": "Resound", "Trellis Communications": "Trellis",
         "VARCOMM Broadband": "VARCOMM", "Butler America": "Butler America", "Zito Media": "Zito Media"}


CITIES = json.loads((ROOT / "sources" / "bead" / "project_cities.json").read_text()) if (ROOT / "sources" / "bead" / "project_cities.json").exists() else {}


FIX = {"Rncho Murieta": "Rancho Murieta", "Sn Luis Obisp": "San Luis Obispo", "Shingle Spgs": "Shingle Springs", "Valley Spgs": "Valley Springs",
       "Twentynin Plm": "Twentynine Palms", "Newberry Spgs": "Newberry Springs", "S Lake Tahoe": "South Lake Tahoe"}


def tc(s):
    t = _tc(s)
    return FIX.get(t, t.replace(" Spgs", " Springs"))


def _tc(s):
    return " ".join(w.capitalize() if w not in ("DE", "DEL", "LA", "EL", "LOS", "LAS") or i == 0 else w.capitalize() for i, w in enumerate(s.split()))


def in_ring(x, y, r):
    hit = False
    for i in range(len(r) - 1):
        (x1, y1), (x2, y2) = r[i], r[i + 1]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def main():
    areas_p = ROOT / "bead_areas.json"
    gj = json.loads(areas_p.read_text())
    boxes = []
    for f in json.loads((ROOT / "counties.json").read_text())["features"]:
        g = f["geometry"]
        ps = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        xs = [p[0] for pl in ps for p in pl[0]]; ys = [p[1] for pl in ps for p in pl[0]]
        boxes.append((f["properties"]["n"], ps, min(xs), max(xs), min(ys), max(ys)))

    def county(x, y):
        for n, ps, a, b, c, d in boxes:
            if a <= x <= b and c <= y <= d and any(in_ring(x, y, pl[0]) for pl in ps):
                return n
        return None

    def join(xs):
        return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]

    names = {}
    for f in gj["features"]:
        p = f["properties"]
        w = collections.Counter()
        for pl in f["geometry"]["coordinates"]:
            r = pl[0]; xs = [q[0] for q in r]; ys = [q[1] for q in r]
            size = max(1e-6, (max(xs) - min(xs)) * (max(ys) - min(ys)))
            c = county(sum(xs[:-1]) / max(1, len(xs) - 1), sum(ys[:-1]) / max(1, len(ys) - 1)) or county(r[0][0], r[0][1])
            if c:
                w[c] += size
        total = sum(w.values()) or 1
        main_c = [c for c, v in w.most_common() if v / total >= 0.08]
        nc = len(w)
        tech = "Fiber" if p["tech"] in ("Fiber", "Hybrid") else "Satellite" if p["tech"] == "Satellite" else "Wireless"
        who = SHORT.get(p["who"], p["who"])
        town = [tc(c) for _, c in CITIES.get(p["id"], []) if c]
        named = [c for c, _ in w.most_common(3)]
        if p["g"] == "satellite" and nc >= 30:
            where = "Rural California (%d counties)" % nc
        elif nc <= 3:
            where = (town[0] + " area, " if town else "") + join(named) + (" County" if len(named) == 1 else " Counties")
        else:
            rw = collections.Counter()
            for c, v in w.items():
                rw[REGION.get(c, "California")] += v
            regs = [r for r, v in rw.most_common() if v / total >= 0.15][:2] or [rw.most_common(1)[0][0]]
            where = join(regs) + " (%d counties)" % nc
        p["_base"] = "%s %s · %s" % (who, tech, where)
        p["_lead"] = town[1] if len(town) > 1 else ""
    # keep names unique: add the main county, then a number
    seen = collections.Counter(f["properties"]["_base"] for f in gj["features"])
    used = collections.Counter()
    for f in gj["features"]:
        p = f["properties"]; nm = p["_base"]
        if seen[nm] > 1 and p["_lead"] and p["_lead"] not in nm:
            nm = nm.replace(" area, ", " and " + p["_lead"] + " area, ", 1) if " area, " in nm else nm + ", around " + p["_lead"]
        used[nm] += 1
        p["nm"] = nm
    dup = collections.Counter(f["properties"]["nm"] for f in gj["features"])
    k = collections.Counter()
    for f in gj["features"]:
        p = f["properties"]
        if dup[p["nm"]] > 1:
            k[p["nm"]] += 1
            p["nm"] = p["nm"] + " (" + str(k[p["nm"]]) + ")"
        p.pop("_base", None); p.pop("_lead", None)
    areas_p.write_text(json.dumps(gj, separators=(",", ":")))
    print(len(gj["features"]), "projects named;", len({f["properties"]["nm"] for f in gj["features"]}), "unique")


if __name__ == "__main__":
    main()
