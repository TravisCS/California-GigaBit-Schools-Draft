#!/usr/bin/env python3
"""Bump the deploy stamp in index.html so browsers never pair a cached index.html with stale data files.
Run before committing a change to data.json, areas.json, california.json or the images:  python3 tools/stamp.py"""
import re, datetime, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "index.html"
s = p.read_text()
new = datetime.datetime.now().strftime("%Y%m%d-%H%M")
s2, n = re.subn(r'var V="\?v=[^"]*";', 'var V="?v=' + new + '";', s, count=1)
assert n == 1, "stamp not found"
p.write_text(s2)
print("stamped", new)
