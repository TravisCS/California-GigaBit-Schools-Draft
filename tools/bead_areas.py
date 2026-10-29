#!/usr/bin/env python3
"""Build bead_areas.json: the 83 funded BEAD project areas, simplified for the map's "Funded projects" layer.

Source: the CPUC's public BEAD map service, layer "Projects" (NTIA-approved July 2026). Download it first:
  curl -o areas.json "https://services2.arcgis.com/VofPZYDe2pLxSP5G/arcgis/rest/services/BEAD_NTIA_Approved/FeatureServer/2/query?where=1%3D1&outFields=project_id,awardee,technology,bead_support,n,LCSO_Price&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&geometryPrecision=4&f=geojson"
Then run:  python3 tools/bead_areas.py areas.json   (then python3 tools/stamp.py)

Each ring is simplified (Douglas-Peucker, about 400 m) and rounded to 3 decimals (about 100 m). A piece too small to keep
its shape becomes a small box at its own extent, so no funded area disappears from the map. Each project also gets "pt",
a point inside its largest piece where the map draws the project's dot.
"""
import csv, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from counties import label_point, ring_area  # the same "farthest from the edges" point the county labels use

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOL = 0.004  # degrees, about 400 m
GROUP = {"Fiber": "fiber", "Hybrid": "fiber", "Satellite": "satellite"}


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        L = (dx * dx + dy * dy) or 1e-18
        best, idx = 0, -1
        for i in range(a + 1, b):
            x, y = pts[i]
            t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L))
            d = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2
            if d > best:
                best, idx = d, i
        if idx > 0 and best > tol * tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def ring(r):
    s = dp(r, TOL)
    s = [[round(x, 3), round(y, 3)] for x, y in s]
    out = [p for i, p in enumerate(s) if i == 0 or p != s[i - 1]]
    if len(out) >= 4:
        return out
    xs = [p[0] for p in r]; ys = [p[1] for p in r]
    x0, x1, y0, y1 = round(min(xs), 3), round(max(xs), 3), round(min(ys), 3), round(max(ys), 3)
    if x1 - x0 < 0.002: x0, x1 = round(x0 - 0.001, 3), round(x1 + 0.001, 3)
    if y1 - y0 < 0.002: y0, y1 = round(y0 - 0.001, 3), round(y1 + 0.001, 3)
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]


def main():
    gj = json.loads(pathlib.Path(sys.argv[1]).read_text())
    with open(ROOT / "sources" / "bead" / "fp_deployment_projects.csv", encoding="utf-8-sig", newline="") as f:
        end = {r["project_id"]: (r["estimated_performance_end"] or "")[:4] for r in csv.DictReader(f)}
    feats, pts = [], 0
    for f in gj["features"]:
        g = f["geometry"]
        if not g:
            continue
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        out = []
        for pl in polys:
            outer = ring(pl[0])
            holes = [ring(h) for h in pl[1:] if len(dp(h, TOL)) >= 4]  # drop holes too small to see
            out.append([outer] + holes)
            pts += sum(len(r) for r in out[-1])
        p = f["properties"]
        tech = p["technology"]
        big = max(polys, key=lambda pl: abs(ring_area(pl[0])))
        pt = label_point(big)  # [lat, lng] inside the project's largest piece, for its dot
        feats.append({"type": "Feature", "geometry": {"type": "MultiPolygon", "coordinates": out},
                      "properties": {"id": p["project_id"], "who": p["awardee"], "tech": tech,
                                     "g": GROUP.get(tech, "wireless" if tech.endswith("Wireless") else "other"),
                                     "usd": round(p.get("bead_support") or 0), "n": p.get("n") or 0,
                                     "price": p.get("LCSO_Price"), "end": end.get(p["project_id"], ""), "pt": pt}})
    # draw satellite first, then wireless, then fiber, so the denser technologies sit on top
    order = {"satellite": 0, "wireless": 1, "other": 1, "fiber": 2}
    feats.sort(key=lambda f: order[f["properties"]["g"]])
    (ROOT / "bead_areas.json").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))
    print(len(feats), "projects,", pts, "points")


if __name__ == "__main__":
    main()
