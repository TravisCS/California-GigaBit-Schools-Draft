/* Equity context overlays: CPUC low-income areas (PAU_LIA) and tribal lands (PAU_TRIBAL). */
(function () {
  "use strict";
  var B = window.BEADMAP;
  if (!B || !B.map || !B.L) return;
  var L = B.L, map = B.map;
  var box = document.getElementById("contextBox");
  if (!box) return;

  var STYLES = {
    lia: { color: "#f4d03f", weight: 0.8, opacity: 0.7, fill: true, fillColor: "#f4d03f", fillOpacity: 0.25 },
    tribal: { color: "#e74c3c", weight: 1, opacity: 0.9, fill: true, fillColor: "#e74c3c", fillOpacity: 0.35 }
  };

  box.innerHTML =
    '<details open><summary>Equity context</summary>' +
    '<label class="tier" style="grid-template-columns:18px 16px 1fr"><input type="checkbox" id="ctxLia">' +
    '<span class="sw" style="background:#f4d03f"></span><span>Low-income areas</span></label>' +
    '<label class="tier" style="grid-template-columns:18px 16px 1fr"><input type="checkbox" id="ctxTribal">' +
    '<span class="sw" style="background:#e74c3c"></span><span>Tribal lands</span></label>' +
    '<p class="note">Areas the CPUC\'s BEAD dashboard marks as low-income, and tribal lands. Shapes simplified to about 400 m.</p>' +
    '</details>';

  if (!map.getPane("context")) {
    var p = map.createPane("context");
    p.style.zIndex = 412;
    p.style.pointerEvents = "none";
  }
  var renderer = L.canvas({ pane: "context" });

  var layers = {}, loading = null;
  function load() {
    if (loading) return loading;
    loading = fetch(B.vq("context_layers.json"))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (gj) {
        (gj.features || []).forEach(function (f) {
          var k = f.properties && f.properties.k;
          if (!STYLES[k]) return;
          layers[k] = L.geoJSON(f, {
            pane: "context", interactive: false, renderer: renderer,
            style: function () { return STYLES[k]; }
          });
        });
      })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function wire(id, k) {
    var cb = document.getElementById(id);
    cb.addEventListener("change", function () {
      if (!cb.checked) { if (layers[k]) map.removeLayer(layers[k]); return; }
      load().then(function () {
        if (cb.checked && layers[k]) layers[k].addTo(map);
      }, function () {
        cb.checked = false;
        if (B.flash) B.flash("Could not load the overlay shapes. Please try again.", 4000);
      });
    });
  }
  wire("ctxLia", "lia");
  wire("ctxTribal", "tribal");
})();
