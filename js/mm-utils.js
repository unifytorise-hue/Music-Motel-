(function(){
  // Shared by ~25 other files that each used to redefine these identically.
  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }

  window.mmEscapeHtml = escapeHtml;
  window.mmConfigured = configured;
  window.mmCurrentUser = currentUser;

  // Shared by the two city-search widgets (js/signup-location.js's
  // location picker, js/hero-game.js's "sort by distance" search) — both
  // hit the free public Nominatim instance directly from the browser.
  // Fine for this demo's traffic, but Nominatim's usage policy caps it at
  // ~1 request/second and disallows autocomplete-style querying at real
  // production volume
  // (https://operations.osmfoundation.org/policies/nominatim/). Before
  // real launch traffic, swap this for a self-hosted Nominatim instance
  // or a paid geocoding provider.
  function nominatimSearch(query){
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&featuretype=city&q=' + encodeURIComponent(query);
    return fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } }).then(function(res){
      if (!res.ok) throw new Error('Lookup failed');
      return res.json();
    });
  }
  // A Nominatim result's city name and region live in nested/optional
  // address fields that need the same fallback chain wherever a result
  // is rendered.
  function nominatimResultLabel(r){
    var addr = r.address || {};
    var mainName = addr.city || addr.town || addr.village || addr.municipality || r.display_name.split(',')[0];
    var region = [addr.state, addr.country].filter(Boolean).join(', ');
    return { mainName: mainName, region: region };
  }
  window.mmNominatimSearch = nominatimSearch;
  window.mmNominatimResultLabel = nominatimResultLabel;
})();
