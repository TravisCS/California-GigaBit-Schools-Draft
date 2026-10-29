#!/usr/bin/env python3
"""Rewrite the per-file version stamps in index.html (the VER map) from each data and image file's content hash,
so a cached index.html never pairs with a stale file and a deploy only re-downloads what changed.
It also sets the "Last updated" date under the title to today.
Run before committing:  python3 tools/stamp.py"""
import hashlib, re, pathlib, json, datetime
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
today = datetime.date.today()
s2, n = re.subn(r'<time id="updated" datetime="[^"]*">[^<]*</time>',
                '<time id="updated" datetime="%s">%s %d, %d</time>' % (today.isoformat(), today.strftime("%B"), today.day, today.year), s2)
assert n == 1, "Last updated date not found"
p.write_text(s2)
print("stamped", ver, "updated", today.isoformat())
