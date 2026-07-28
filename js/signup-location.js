(function(){
  // ===== signup modal open/close =====
  function openSignup(){
    document.getElementById('signup-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(document.getElementById('signup-modal'));
  }
  function closeSignup(){
    document.getElementById('signup-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
    window.__mmCompletingProfile = false;
    // Only restore these when a backend actually exists — in preview-only
    // mode they're meant to stay hidden (matches the original unconfigured
    // behavior; renderAuthUI() itself never touches them when !configured).
    if (window.mmAuth && window.mmAuth.isConfigured()){
      document.getElementById('signup-auth-fields').style.display = '';
      document.getElementById('google-auth-section-signup').style.display = '';
    }
    document.getElementById('signup-title').textContent = 'Create your profile';
  }
  window.openSignup = openSignup;
  window.openSignupWithRole = function(roleName){
    document.getElementById('signup-role').value = roleName;
    openSignup();
  };

  // Reuses the same form as a fresh signup, just without email/password —
  // this visitor is already authenticated (arrived via Google), so those
  // fields don't apply. Called from js/auth.js once per sign-in when it
  // finds no public.profiles row for the now-signed-in user.
  window.openProfileCompletion = function(user){
    window.__mmCompletingProfile = true;
    document.getElementById('signup-auth-fields').style.display = 'none';
    // Already authenticated via Google — a second "Continue with Google"
    // button here would make no sense. Set directly (rather than relying
    // on the next renderAuthUI() call) since one already ran for this
    // sign-in before __mmCompletingProfile existed.
    document.getElementById('google-auth-section-signup').style.display = 'none';
    document.getElementById('signup-title').textContent = 'Finish setting up your profile';
    var nameField = document.getElementById('signup-name');
    var meta = user && user.user_metadata;
    if (meta && !nameField.value) nameField.value = meta.full_name || meta.name || '';
    openSignup();
  };
  ['open-signup-nav','open-signup-hero','open-signup-final','open-signup-mobile'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function(e){ e.preventDefault(); closeMobileMenu(); openSignup(); });
  });
  document.getElementById('signup-close-btn').addEventListener('click', closeSignup);
  document.getElementById('signup-modal').addEventListener('click', function(e){
    if (e.target.id === 'signup-modal') closeSignup();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('signup-modal').classList.contains('open')) closeSignup();
  });

  // ===== location tabs =====
  var map, marker;
  var mapInitialized = false;

  function switchPane(paneName){
    document.querySelectorAll('.loc-tab').forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-pane') === paneName);
    });
    document.querySelectorAll('.loc-pane').forEach(function(p){
      p.classList.toggle('active', p.getAttribute('data-pane') === paneName);
    });
    if (paneName === 'map' && !mapInitialized){
      mapLoadAttempts = 0;
      document.getElementById('loc-map').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--cream-dim);font-family:JetBrains Mono, monospace;font-size:12px;">Loading map…</div>';
      initMap();
    }
    if (paneName === 'map' && map){
      setTimeout(function(){ map.invalidateSize(); }, 80);
    }
  }
  document.querySelectorAll('.loc-tab').forEach(function(tab){
    tab.addEventListener('click', function(){ switchPane(tab.getAttribute('data-pane')); });
  });

  // ===== shared: setting the final location value =====
  var selectedLat = null, selectedLng = null;
  function setLocation(label, lat, lng){
    selectedLat = lat;
    selectedLng = lng;
    var sel = document.getElementById('loc-selected');
    document.getElementById('loc-selected-text').textContent = label;
    document.getElementById('loc-selected-coords').textContent =
      lat != null ? lat.toFixed(3) + ', ' + lng.toFixed(3) : '';
    sel.classList.add('show');
    var submit = document.getElementById('signup-submit-btn');
    submit.disabled = false;
    var typeFn = window.getCurrentAccountType;
    var type = typeFn ? typeFn() : 'fan';
    var cfgFn = window.getAccountTypeConfig;
    var cfg = cfgFn ? cfgFn(type) : null;
    submit.textContent = cfg ? cfg.submitLabel : ('Create profile in ' + label.split(',')[0]);

    if (map){
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map);
      map.setView([lat, lng], 9);
    }
  }
  document.getElementById('loc-clear-btn').addEventListener('click', function(){
    document.getElementById('loc-selected').classList.remove('show');
    var submit = document.getElementById('signup-submit-btn');
    submit.disabled = true;
    submit.textContent = 'Set a location to continue';
    if (marker && map){ map.removeLayer(marker); marker = null; }
  });

  // ===== mode 1: city search via Nominatim =====
  var searchInput = document.getElementById('loc-search-input');
  var suggestionsBox = document.getElementById('loc-suggestions');
  var statusEl = document.getElementById('loc-search-status');
  var searchDebounce;

  // Escapes text before it's placed into innerHTML below. mainName/region
  // come from Nominatim and query is the user's raw typed input, both of
  // which need escaping since they're inserted as HTML, not just text.
  function escapeHtmlLoc(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  searchInput.addEventListener('input', function(){
    var q = searchInput.value.trim();
    clearTimeout(searchDebounce);
    if (q.length < 2){
      suggestionsBox.classList.remove('show');
      statusEl.textContent = '';
      return;
    }
    statusEl.textContent = 'Searching…';
    searchDebounce = setTimeout(function(){ runCitySearch(q); }, 350);
  });

  // All three calls to nominatim.openstreetmap.org in this file (city
  // search here, plus the two reverse-geocode calls below) hit the free
  // public Nominatim instance directly from the browser. That's fine for
  // this demo's traffic, but Nominatim's usage policy caps it at ~1
  // request/second and disallows autocomplete-style querying at real
  // production volume (https://operations.osmfoundation.org/policies/nominatim/).
  // Before real launch traffic, swap these for a self-hosted Nominatim
  // instance or a paid geocoding provider.
  function runCitySearch(query){
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&featuretype=city&q=' + encodeURIComponent(query);
    fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } })
      .then(function(res){
        if (!res.ok) throw new Error('Lookup failed');
        return res.json();
      })
      .then(function(results){
        renderSuggestions(results, query);
      })
      .catch(function(){
        statusEl.textContent = 'Could not reach the location service — check your connection and try again.';
        suggestionsBox.classList.remove('show');
      });
  }

  function renderSuggestions(results, query){
    suggestionsBox.innerHTML = '';
    if (!results || results.length === 0){
      statusEl.textContent = 'No matches for "' + query + '". Try a different spelling.';
      suggestionsBox.classList.remove('show');
      return;
    }
    statusEl.textContent = results.length + ' match' + (results.length === 1 ? '' : 'es') + ' found';
    results.forEach(function(r){
      var addr = r.address || {};
      var mainName = addr.city || addr.town || addr.village || addr.municipality || r.display_name.split(',')[0];
      var region = [addr.state, addr.country].filter(Boolean).join(', ');
      var item = document.createElement('div');
      item.className = 'loc-suggestion-item';
      item.innerHTML = '<div class="city-main">' + escapeHtmlLoc(mainName) + '</div><div class="city-sub">' + escapeHtmlLoc(region) + '</div>';
      item.addEventListener('click', function(){
        var label = region ? (mainName + ', ' + region) : mainName;
        setLocation(label, parseFloat(r.lat), parseFloat(r.lon));
        searchInput.value = label;
        suggestionsBox.classList.remove('show');
        statusEl.textContent = 'Location set ✓';
      });
      suggestionsBox.appendChild(item);
    });
    suggestionsBox.classList.add('show');
  }

  document.addEventListener('click', function(e){
    if (!e.target.closest('.loc-search-wrap')){
      suggestionsBox.classList.remove('show');
    }
  });

  // ===== mode 2: live GPS geolocation =====
  var gpsBtn = document.getElementById('loc-gps-btn');
  var gpsIcon = document.getElementById('loc-gps-icon');
  var gpsStatus = document.getElementById('loc-gps-status');
  var gpsBtnText = document.getElementById('loc-gps-btn-text');

  gpsBtn.addEventListener('click', function(){
    if (!('geolocation' in navigator)){
      gpsStatus.textContent = 'Your browser does not support geolocation.';
      gpsStatus.className = 'loc-gps-status error';
      return;
    }
    gpsBtn.disabled = true;
    gpsIcon.classList.add('pulsing');
    gpsBtnText.textContent = 'Locating…';
    gpsStatus.textContent = 'Waiting for your browser\'s location permission…';
    gpsStatus.className = 'loc-gps-status';

    navigator.geolocation.getCurrentPosition(function(pos){
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      reverseGeocode(lat, lng);
    }, function(err){
      gpsBtn.disabled = false;
      gpsIcon.classList.remove('pulsing');
      gpsBtnText.textContent = 'Use my current location';
      var msg = 'Could not get your location.';
      if (err.code === 1) msg = 'Location permission was denied. You can still search or tap the map instead.';
      if (err.code === 2) msg = 'Your location is currently unavailable. Try search or the map instead.';
      if (err.code === 3) msg = 'Location request timed out. Try again, or use search.';
      gpsStatus.textContent = msg;
      gpsStatus.className = 'loc-gps-status error';
    }, { enableHighAccuracy:true, timeout:10000 });
  });

  function reverseGeocode(lat, lng){
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1';
    fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } })
      .then(function(res){ return res.json(); })
      .then(function(data){
        var addr = (data && data.address) || {};
        var mainName = addr.city || addr.town || addr.village || addr.municipality || 'Unknown city';
        var region = [addr.state, addr.country].filter(Boolean).join(', ');
        var label = region ? (mainName + ', ' + region) : mainName;
        setLocation(label, lat, lng);
        gpsBtn.disabled = false;
        gpsIcon.classList.remove('pulsing');
        gpsBtnText.textContent = 'Use my current location';
        gpsStatus.textContent = 'Location set: ' + label + ' ✓';
        gpsStatus.className = 'loc-gps-status success';
      })
      .catch(function(){
        // Still set the coordinates even if reverse lookup fails
        setLocation(lat.toFixed(2) + ', ' + lng.toFixed(2), lat, lng);
        gpsBtn.disabled = false;
        gpsIcon.classList.remove('pulsing');
        gpsBtnText.textContent = 'Use my current location';
        gpsStatus.textContent = 'Got your coordinates, but couldn\'t look up the city name.';
        gpsStatus.className = 'loc-gps-status error';
      });
  }

  // ===== mode 3: tap on map =====
  var mapLoadAttempts = 0;

  function showMapFallback(){
    document.getElementById('loc-map').innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;height:100%;color:var(--cream-dim);font-family:JetBrains Mono, monospace;font-size:12px;text-align:center;padding:20px;">' +
      '<span>Map tiles couldn\'t load — this needs a live internet connection to fetch OpenStreetMap data.<br>Try Search or Nearby instead, or retry below.</span>' +
      '<button type="button" id="map-retry-btn" style="font-family:JetBrains Mono, monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--cyan);border:1.5px solid var(--cyan);border-radius:999px;padding:8px 16px;">Retry</button>' +
      '</div>';
    var retryBtn = document.getElementById('map-retry-btn');
    if (retryBtn){
      retryBtn.addEventListener('click', function(){
        mapLoadAttempts = 0;
        document.getElementById('loc-map').innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--cream-dim);font-family:JetBrains Mono, monospace;font-size:12px;">Loading map…</div>';
        initMap();
      });
    }
  }

  function initMap(){
    if (typeof L === 'undefined'){
      mapLoadAttempts++;
      // Leaflet's script tag may still be downloading — give it a few short retries
      // before concluding the network is actually unavailable.
      if (mapLoadAttempts <= 6){
        setTimeout(initMap, 400);
        return;
      }
      showMapFallback();
      return;
    }
    mapLoadAttempts = 0;
    mapInitialized = true;
    map = L.map('loc-map', { worldCopyJump:true }).setView([20, 10], 2);
    var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    });
    var tilesFailed = false;
    tileLayer.on('tileerror', function(){
      if (tilesFailed) return;
      tilesFailed = true;
      showMapFallback();
    });
    tileLayer.addTo(map);

    map.on('click', function(e){
      var lat = e.latlng.lat, lng = e.latlng.lng;
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map);
      reverseGeocodeForMap(lat, lng);
    });
  }

  function reverseGeocodeForMap(lat, lng){
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1';
    fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } })
      .then(function(res){ return res.json(); })
      .then(function(data){
        var addr = (data && data.address) || {};
        var mainName = addr.city || addr.town || addr.village || addr.municipality || 'Pinned location';
        var region = [addr.state, addr.country].filter(Boolean).join(', ');
        var label = region ? (mainName + ', ' + region) : mainName;
        setLocation(label, lat, lng);
      })
      .catch(function(){
        setLocation(lat.toFixed(2) + ', ' + lng.toFixed(2), lat, lng);
      });
  }

  // ===== submit =====
  var PAID_TIERS = {
    educator: { label: 'Educator', price: '$12/mo' },
    venue: { label: 'Talent Booker', price: '$29/mo' },
    publicspace: { label: 'Public Space', price: '$39/mo' }
  };

  // No backend configured yet: keep the original preview-only flow exactly
  // as it was, so the demo experience is unchanged until a real anon key
  // is wired up in js/supabase-client.js.
  function submitPreviewOnly(name, loc, type, role){
    if (PAID_TIERS[type]){
      var tier = PAID_TIERS[type];
      alert('Account draft ready:\n\n' + name + ' (' + tier.label + ')\n' + loc + (role ? '\n' + role : '') +
        '\n\nNext step would be subscription checkout at ' + tier.price + ' via your payment provider.\n(Hook this up to Stripe Billing or similar — everything above this point is already captured.)');
    } else if (type === 'fan'){
      alert('Fan profile ready:\n\n' + name + '\n' + loc + (role ? '\nInterests: ' + role : '') +
        '\n\n(Hook this up to your backend next — fans get a gig log and a following feed once that exists.)');
    } else {
      alert('Profile draft ready:\n\n' + name + '\n' + loc + (role ? '\n' + role : '') +
        '\n\n(Hook this up to your backend / database next — the location data is already captured above.)');
    }
  }

  // Inserts the public.profiles row for a user who's already authenticated
  // (arrived via Google, or — in principle — any other OAuth provider
  // added later) and just needs the app-specific fields this form
  // collects. Shared tail end of both submitReal() below and the
  // completing-profile path, so the profile-insert logic (and its
  // referral/PAID_TIERS follow-ups) only exists once.
  function insertProfileForUser(user, name, loc, type, role, statusEl, submitBtn){
    return window.mmSupabase.from('profiles').insert({
      id: user.id,
      account_type: type,
      name: name,
      role_label: role,
      location_label: loc,
      lat: selectedLat,
      lng: selectedLng,
      profile_kind: window.getCurrentProfileKind ? window.getCurrentProfileKind() : 'personal'
    }).then(function(profileRes){
      if (profileRes.error) throw profileRes.error;
      if (window.recordReferralIfAny) window.recordReferralIfAny(user.id);
      if (window.syncReferralCodeForUser) window.syncReferralCodeForUser(user.id);
      if (window.mmAuth && window.mmAuth.refreshOwnProfile) window.mmAuth.refreshOwnProfile();
      statusEl.textContent = '';
      submitBtn.disabled = false;
      document.getElementById('signup-email').value = '';
      document.getElementById('signup-password').value = '';
      closeSignup();
      if (PAID_TIERS[type]){
        var tier = PAID_TIERS[type];
        alert('Profile created for ' + name + ' (' + tier.label + ').\n\nNext step would be subscription checkout at ' + tier.price + ' via your payment provider.\n(Hook this up to Stripe Billing or similar.)');
      }
    });
  }

  // Real account creation: supabase.auth.signUp() followed by a row in
  // public.profiles. Errors surface inline in #signup-status rather than
  // via alert(), since a failed signUp shouldn't look identical to success.
  function submitReal(name, loc, type, role){
    var statusEl = document.getElementById('signup-status');
    var submitBtn = document.getElementById('signup-submit-btn');

    // Already authenticated (arrived via Google) — just needs the profile
    // row, no email/password to collect or a second signUp() call to make.
    var existingUser = window.mmAuth.getUser();
    if (window.__mmCompletingProfile && existingUser){
      submitBtn.disabled = true;
      statusEl.textContent = 'Saving your profile…';
      insertProfileForUser(existingUser, name, loc, type, role, statusEl, submitBtn).catch(function(err){
        submitBtn.disabled = false;
        statusEl.textContent = (err && err.message) || 'Something went wrong saving your profile.';
      });
      return;
    }

    var email = document.getElementById('signup-email').value.trim();
    var password = document.getElementById('signup-password').value;

    if (!email || !password){
      statusEl.textContent = 'Enter an email and password to create your account.';
      return;
    }
    if (password.length < 6){
      statusEl.textContent = 'Password must be at least 6 characters.';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Creating your account…';

    window.mmAuth.signUp(email, password).then(function(res){
      if (res.error) throw res.error;
      var user = res.data && res.data.user;
      if (!user){
        throw new Error('Check your email to confirm your account, then sign in.');
      }
      return insertProfileForUser(user, name, loc, type, role, statusEl, submitBtn);
    }).catch(function(err){
      submitBtn.disabled = false;
      statusEl.textContent = (err && err.message) || 'Something went wrong creating your account.';
    });
  }

  document.getElementById('signup-submit-btn').addEventListener('click', function(){
    var name = document.getElementById('signup-name').value.trim() || 'New member';
    var loc = document.getElementById('loc-selected-text').textContent;
    var type = window.getCurrentAccountType ? window.getCurrentAccountType() : 'fan';
    var role = document.getElementById('signup-role').value.trim();

    if (window.mmAuth && window.mmAuth.isConfigured()){
      submitReal(name, loc, type, role);
    } else {
      submitPreviewOnly(name, loc, type, role);
    }
  });
})();
