#!/usr/bin/env python3
"""Build context_layers.json: the CPUC's low-income areas and tribal lands, simplified for the map's "More" tab.

Source: the CPUC BEAD Public Dashboard's map services PAU_LIA (low-income areas) and PAU_TRIBAL (tribal lands), each one
dissolved polygon. Download them first:
  curl -o lia.json "https://services2.arcgis.com/VofPZYDe2pLxSP5G/arcgis/rest/services/PAU_LIA/FeatureServer/1/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&geometryPrecision=4&f=geojson"
  curl -o tribal.json "https://services2.arcgis.com/VofPZYDe2pLxSP5G/arcgis/rest/services/PAU_TRIBAL/FeatureServer/1/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&geometryPrecision=4&f=geojson"
Then run:  python3 tools/context_layers.py lia.json tribal.json   (then python3 tools/stamp.py)

Rings are simplified like the project areas (about 400 m, see bead_areas.py); pieces too small to see at that detail
are dropped, which the About sheet says.
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from bead_areas import dp, TOL  # same simplification as the project areas


def simplify(path):
    gj = json.loads(pathlib.Path(path).read_text())
    out, pts = [], 0
    for f in gj["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for pl in polys:
            rings = []
            for r in pl:
                s = [[round(x, 3), round(y, 3)] for x, y in dp(r, TOL)]
                s = [p for i, p in enumerate(s) if i == 0 or p != s[i - 1]]
                if len(s) >= 4:
                    rings.append(s)
                elif not rings:
                    break  # outer ring too small to see: drop the piece
            if rings:
                out.append(rings)
                pts += sum(len(r) for r in rings)
    return {"type": "Feature", "properties": {}, "geometry": {"type": "MultiPolygon", "coordinates": out}}, pts


def main():
    lia, a = simplify(sys.argv[1])
    tribal, b = simplify(sys.argv[2])
    lia["properties"]["k"] = "lia"
    tribal["properties"]["k"] = "tribal"
    (ROOT / "context_layers.json").write_text(json.dumps({"type": "FeatureCollection", "features": [lia, tribal]}, separators=(",", ":")))
    print("low-income points", a, "tribal points", b)


if __name__ == "__main__":
    main()
