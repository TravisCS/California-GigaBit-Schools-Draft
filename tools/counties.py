#!/usr/bin/env python3
"""Build counties.json: California county outlines for the state view, with a label point inside each county.

Source: U.S. Census Bureau TIGERweb, State_County MapServer layer 1 (Counties), simplified by the service
(maxAllowableOffset 0.004 degrees, about 400 m). Run:  python3 tools/counties.py
If Python cannot verify the certificate, download URL with curl and pass the file:  python3 tools/counties.py raw.json
"""
import json, math, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = ("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
       "?where=STATE%3D%2706%27&outFields=BASENAME&returnGeometry=true&outSR=4326"
       "&maxAllowableOffset=0.004&geometryPrecision=4&f=geojson")


def polys(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def ring_area(r):
    return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2


def inside(x, y, poly):
    hit = False
    for r in poly:
        for i in range(len(r) - 1):
            (x1, y1), (x2, y2) = r[i], r[i + 1]
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                hit = not hit
    return hit


def edge_dist(x, y, poly):
    k = math.cos(math.radians(y))  # measure in roughly equal-distance units
    best = 1e9
    for r in poly:
        for i in range(len(r) - 1):
            (x1, y1), (x2, y2) = r[i], r[i + 1]
            ax, ay, bx, by = (x1 - x) * k, y1 - y, (x2 - x) * k, y2 - y
            dx, dy = bx - ax, by - ay
            t = 0 if dx == dy == 0 else max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
            best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def label_point(poly):
    """Point inside the polygon farthest from its edges (a coarse-to-fine grid search)."""
    xs = [p[0] for p in poly[0]]
    ys = [p[1] for p in poly[0]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    best = None
    for step in range(3):
        n = 24
        for i in range(n + 1):
            for j in range(n + 1):
                x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n
                if inside(x, y, poly):
                    d = edge_dist(x, y, poly)
                    if best is None or d > best[0]:
                        best = (d, x, y)
        if best is None:
            break
        w, h = (x1 - x0) / 6, (y1 - y0) / 6
        x0, x1, y0, y1 = best[1] - w, best[1] + w, best[2] - h, best[2] + h
    return [round(best[2], 4), round(best[1], 4)]  # [lat, lng] for Leaflet


def main():
    if len(sys.argv) > 1:
        gj = json.loads(pathlib.Path(sys.argv[1]).read_text())
    else:
        with urllib.request.urlopen(URL, timeout=120) as r:
            gj = json.load(r)
    out = []
    for f in gj["features"]:
        ps = polys(f["geometry"])
        big = max(ps, key=lambda p: abs(ring_area(p[0])))
        out.append({"type": "Feature", "properties": {"n": f["properties"]["BASENAME"], "lab": label_point(big)},
                    "geometry": f["geometry"]})
    out.sort(key=lambda f: f["properties"]["n"])
    (ROOT / "counties.json").write_text(json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":")))
    print(len(out), "counties written")


if __name__ == "__main__":
    main()
