#!/usr/bin/env python3
"""Rewrite the per-file version stamps in index.html (the VER map) from each data and image file's content hash,
so a cached index.html never pairs with a stale file and a deploy only re-downloads what changed.
Run before committing:  python3 tools/stamp.py"""
import hashlib, re, pathlib, json
root = pathlib.Path(__file__).resolve().parent.parent
p = root / "index.html"
s = p.read_text()
m = re.search(r'var VER=(\{[^}]*\});', s)
assert m, "VER map not found"
files = list(json.loads(m.group(1)).keys())
ver = {}
for f in files:
    fp = root / f
    ver[f] = hashlib.sha1(fp.read_bytes()).hexdigest()[:8] if fp.exists() else "0"
s2 = s[:m.start(1)] + json.dumps(ver, separators=(",", ":")) + s[m.end(1):]
s2 = re.sub(r'href="data\.json\?v=[^"]*"', 'href="data.json?v=' + ver["data.json"] + '"', s2, count=1)
p.write_text(s2)
print("stamped", ver)
