// Address lookup for the California BEAD Plan map.
// Geocodes with Esri's World geocoder, then checks the point against the funded project areas
// (bead_areas.json, simplified to about 400 m) and the CPUC list of every funded BEAD location.
(function(){
"use strict";
function start(B){
  var box=document.getElementById("addrBox");
  if(!box||box.getAttribute("data-ready"))return;
  box.setAttribute("data-ready","1");
  var map=B.map,L=B.L,esc=B.esc;
  var GEO="https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
  var RADIUS=150,NEAR=40,TIMEOUT=12000;

  var css=document.createElement("style");
  css.textContent=
    "#addrBox{margin-top:8px}"+
    ".addr-form{display:flex;gap:6px;align-items:stretch;margin:0}"+
    ".addr-in{flex:1;min-width:0;box-sizing:border-box;font:16px var(--serif,serif);padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--chip);color:var(--ink)}"+
    ".addr-in::placeholder{color:var(--muted);opacity:1}"+
    ".addr-in:focus-visible,.addr-go:focus-visible{outline:2px solid var(--accent);outline-offset:1px}"+
    ".addr-go{flex:none;font:inherit;color:var(--ink)}"+
    ".addr-go[disabled]{opacity:.6;cursor:default}"+
    ".addr-st{margin:4px 0 0;min-height:1.3em;font-size:12.5px;line-height:1.3;color:var(--muted);overflow-wrap:anywhere}"+
    ".addr-st.err{color:var(--ink)}"+
    ".addr-pin{width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:#1d1c19;border:3px solid #fff;box-shadow:0 0 0 1.5px #1d1c19,0 2px 6px rgba(0,0,0,.5)}"+
    ".pc .addr-verdict{margin:0 0 8px;font-size:.95rem;line-height:1.3}"+
    ".pc .addr-verdict b{display:block;font-size:1.02rem}"+
    ".pc .addr-list{margin:4px 0 6px;padding-left:18px;font-size:.88rem}"+
    ".pc .addr-priv{margin:6px 0 0;font-size:.78rem;color:#5f5b50;line-height:1.35}";
  document.head.appendChild(css);

  box.innerHTML=
    '<form class="addr-form" role="search" autocomplete="off">'+
    '<input class="addr-in" type="search" enterkeyhint="search" maxlength="200" placeholder="Look up an address in California" aria-label="Look up an address in California" autocomplete="off" autocapitalize="off" spellcheck="false">'+
    '<button type="submit" class="btn addr-go">Find</button></form>'+
    '<p class="addr-st" role="status" aria-live="polite"></p>';
  var form=box.querySelector("form"),inp=box.querySelector(".addr-in"),go=box.querySelector(".addr-go"),st=box.querySelector(".addr-st");
  var pin=null,ctl=null,seq=0,timer=null;

  function say(msg,err){st.textContent=msg||"";st.className="addr-st"+(err?" err":"")}
  function clearPin(){if(pin){map.removeLayer(pin);pin=null}}
  function busy(on){go.disabled=on;go.textContent=on?"…":"Find"}

  inp.addEventListener("keydown",function(e){
    if(e.key==="Escape"){inp.value="";say("");if(ctl)ctl.abort();clearPin();map.closePopup()}
  });
  form.addEventListener("submit",function(e){e.preventDefault();search(inp.value.trim())});

  // fetch JSON with a timeout; tags failures so the messages can be friendly
  function getJSON(url,sig){
    return fetch(url,{signal:sig}).then(function(r){
      if(!r.ok){var e=new Error("http "+r.status);e.kind="net";throw e}
      return r.json();
    });
  }

  function geocode(text,sig,wide){
    var u=GEO+"?SingleLine="+encodeURIComponent(text)+"&f=json&maxLocations=5&countryCode=USA&outFields=Match_addr,Addr_type"+(wide?"":"&searchExtent=-124.6,32.3,-114.1,42.1");
    return getJSON(u,sig).then(function(j){
      if(j.error){var e=new Error("geocoder");e.kind="net";throw e}
      var c=(j.candidates||[]).filter(function(c){return c.score>=80&&c.location});
      // the extent only favors California; with no hit there, look anywhere so we can say "outside California" plainly
      if(!c.length&&!wide)return geocode(text,sig,true);
      return c.length?c[0]:null;
    });
  }
  function inCalifornia(c){
    var x=c.location.x,y=c.location.y;
    if(x<-124.6||x>-114.1||y<32.3||y>42.1)return false;
    var t=(c.attributes&&c.attributes.Match_addr||c.address||"");
    return /California|,\s*CA\b/i.test(t);
  }

  // point in polygon (ray casting) for one ring, then MultiPolygon with holes
  function inRing(x,y,r){
    var ins=false;
    for(var i=0,j=r.length-1;i<r.length;j=i++){
      var xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];
      if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins;
    }
    return ins;
  }
  function inGeom(g,x,y){
    var polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
    for(var p=0;p<polys.length;p++){
      var rings=polys[p];
      if(!rings.length||!inRing(x,y,rings[0]))continue;
      var hole=false;
      for(var h=1;h<rings.length;h++)if(inRing(x,y,rings[h])){hole=true;break}
      if(!hole)return true;
    }
    return false;
  }
  function projectsAt(x,y){
    var gj=B.getProjects();
    if(!gj)return [];
    return gj.features.filter(function(f){return inGeom(f.geometry,x,y)});
  }

  function dist(lat1,lng1,lat2,lng2){
    var R=6371000,r=Math.PI/180,dl=(lat2-lat1)*r,dg=(lng2-lng1)*r;
    var a=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dg/2)*Math.sin(dg/2);
    return 2*R*Math.asin(Math.sqrt(a));
  }
  function bsl(x,y,sig){
    var u=B.BSL_URL+"?geometry="+x+","+y+"&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance="+RADIUS+"&units=esriSRUnit_Meter&outFields=*&returnGeometry=true&outSR=4326&f=json";
    return getJSON(u,sig).then(function(j){
      if(j.error){var e=new Error("cpuc");e.kind="net";throw e}
      return (j.features||[]).filter(function(f){return f.geometry&&f.attributes}).map(function(f){
        return {a:f.attributes,d:dist(y,x,f.geometry.y,f.geometry.x)};
      }).sort(function(p,q){return p.d-q.d});
    });
  }

  // "15223 Cassia Ave" -> ["15223","CASSIA"]; the first street word is enough to tell neighbours apart
  function key(s){
    var m=String(s||"").toUpperCase().replace(/[.,#]/g," ").trim().split(/\s+/);
    if(!m[0]||!/^\d+/.test(m[0]))return null;
    var w=m.slice(1).filter(function(t){return !/^(N|S|E|W|NORTH|SOUTH|EAST|WEST|NE|NW|SE|SW)$/.test(t)});
    return w.length?[m[0],w[0]]:null;
  }
  function pickHere(list,matchStreet){
    var k=key(matchStreet);
    if(k){
      for(var i=0;i<list.length;i++){
        var q=key(list[i].a.address_primary);
        if(q&&q[0]===k[0]&&q[1]===k[1])return list[i];
      }
    }
    return list.length&&list[0].d<=NEAR?list[0]:null;
  }

  function tc(x){return String(x||"").toLowerCase().replace(/\b([a-z])/g,function(m){return m.toUpperCase()}).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g,function(m,n,s){return n+s.toLowerCase()})}
  function cleanAddr(a){return String(a||"").replace(/,\s*(California|United States)\b.*$/i,", CA").replace(/,\s*CA,\s*(\d{5}).*$/,", CA $1")}

  function card(c,here,list,projs){
    var addr=cleanAddr(c.attributes&&c.attributes.Match_addr||c.address);
    var type=c.attributes&&c.attributes.Addr_type;
    var coarse=type&&!/PointAddress|StreetAddress|Subaddress|StreetInt|StreetName/i.test(type);
    var h='<div class="pc"><h3>'+esc(addr)+'</h3>';
    h+='<p class="meta">'+(coarse?'Esri could only place this at the center of the area. Type a full street address for a closer answer.':'Found on the map.')+'</p>';
    var proj=null;
    if(here){
      var a=here.a;
      var gj=B.getProjects();
      proj=((gj&&gj.features)||[]).filter(function(f){return f.properties.id===a.project_id})[0]||null;
      var un=/unserved/i.test(a.classification||"");
      h+='<p class="addr-verdict"><b>In the BEAD plan</b>The plan funds a connection at '+(here.d<=NEAR?'this address':'<span>'+esc(tc(a.address_primary))+' ('+Math.round(here.d)+' m away)</span>')+'.</p>';
      h+='<table><tr><td>Provider</td><td>'+esc(a.awardee||"")+'</td></tr>'+
         '<tr><td>Technology</td><td>'+esc(a.technology||"")+'</td></tr>'+
         '<tr><td>Status</td><td>'+(un?'Unserved':/underserved/i.test(a.classification||"")?'Underserved':esc(a.classification||"Not stated"))+'</td></tr>'+
         '<tr><td>Project</td><td>'+esc(a.project_id||a.projID||"")+'</td></tr></table>';
      if(proj)h+='<p class="closerow"><button type="button" class="btn" data-addr-proj="1">Project card</button></p>';
    }else if(projs.length){
      h+='<p class="addr-verdict"><b>Inside a funded project\'s area, but this address is not on the plan\'s list</b>It may already have service, or it was not counted. Project areas on this map are approximate (about 400 m).</p><ul class="addr-list">';
      projs.slice(0,6).forEach(function(f){h+='<li>'+esc(f.properties.who)+', '+esc(f.properties.tech)+' (project '+esc(f.properties.id)+')</li>'});
      if(projs.length>6)h+='<li>and '+(projs.length-6)+' more</li>';
      h+='</ul>';
    }else{
      h+='<p class="addr-verdict"><b>Not in a funded BEAD project area</b>No funded project area on this map covers this point (areas are approximate, about 400 m).</p>';
    }
    h+='<p class="note">'+(list.length?list.length+' funded '+B.plural(list.length,"location")+' within '+RADIUS+' m'+(here?'.':'. The nearest is '+esc(tc(list[0].a.address_primary))+', '+Math.round(list[0].d)+' m away ('+esc(list[0].a.awardee||"")+').'):'No funded locations within '+RADIUS+' m.')+'</p>';
    h+='<p class="addr-priv">Your address goes to Esri\'s geocoder to find it on the map; this map keeps nothing.</p>';
    h+='<p class="closerow"><button type="button" class="btn" data-close="1">Close</button></p></div>';
    return {html:h,proj:proj};
  }

  function fail(e){
    if(e&&e.name==="AbortError"&&!e.timedOut)return;
    say(e&&e.timedOut?"That took too long. Check your connection and try again.":"The lookup could not reach its map services. Check your connection and try again.",true);
  }

  function search(text){
    if(ctl)ctl.abort();
    clearTimeout(timer);
    clearPin();map.closePopup();
    if(!text){say("Type an address first.",true);return}
    var my=++seq,c1=new AbortController();ctl=c1;
    timer=setTimeout(function(){c1.timedOut=true;c1.abort()},TIMEOUT);
    // an abort from our own timer reads as a timeout; any other abort means a newer search took over
    function tag(e){if(c1.timedOut&&e&&e.name==="AbortError")e.timedOut=true;throw e}
    busy(true);say("Looking up that address…");
    var found;
    geocode(text,c1.signal).catch(tag).then(function(c){
      if(my!==seq)return;
      if(!c){say("No match for that address. Try a street, city and state, like 15223 Cassia Ave, Lucerne Valley, CA.",true);return}
      if(!inCalifornia(c)){say("That address is outside California, so the BEAD plan map does not cover it.",true);return}
      found=c;
      var x=c.location.x,y=c.location.y;
      say("Checking the funded projects…");
      return Promise.all([
        B.loadProjects().then(function(){return projectsAt(x,y)}),
        bsl(x,y,c1.signal)
      ]).catch(tag).then(function(r){
        if(my!==seq)return;
        var projs=r[0],list=r[1];
        var addr=cleanAddr(c.attributes&&c.attributes.Match_addr||c.address);
        var here=pickHere(list,String(addr).split(",")[0]);
        var res=card(c,here,list,projs);
        var ll=L.latLng(y,x);
        pin=L.marker(ll,{icon:L.divIcon({className:"",html:'<div class="addr-pin"></div>',iconSize:[18,18],iconAnchor:[9,9]}),keyboard:false,interactive:false,zIndexOffset:2000}).addTo(map);
        B.collapseLegend();
        B.afterMove(function(){B.flyTo(ll.toBounds(300),15)},function(){
          if(my!==seq)return;
          var pop=L.popup({maxWidth:320,offset:[0,-8]}).setLatLng(ll).setContent(res.html).openOn(map);
          if(res.proj){
            var el=pop.getElement();
            var b=el&&el.querySelector("[data-addr-proj]");
            if(b)b.addEventListener("click",function(){B.openProject(res.proj)});
          }
        });
        say(here?"In the BEAD plan: "+(here.a.awardee||"")+", "+(here.a.technology||"")+".":projs.length?"Inside a funded project's area, but not on the plan's list.":"Not in a funded BEAD project area.");
      });
    }).catch(function(e){if(my===seq)fail(e)}).then(function(){
      if(my===seq){clearTimeout(timer);busy(false);ctl=null}
    });
  }
}
function wait(n){
  if(window.BEADMAP&&window.BEADMAP.map)return start(window.BEADMAP);
  if(n>0)setTimeout(function(){wait(n-1)},200);
}
wait(50);
})();
