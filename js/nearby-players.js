(function(){
  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  // Same formula as window.mmHaversineKm in js/hero-game.js — duplicated
  // rather than shared, since hero-game.js (the hero "build your band" map
  // game) only loads on index.html, not here.
  function haversineKm(lat1, lng1, lat2, lng2){
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Captured once, before any render clears #nearby-players-list via
  // innerHTML — that placeholder is a child of the list, so re-querying it
  // by id after the first non-empty render would return null (same bug
  // already fixed in js/invite-gig-follow.js and js/booking-requests.js).
  var nearbyEmptyEl = document.getElementById('nearby-players-empty');

  // Radius options are fixed thresholds in km (the canonical unit distance
  // is always computed/stored in, same pattern as money is always USD
  // internally) — only the option *label* is shown in the visitor's
  // preferred unit, via the same mmFormatDistanceKm() used for the
  // per-profile distance tags, so the two stay visually consistent.
  var RADIUS_OPTIONS_KM = [0, 50, 100, 250, 500];

  function radiusLabel(km){
    if (km === 0) return 'Any distance';
    var formatted = window.mmFormatDistanceKm ? window.mmFormatDistanceKm(km) : (km + ' km away');
    return 'Within ' + formatted.replace(/ away$/, '');
  }

  function populateRadiusFilter(){
    var sel = document.getElementById('nearby-radius-filter');
    if (!sel) return;
    var prevValue = sel.value || '0';
    sel.innerHTML = '';
    RADIUS_OPTIONS_KM.forEach(function(km){
      var opt = document.createElement('option');
      opt.value = String(km);
      opt.textContent = radiusLabel(km);
      sel.appendChild(opt);
    });
    sel.value = prevValue;
  }

  var allProfiles = [];   // everyone except me, with _distanceKm attached when known
  var myLocation = null;  // { lat, lng } from my own profile row, if set

  function loadProfiles(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('profiles')
      .select('id,name,account_type,role_label,bio,location_label,lat,lng,avatar_color,avatar_url,profile_kind,instruments')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function loadAndRenderNearby(){
    if (!isSignedIn()) return;
    loadProfiles().then(function(rows){
      var myId = currentUser().id;
      var me = rows.filter(function(r){ return r.id === myId; })[0];
      myLocation = (me && me.lat != null && me.lng != null) ? { lat: me.lat, lng: me.lng } : null;

      allProfiles = rows.filter(function(r){ return r.id !== myId; });
      allProfiles.forEach(function(p){
        p._distanceKm = (myLocation && p.lat != null && p.lng != null)
          ? haversineKm(myLocation.lat, myLocation.lng, p.lat, p.lng)
          : null;
      });
      if (myLocation){
        allProfiles.sort(function(a, b){
          if (a._distanceKm == null) return 1;
          if (b._distanceKm == null) return -1;
          return a._distanceKm - b._distanceKm;
        });
      } else {
        allProfiles.sort(function(a, b){ return (a.name || '').localeCompare(b.name || ''); });
      }

      populateRadiusFilter();
      renderList();
    });
  }

  function renderList(){
    var card = document.getElementById('nearby-players-card');
    var list = document.getElementById('nearby-players-list');
    var note = document.getElementById('nearby-no-location-note');
    if (!card || !list) return;

    card.style.display = 'block';
    note.style.display = myLocation ? 'none' : 'block';

    var radiusKm = parseInt((document.getElementById('nearby-radius-filter') || {}).value || '0', 10);
    var visible = allProfiles.filter(function(p){
      if (!radiusKm) return true;
      return p._distanceKm != null && p._distanceKm <= radiusKm;
    });

    if (!visible.length){
      list.innerHTML = '';
      list.appendChild(nearbyEmptyEl);
      return;
    }
    list.innerHTML = '';
    visible.forEach(function(p){
      var isBand = p.profile_kind === 'band';
      var subBits = [];
      var roleAndType = window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(p) : '';
      if (roleAndType) subBits.push(roleAndType);
      if (p.location_label) subBits.push(p.location_label);
      if (p._distanceKm != null && window.mmFormatDistanceKm) subBits.push(window.mmFormatDistanceKm(p._distanceKm));

      var item = document.createElement('div');
      item.className = 'gig-log-item tappable';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', 'View profile for ' + p.name);
      item.innerHTML =
        '<span class="player-avatar"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(p.name) + (isBand ? ' · BAND' : '') + '</h5>' +
        '<p>' + escapeHtml(subBits.join(' · ')) + '</p></div>' +
        '<span class="gig-log-chevron">→</span>';
      if (window.mmRenderAvatar) window.mmRenderAvatar(item.querySelector('.player-avatar'), p.avatar_url, p.avatar_color, p.name);
      function activate(){
        if (window.openRealProfile) window.openRealProfile(p, p._distanceKm);
      }
      item.addEventListener('click', activate);
      item.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activate(); }
      });
      list.appendChild(item);
    });
  }

  document.addEventListener('change', function(e){
    if (e.target && e.target.id === 'nearby-radius-filter') renderList();
  });

  function refreshAll(){
    var card = document.getElementById('nearby-players-card');
    if (!card) return;
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    loadAndRenderNearby();
  }
  window.refreshNearbyPlayers = refreshAll;

  authReady.then(refreshAll);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ refreshAll(); });
  }
})();
