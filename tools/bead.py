#!/usr/bin/env python3
"""Match mapped schools to California's BEAD plan and write the result into data.json (key "bead").

Inputs (from the CPUC, Resolution T-17920 appendices, the version ratified September 17, 2026), kept in sources/bead/:
  fp_cai.csv                 community anchor institutions the funded projects plan to connect
  fp_deployment_projects.csv the funded projects (provider, BEAD support, technology, end date)
  fp_subgrantees.csv         the providers
Run:  python3 tools/bead.py   (then python3 tools/stamp.py)

Each mapped school gets one of two levels, or nothing:
  1 "listed"    - the school itself is on the anchor list: a listed school within 1 km has the same distinctive name words,
                  the same kind of school (elementary, middle, high) and is not a preschool, district office or program
  2 "same site" - not named, but a listed anchor of any kind sits within 150 m, so the funded line reaches its site
"""
import csv, json, math, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "sources" / "bead"
TECH = {"50": "Fiber", "70": "Unlicensed fixed wireless", "71": "Licensed fixed wireless", "72": "Licensed-by-rule fixed wireless",
        "60": "Geostationary satellite", "61": "Low-earth-orbit satellite"}
GENERIC = set("""SCHOOL SCH SCHS ELEMENTARY ELEM ELEMEN EL ES HIGH HS MIDDLE MS JR JUNIOR SR SENIOR THE OF AND AT
UNIFIED UNIF UNION UN JOINT DISTRICT DIST USD SD ESD CHARTER CHTR ACADEMY ACAD CENTER CTR COMMUNITY COMM
CONTINUATION CONT PRESCHOOL STATE INF PS K8 K12 TK PRIMARY INTERMEDIATE INT CO COUNTY""".split())


ROLE = set("""PRESCHOOL PS INF DIST DISTRICT OFFICE HEAD START ROP SPECIAL EDUCATION PROGRAMS ADULT SHELTER STORM
SD USD ESD CTR CENTER CAREER TECHNICAL DAY UNIF UNIFIED SCHS D""".split())
LEVEL = {"ELEMENTARY": "E", "ELEM": "E", "EL": "E", "ES": "E", "PRIMARY": "E", "HIGH": "H", "HS": "H", "SENIOR": "H", "SR": "H",
         "MIDDLE": "M", "MS": "M", "JUNIOR": "M", "JR": "M", "INTERMEDIATE": "M"}


def raw(name):
    s = re.sub(r"\(.*?\)", " ", name.upper()).replace("&", " AND ")
    return re.sub(r"[^A-Z0-9 ]", " ", s).split()


def same_kind(school, listed):
    a, b = set(raw(school)), set(raw(listed))
    if (b & ROLE) ^ (a & ROLE):  # a preschool, office, program or community day school on only one side
        return False
    la, lb = {LEVEL[w] for w in a if w in LEVEL}, {LEVEL[w] for w in b if w in LEVEL}
    return not (la and lb and not (la & lb))


def words(name):
    s = re.sub(r"\(.*?\)", " ", name.upper()).replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    return {w for w in s.split() if w not in GENERIC and len(w) > 1}


def provider(name):
    s = name.title()
    for a, b in ((" Llc", " LLC"), (", Llc", ", LLC"), ("At&T", "AT&T"), ("Wi-Fiber", "Wi-Fiber")):
        s = s.replace(a, b)
    return s


def metres(a, b, c, d):
    k = math.cos(math.radians(a))
    return math.hypot((b - d) * k, a - c) * 111_320


def rows(name):
    with open(SRC / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main():
    data_p = ROOT / "data.json"
    D = json.loads(data_p.read_text())
    cai = [r for r in rows("fp_cai.csv") if r["latitude"] and r["longitude"]]
    for r in cai:
        r["lat"], r["lng"], r["w"] = float(r["latitude"]), float(r["longitude"]), words(r["entity_name"])
    subs = {r["uei"]: r["uei_name"] for r in rows("fp_subgrantees.csv")}
    proj = {r["project_id"]: r for r in rows("fp_deployment_projects.csv")}

    out, n = {}, [0, 0, 0]
    for s in D["S"]:
        sid, name, lat, lng = s[0], s[1], s[9], s[10]
        sw = words(name)
        near = sorted(((metres(lat, lng, r["lat"], r["lng"]), r) for r in cai), key=lambda x: x[0])
        hit = None
        for dist, r in near:
            if dist > 1000:
                break
            if r["type"] == "S" and sw and r["w"] and (sw == r["w"] or ((sw <= r["w"] or r["w"] <= sw) and len(sw & r["w"]) >= 2)) and same_kind(name, r["entity_name"]):
                hit = (1, dist, r)
                break
        if not hit and near and near[0][0] <= 150:
            hit = (2, near[0][0], near[0][1])
        if not hit:
            n[0] += 1
            continue
        lvl, dist, r = hit
        n[lvl] += 1
        p = proj.get(r["project_id"], {})
        out[sid] = [lvl, r["entity_name"].title(), r["project_id"], provider(subs.get(p.get("uei"), p.get("project_description", ""))),
                    TECH.get(r["technology"], "Code " + r["technology"]), int(float(r["download_speed_anticipated"] or 0)),
                    int(float(r["upload_speed_anticipated"] or 0)), round(float(p.get("bead_support") or 0)),
                    (p.get("estimated_performance_end") or "")[:4], int(round(dist))]
    D["bead"] = out
    D["beadMeta"] = {"source": "CPUC Resolution T-17920, Appendix B (ratified September 17, 2026)",
                     "anchors": len(cai), "anchorSchools": sum(1 for r in cai if r["type"] == "S"), "projects": len(proj)}
    data_p.write_text(json.dumps(D, separators=(",", ":")))
    print("listed", n[1], "same site", n[2], "not in plan", n[0])


if __name__ == "__main__":
    main()
