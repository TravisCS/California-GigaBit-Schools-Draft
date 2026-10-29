/* Provider summary add-on: who the BEAD plan pays, and for what. Everything is computed from BEADMAP.getProjects(). */
(function () {
  "use strict";
  var tries = 0;
  (function wait() {
    if (window.BEADMAP && window.BEADMAP.loadProjects) return start(window.BEADMAP);
    if (++tries > 50) return; // about 10 s
    setTimeout(wait, 200);
  })();

  function start(B) {
    var box = document.getElementById("summaryBox");
    if (!box || box.querySelector(".sum-open")) return;
    var esc = B.esc, fmt = B.fmt, plural = B.plural;
    function money(n) { return n >= 1e9 ? "$" + (n / 1e9).toFixed(2) + " billion" : B.money(n); }
    var FIBER = "#9b59d0", WIRE = "#17b897", SAT = "#e6eaee";

    var css = document.createElement("style");
    css.textContent =
      "#sumSheet{position:fixed;inset:0;z-index:1250;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) calc(20px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));font-family:var(--serif)}" +
      "#sumSheet[hidden]{display:none}" +
      ".sum-card{max-width:720px;width:100%;box-sizing:border-box;padding:18px 22px;line-height:1.45;background:var(--panel);color:var(--ink);font-family:var(--serif);overflow-wrap:anywhere;max-height:none}" +
      ".sum-card:focus{outline:none}" +
      ".sum-card h2{margin:0 0 4px;font-size:22px}.sum-card h3{margin:18px 0 6px;font-size:17px}" +
      ".sum-x{float:right;position:sticky;top:0;z-index:2;margin-left:8px}" +
      ".sum-total{margin:2px 0 0;font-size:15.5px}" +
      ".sum-note{color:var(--muted);font-size:12.5px;line-height:1.35;margin:6px 0 0}" +
      ".sum-row{display:grid;grid-template-columns:14px minmax(0,1.3fr) minmax(0,1.6fr) auto;gap:4px 10px;align-items:center;padding:6px 0;border-top:1px solid var(--rule);font-variant-numeric:tabular-nums}" +
      ".sum-row.sum-head{border-top:0;color:var(--muted);font-size:12.5px;font-style:italic;padding-bottom:2px}" +
      ".sum-sw{width:14px;height:14px;border-radius:3px;border:1px solid rgba(0,0,0,.3);box-sizing:border-box}" +
      ".sum-name{font-weight:700;min-width:0}" +
      ".sum-barwrap{height:14px;background:var(--chip);border-radius:3px;min-width:0}" +
      ".sum-bar{height:100%;border-radius:3px;box-sizing:border-box;min-width:2px}" +
      ".sum-bar.sat{border:1.5px dashed #8a9199}" +
      ".sum-nums{display:flex;flex-wrap:wrap;gap:0 12px;justify-content:flex-end;text-align:right;font-size:13.5px}" +
      ".sum-nums span{white-space:nowrap}.sum-nums .sum-loc{font-weight:700}" +
      ".sum-tech{padding:8px 0;border-top:1px solid var(--rule);font-variant-numeric:tabular-nums}" +
      ".sum-tech .sum-th{display:flex;align-items:center;gap:8px;font-weight:700}" +
      ".sum-tech .sum-barwrap{margin:4px 0}" +
      ".sum-tech .sum-nums{justify-content:flex-start;text-align:left}" +
      ".sum-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}" +
      ".sum-list{list-style:none;margin:0;padding:0}" +
      ".sum-list button{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:5px 4px;border-top:1px solid var(--rule);font-family:var(--serif);font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums}" +
      ".sum-list button:focus-visible{background:var(--chip);outline:2px solid var(--accent);outline-offset:-1px}" +
      "@media (hover:hover){.sum-list button:hover{background:var(--chip)}}" +
      ".sum-list small{color:var(--muted);display:block;font-size:12.5px}" +
      ".sum-list b{white-space:nowrap}" +
      ".sum-src{margin-top:16px;padding-top:8px;border-top:1px solid var(--rule);color:var(--muted);font-size:12.5px}" +
      "@media (max-width:560px){.sum-card{padding:14px 14px}.sum-cols{grid-template-columns:1fr}" +
      ".sum-row{grid-template-columns:14px minmax(0,1fr)}.sum-row .sum-barwrap,.sum-row .sum-nums{grid-column:2}.sum-row .sum-nums{justify-content:flex-start;text-align:left}.sum-row.sum-head{display:none}}";
    document.head.appendChild(css);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn sum-open";
    btn.textContent = "Provider summary";
    btn.setAttribute("aria-haspopup", "dialog");
    box.appendChild(btn);

    var sheet = document.createElement("div");
    sheet.id = "sumSheet";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "sumH");
    document.body.appendChild(sheet);

    var opener = null;

    function techGroup(p) {
      if (p.g === "satellite") return "sat";
      if (p.g === "wireless") return "wire";
      if (p.g === "fiber" || /hybrid/i.test(p.tech || "")) return "fiber";
      return /satellite/i.test(p.tech || "") ? "sat" : /wireless/i.test(p.tech || "") ? "wire" : "fiber";
    }
    function dollars(n) { return "$" + fmt(Math.round(n)); }
    function cpl(usd, n) { return n > 0 ? dollars(usd / n) : "n/a"; }
    function billions(n) { return "$" + (n / 1e9).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + " billion"; }

    function compute() {
      var feats = (B.getProjects() && B.getProjects().features) || [];
      var items = feats.map(function (f) {
        var p = f.properties || {};
        return { f: f, p: p, who: p.who || "Unknown", n: +p.n || 0, usd: +p.usd || 0, grp: techGroup(p) };
      });
      var provs = {}, tot = { n: 0, usd: 0 };
      items.forEach(function (it) {
        var o = provs[it.who] || (provs[it.who] = { who: it.who, n: 0, usd: 0, k: 0 });
        o.n += it.n; o.usd += it.usd; o.k++;
        tot.n += it.n; tot.usd += it.usd;
      });
      var plist = Object.keys(provs).map(function (k) { return provs[k]; })
        .sort(function (a, b) { return b.n - a.n || (a.who < b.who ? -1 : 1); });
      var techs = { fiber: { n: 0, usd: 0, k: 0 }, wire: { n: 0, usd: 0, k: 0 }, sat: { n: 0, usd: 0, k: 0 } };
      items.forEach(function (it) { var t = techs[it.grp]; t.n += it.n; t.usd += it.usd; t.k++; });
      return { items: items, plist: plist, tot: tot, techs: techs };
    }

    function render() {
      var c = compute(), items = c.items;
      var h = '<button class="btn sum-x" id="sumClose" type="button">Close</button>';
      h += '<h2 id="sumH">Who the BEAD plan pays, and for what</h2>';
      if (!items.length) {
        h += '<p class="sum-total">Project data is not loaded yet. Close this and try again in a moment.</p>';
        sheet.innerHTML = '<div class="card sum-card" tabindex="-1" role="document">' + h + "</div>";
        return;
      }
      h += '<p class="sum-total">' + esc(billions(c.tot.usd)) + " to " + fmt(c.plist.length) + " providers for " +
        fmt(items.length) + " projects and " + fmt(c.tot.n) + " homes and businesses.</p>";

      // 1. by provider
      var top = c.plist.slice(0, 7), rest = c.plist.slice(7);
      var rows = top.map(function (o) { return { name: o.who, n: o.n, usd: o.usd, color: B.provColor(o.who), k: o.k }; });
      if (rest.length) {
        var ro = rest.reduce(function (a, o) { a.n += o.n; a.usd += o.usd; a.k += o.k; return a; }, { n: 0, usd: 0, k: 0 });
        rows.push({ name: "Other providers (" + rest.length + ")", n: ro.n, usd: ro.usd, k: ro.k, color: B.provColor(rest[0].who) });
      }
      var max = rows.reduce(function (m, r) { return Math.max(m, r.n); }, 1);
      h += "<h3>By provider</h3>";
      h += '<div class="sum-row sum-head"><span></span><span>Provider</span><span>Homes and businesses</span><span class="sum-nums"><span>Locations, BEAD dollars, per location</span></span></div>';
      rows.forEach(function (r) {
        h += '<div class="sum-row"><span class="sum-sw" style="background:' + esc(r.color) + '"></span>' +
          '<span class="sum-name">' + esc(r.name) + "</span>" +
          '<span class="sum-barwrap"><span class="sum-bar" style="display:block;width:' + (r.n / max * 100).toFixed(1) + "%;background:" + esc(r.color) + '"></span></span>' +
          '<span class="sum-nums"><span class="sum-loc">' + fmt(r.n) + " locations</span><span>" + esc(money(r.usd)) + "</span><span>" + esc(cpl(r.usd, r.n)) + " each</span></span></div>";
      });
      if (rest.length) {
        h += '<p class="sum-note">Other providers (' + rest.length + "): " +
          esc(rest.map(function (o) { return o.who; }).sort().join("; ")) + ".</p>";
      }

      // 2. by technology
      var defs = [
        { key: "fiber", label: "Fiber (includes Hybrid)", color: FIBER },
        { key: "wire", label: "Fixed wireless", color: WIRE },
        { key: "sat", label: "Satellite", color: SAT }
      ];
      h += "<h3>By technology</h3>";
      defs.forEach(function (d) {
        var t = c.techs[d.key], share = c.tot.n ? t.n / c.tot.n * 100 : 0;
        h += '<div class="sum-tech"><div class="sum-th"><span class="sum-sw" style="background:' + d.color + (d.key === "sat" ? ";border:1.5px dashed #8a9199" : "") + '"></span>' + esc(d.label) + "</div>" +
          '<div class="sum-barwrap"><div class="sum-bar' + (d.key === "sat" ? " sat" : "") + '" style="width:' + share.toFixed(1) + "%;background:" + d.color + '"></div></div>' +
          '<div class="sum-nums"><span>' + fmt(t.k) + " " + esc(plural(t.k, "project", "projects")) + "</span><span>" + fmt(t.n) + " locations</span><span>" +
          esc(money(t.usd)) + "</span><span>" + share.toFixed(1) + "% of locations</span><span>" + esc(cpl(t.usd, t.n)) + " per location</span></div></div>";
      });

      // 3. cost per location
      var ranked = items.filter(function (it) { return it.n > 0; }).map(function (it) { it.c = it.usd / it.n; return it; })
        .sort(function (a, b) { return b.c - a.c; });
      var hi = ranked.slice(0, 5), lo = ranked.slice(-5).reverse();
      function list(arr) {
        return '<ul class="sum-list">' + arr.map(function (it) {
          return '<li><button type="button" data-id="' + esc(String(it.p.id)) + '"><span>' + esc(it.who) + "<small>Project " + esc(String(it.p.id)) + " &middot; " + esc(it.p.tech || "") + "</small></span><b>" + dollars(it.c) + "</b></button></li>";
        }).join("") + "</ul>";
      }
      h += "<h3>Cost per location</h3>";
      h += '<div class="sum-cols"><div><div class="sum-note" style="margin:0 0 2px">Highest 5</div>' + list(hi) +
        '</div><div><div class="sum-note" style="margin:0 0 2px">Lowest 5</div>' + list(lo) + "</div></div>";
      var f = c.techs.fiber, s = c.techs.sat;
      if (f.n && s.n) {
        var fc = f.usd / f.n, sc = s.usd / s.n;
        h += '<p style="margin:10px 0 0">On average, fiber projects cost ' + dollars(fc) + " per location and satellite projects cost " + dollars(sc) +
          ", so satellite is " + (sc < fc ? "about " + Math.round((1 - sc / fc) * 100) + "% cheaper" : "about " + Math.round((sc / fc - 1) * 100) + "% more expensive") + " per location (averages are total dollars divided by total locations).</p>";
      }

      h += '<p class="sum-src">Source: CPUC BEAD final proposal map service, Projects layer (NTIA-approved July 2026). Costs are BEAD support divided by locations; they leave out each provider\'s own match.</p>';
      sheet.innerHTML = '<div class="card sum-card" tabindex="-1" role="document">' + h + "</div>";

      var byId = {};
      items.forEach(function (it) { byId[String(it.p.id)] = it.f; });
      Array.prototype.forEach.call(sheet.querySelectorAll(".sum-list button"), function (b) {
        b.onclick = function () {
          var feat = byId[b.getAttribute("data-id")];
          close(true);
          if (feat) B.openProject(feat);
        };
      });
      document.getElementById("sumClose").onclick = function () { close(); };
    }

    function open() {
      opener = btn;
      render();
      sheet.hidden = false;
      sheet.scrollTop = 0;
      var mp = document.getElementById("map");
      if (mp) mp.setAttribute("inert", "");
      var x = document.getElementById("sumClose") || sheet.querySelector("[tabindex]");
      if (x) x.focus();
    }
    function close(skipFocus) {
      if (sheet.hidden) return;
      sheet.hidden = true;
      var mp = document.getElementById("map");
      if (mp) mp.removeAttribute("inert");
      if (!skipFocus && opener && opener.focus) opener.focus();
    }

    btn.onclick = function () {
      btn.disabled = true;
      Promise.resolve(B.loadProjects()).then(function () { btn.disabled = false; open(); },
        function () { btn.disabled = false; B.flash("Could not load the projects."); });
    };
    sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
    document.addEventListener("keydown", function (e) {
      if (sheet.hidden) return;
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      else if (e.key === "Tab") {
        var f = Array.prototype.filter.call(sheet.querySelectorAll("button"), function (b) { return !b.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, true);
  }
})();
