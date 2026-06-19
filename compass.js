/* =====================================================================
   compass.js — Cône de direction sur le pointeur GPS
   ---------------------------------------------------------------------
   Autonome : se branche tout seul. La SEULE chose à faire dans
   index.html est d'ajouter, juste avant </body> :

       <script src="compass.js"></script>

   N'écrit RIEN dans index.html, ne modifie aucune fonction existante.
   Si la boussole n'est pas dispo, il ne se passe rien (point bleu normal).
   ===================================================================== */
(function(){
  var headingDeg = null;     // cap boussole (0 = Nord)
  var coneEl = null;         // l'élément HTML du cône
  var gotEvent = false;

  // 1. Injecter le style du cône.
  var css = document.createElement('style');
  css.textContent =
    '.wc-cone{position:absolute;left:50%;top:50%;width:40px;height:40px;' +
    'margin-left:-20px;margin-top:-40px;transform-origin:50% 100%;' +
    'pointer-events:none;z-index:500;' +
    'background:conic-gradient(from -22deg at 50% 100%,' +
    'rgba(66,133,244,0) 0deg,rgba(66,133,244,.55) 22deg,rgba(66,133,244,0) 44deg);' +
    'clip-path:polygon(50% 100%,0 0,100% 0);transition:transform .1s linear;}';
  document.head.appendChild(css);

  // 2. Trouver le conteneur du pointeur GPS sur la carte.
  //    Le pointeur est un circleMarker -> rendu dans le <svg> overlay de Leaflet.
  //    On crée notre propre cône en HTML, positionné sur la position GPS,
  //    via un overlay Leaflet dédié dès que la position est connue.
  function findMap(){
    // L'objet carte Leaflet est souvent dans window.map ; sinon on le cherche.
    if (window.map && window.map.getCenter) return window.map;
    // Recherche de secours : Leaflet stocke les instances sur les conteneurs.
    var c = document.querySelector('.leaflet-container');
    if (c && c._leaflet_map) return c._leaflet_map;
    return null;
  }

  function init(){
    var map = findMap();
    if (!map || !window.L){ return setTimeout(init, 400); }

    // Marqueur invisible qui porte notre cône, recollé sur la position GPS.
    var coneIcon = L.divIcon({
      className:'wc-cone-icon',
      iconSize:[0,0],
      html:'<div class="wc-cone" style="display:none"></div>'
    });
    var coneMarker = L.marker(map.getCenter(), {icon:coneIcon, interactive:false, zIndexOffset:900});

    // Suivre la position : on écoute les mêmes events GPS que l'app.
    map.on('locationfound', function(e){
      if (!coneMarker._map) coneMarker.addTo(map);
      coneMarker.setLatLng(e.latlng);
      grabConeEl(coneMarker);
      render();
    });

    // Si la position était déjà trouvée avant qu'on arrive, on tente quand même.
    setTimeout(function(){
      if (!coneMarker._map){ coneMarker.addTo(map); grabConeEl(coneMarker); }
    }, 1500);

    startCompass();
  }

  function grabConeEl(marker){
    var el = marker.getElement();
    if (el){ var c = el.querySelector('.wc-cone'); if (c) coneEl = c; }
  }

  function render(){
    if (!coneEl) return;
    if (headingDeg === null){ coneEl.style.display='none'; return; }
    coneEl.style.display='block';
    coneEl.style.transform = 'rotate(' + headingDeg + 'deg)';
  }

  // 3. Boussole.
  function onOrient(ev){
    gotEvent = true;
    var h = null;
    if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading;       // iOS
    else if (typeof ev.alpha === 'number') h = 360 - ev.alpha;                           // Android
    if (h === null || isNaN(h)) return;
    if (screen.orientation && typeof screen.orientation.angle === 'number') h -= screen.orientation.angle;
    h = ((h % 360) + 360) % 360;
    if (headingDeg === null) headingDeg = h;
    else { var d = h - headingDeg; while(d>180)d-=360; while(d<-180)d+=360; headingDeg = ((headingDeg + d*0.25)%360+360)%360; }
    render();
  }

  function attach(){
    if ('ondeviceorientationabsolute' in window)
      window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
  }

  var started = false;
  function startCompass(){
    if (started) return; started = true;
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'){
      DeviceOrientationEvent.requestPermission()
        .then(function(s){ if (s === 'granted') attach(); }).catch(function(){});
    } else attach();
  }
  // iOS exige un geste : on (re)tente au premier toucher.
  document.addEventListener('touchend', startCompass, {once:true});
  document.addEventListener('click', startCompass, {once:true});

  // Démarrage.
  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else window.addEventListener('load', init);
})();
