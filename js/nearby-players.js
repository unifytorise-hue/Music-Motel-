(function(){
  var escapeHtml = window.mmEscapeHtml;
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
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
  var nearbyNoMatchEl = document.getElementById('nearby-players-no-match');

  // Same key/label set window.mmVerificationTiers renders on the dashboard
  // and public profile pages — calling it with an empty profile/signals pair
  // just to read off {key,label} keeps the filter checkboxes in sync with
  // that list without hardcoding it a second time here.
  function populateVerificationChecks(){
    var wrap = document.getElementById('nearby-verification-checks');
    if (!wrap || !window.mmVerificationTiers || wrap.childElementCount) return;
    var checkedBefore = {};
    wrap.querySelectorAll('.nearby-verify-check').forEach(function(cb){ checkedBefore[cb.value] = cb.checked; });
    wrap.innerHTML = window.mmVerificationTiers({}, {}).map(function(t){
      return '<label class="terms-check filter-check"><input type="checkbox" class="nearby-verify-check" value="' + t.key + '"' + (checkedBefore[t.key] ? ' checked' : '') + '><span>' + escapeHtml(t.label) + '</span></label>';
    }).join('');
  }

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

  var allProfiles = [];   // everyone except me, with _distanceKm/_tiers/_rateAmount attached when known
  var myLocation = null;  // { lat, lng } from my own profile row, if set

  function loadProfiles(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('profiles')
      .select('id,name,account_type,role_label,bio,location_label,lat,lng,avatar_color,avatar_url,profile_kind,instruments,availability_status,availability_until,profile_visibility,hide_exact_location,hide_rate,genres,gear_list,languages,touring_level,pro_membership_number,phone_verified_at,id_verified_at,boosted_until')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  // Batched equivalent of the per-profile signal fetch in js/share-profile.js
  // (same four tables, same hasVerifiedPlatformLink/hasCreditsOrTouring/
  // completedBookingCount/hasPositiveReview shape expected by
  // window.mmVerificationTiers) plus each artist's published rate, so the
  // search filters can match verification tier and rate range across every
  // profile at once instead of one row at a time.
  function loadSignalsMap(){
    return Promise.all([
      window.mmSupabase.from('profile_platform_links').select('user_id,verified_at'),
      window.mmSupabase.from('profile_credits').select('user_id'),
      window.mmSupabase.from('booking_requests').select('artist_id,status'),
      window.mmSupabase.from('booking_reviews').select('reviewee_id,rating'),
      window.mmSupabase.from('artist_rate_cards').select('user_id,rate_amount')
    ]).then(function(results){
      var links = (results[0] && results[0].data) || [];
      var credits = (results[1] && results[1].data) || [];
      var bookings = (results[2] && results[2].data) || [];
      var reviews = (results[3] && results[3].data) || [];
      var rateCards = (results[4] && results[4].data) || [];
      var map = {};
      function entry(id){
        if (!map[id]) map[id] = { hasVerifiedPlatformLink: false, hasCreditsOrTouring: false, completedBookingCount: 0, hasPositiveReview: false, rateAmount: null };
        return map[id];
      }
      links.forEach(function(l){ if (l.verified_at) entry(l.user_id).hasVerifiedPlatformLink = true; });
      credits.forEach(function(c){ entry(c.user_id).hasCreditsOrTouring = true; });
      bookings.forEach(function(b){ if (b.status === 'completed') entry(b.artist_id).completedBookingCount += 1; });
      reviews.forEach(function(r){ if (r.rating >= 4) entry(r.reviewee_id).hasPositiveReview = true; });
      rateCards.forEach(function(rc){ entry(rc.user_id).rateAmount = rc.rate_amount != null ? Number(rc.rate_amount) : null; });
      return map;
    }).catch(function(){ return {}; });
  }

  function loadAndRenderNearby(){
    if (!isSignedIn()) return;
    Promise.all([
      loadProfiles(),
      window.mmLoadMyFollowSets ? window.mmLoadMyFollowSets() : Promise.resolve(null),
      loadSignalsMap()
    ]).then(function(results){
      var rows = results[0];
      var followSets = results[1];
      var signalsMap = results[2];
      var myId = currentUser().id;
      var me = rows.filter(function(r){ return r.id === myId; })[0];
      myLocation = (me && me.lat != null && me.lng != null) ? { lat: me.lat, lng: me.lng } : null;

      allProfiles = rows.filter(function(r){
        if (r.id === myId) return false;
        return window.mmCanViewProfile ? window.mmCanViewProfile(r, myId, followSets) : true;
      });
      allProfiles.forEach(function(p){
        p._distanceKm = (myLocation && p.lat != null && p.lng != null)
          ? haversineKm(myLocation.lat, myLocation.lng, p.lat, p.lng)
          : null;
        var signals = signalsMap[p.id] || {};
        p._tiers = window.mmVerificationTiers ? window.mmVerificationTiers(p, signals) : [];
        p._rateAmount = p.hide_rate ? null : (signals.rateAmount != null ? signals.rateAmount : null);
      });
      var byDistanceOrName = myLocation
        ? function(a, b){
            if (a._distanceKm == null) return 1;
            if (b._distanceKm == null) return -1;
            return a._distanceKm - b._distanceKm;
          }
        : function(a, b){ return (a.name || '').localeCompare(b.name || ''); };
      // Boosted profiles (monetization layer, UI/UX scaffolding — see
      // js/boost.js) sort ahead of everyone else, same tie-break rule
      // applied in js/booking-requests.js's real-artist directory and
      // js/share-profile.js's similar-profiles ranking, so a paid boost
      // means the same thing everywhere a profile can be discovered.
      allProfiles.sort(function(a, b){
        var aBoosted = window.mmIsBoosted ? window.mmIsBoosted(a) : false;
        var bBoosted = window.mmIsBoosted ? window.mmIsBoosted(b) : false;
        if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
        return byDistanceOrName(a, b);
      });

      populateRadiusFilter();
      populateVerificationChecks();
      renderList();
    });
  }

  function fieldVal(id){ var el = document.getElementById(id); return el ? el.value : ''; }
  function arrayHasSubstring(arr, needle){
    return Array.isArray(arr) && arr.some(function(v){ return String(v).toLowerCase().indexOf(needle) > -1; });
  }

  function currentFilters(){
    var rateMinRaw = fieldVal('nearby-rate-min-filter');
    var rateMaxRaw = fieldVal('nearby-rate-max-filter');
    return {
      radiusKm: parseInt(fieldVal('nearby-radius-filter') || '0', 10),
      keyword: fieldVal('nearby-keyword-filter').trim().toLowerCase(),
      accountType: fieldVal('nearby-type-filter'),
      availability: fieldVal('nearby-availability-filter'),
      genre: fieldVal('nearby-genre-filter').trim().toLowerCase(),
      gear: fieldVal('nearby-gear-filter').trim().toLowerCase(),
      language: fieldVal('nearby-language-filter').trim().toLowerCase(),
      rateMin: rateMinRaw === '' ? null : parseFloat(rateMinRaw),
      rateMax: rateMaxRaw === '' ? null : parseFloat(rateMaxRaw),
      tiers: Array.prototype.slice.call(document.querySelectorAll('.nearby-verify-check:checked')).map(function(cb){ return cb.value; })
    };
  }

  function matchesFilters(p, f){
    if (f.radiusKm && !(p._distanceKm != null && p._distanceKm <= f.radiusKm)) return false;
    if (f.accountType && p.account_type !== f.accountType) return false;
    if (f.availability && p.availability_status !== f.availability) return false;
    if (f.keyword){
      var hay = [p.name, p.role_label, p.bio].filter(Boolean).join(' ').toLowerCase();
      if (hay.indexOf(f.keyword) === -1) return false;
    }
    if (f.genre && !arrayHasSubstring(p.genres, f.genre)) return false;
    if (f.gear && !arrayHasSubstring(p.gear_list, f.gear)) return false;
    if (f.language && !arrayHasSubstring(p.languages, f.language)) return false;
    if (f.rateMin != null || f.rateMax != null){
      if (p._rateAmount == null) return false;
      if (f.rateMin != null && p._rateAmount < f.rateMin) return false;
      if (f.rateMax != null && p._rateAmount > f.rateMax) return false;
    }
    if (f.tiers.length){
      var earnedKeys = (p._tiers || []).filter(function(t){ return t.done; }).map(function(t){ return t.key; });
      var hasAll = f.tiers.every(function(k){ return earnedKeys.indexOf(k) > -1; });
      if (!hasAll) return false;
    }
    return true;
  }

  function renderList(){
    var card = document.getElementById('nearby-players-card');
    var list = document.getElementById('nearby-players-list');
    var note = document.getElementById('nearby-no-location-note');
    if (!card || !list) return;

    card.style.display = 'block';
    note.style.display = myLocation ? 'none' : 'block';

    var filters = currentFilters();
    var visible = allProfiles.filter(function(p){ return matchesFilters(p, filters); });

    var countEl = document.getElementById('nearby-results-count');
    if (countEl) countEl.textContent = allProfiles.length ? (visible.length + (visible.length === 1 ? ' match' : ' matches')) : '';

    if (!visible.length){
      list.innerHTML = '';
      list.appendChild(allProfiles.length ? nearbyNoMatchEl : nearbyEmptyEl);
      return;
    }
    list.innerHTML = '';
    visible.forEach(function(p){
      var isBand = p.profile_kind === 'band';
      var subBits = [];
      var roleAndType = window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(p) : '';
      if (roleAndType) subBits.push(roleAndType);
      if (p.location_label && !p.hide_exact_location) subBits.push(p.location_label);
      if (p._distanceKm != null && window.mmFormatDistanceKm) subBits.push(window.mmFormatDistanceKm(p._distanceKm));

      var earnedTiers = (p._tiers || []).filter(function(t){ return t.done; });
      var badgesHtml = earnedTiers.length
        ? '<div class="verification-badge-row" style="margin-top:6px;">' + earnedTiers.map(function(t){
            return '<span class="verification-tier-pill earned"><span class="tier-dot"></span>' + escapeHtml(t.label) + '</span>';
          }).join('') + '</div>'
        : '';

      var boostBadgeHtml = window.mmIsBoosted && window.mmIsBoosted(p) ? '<span class="boost-badge">⚡ Boosted</span> ' : '';

      var item = document.createElement('div');
      item.className = 'gig-log-item tappable';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', 'View profile for ' + p.name);
      item.innerHTML =
        '<span class="player-avatar"></span>' +
        '<div style="flex:1;"><h5>' + boostBadgeHtml + escapeHtml(p.name) + (isBand ? ' · BAND' : '') + '</h5>' +
        '<p>' + escapeHtml(subBits.join(' · ')) + '</p>' + badgesHtml + '</div>' +
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

  var FILTER_CHANGE_IDS = ['nearby-radius-filter', 'nearby-type-filter', 'nearby-availability-filter'];
  var FILTER_INPUT_IDS = ['nearby-keyword-filter', 'nearby-genre-filter', 'nearby-gear-filter', 'nearby-language-filter', 'nearby-rate-min-filter', 'nearby-rate-max-filter'];

  document.addEventListener('change', function(e){
    if (!e.target) return;
    if (FILTER_CHANGE_IDS.indexOf(e.target.id) > -1 || e.target.classList.contains('nearby-verify-check')) renderList();
  });
  document.addEventListener('input', function(e){
    if (e.target && FILTER_INPUT_IDS.indexOf(e.target.id) > -1) renderList();
  });
  document.addEventListener('click', function(e){
    if (!e.target || e.target.id !== 'nearby-clear-filters-btn') return;
    FILTER_CHANGE_IDS.concat(FILTER_INPUT_IDS).forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = id === 'nearby-radius-filter' ? '0' : '';
    });
    document.querySelectorAll('.nearby-verify-check').forEach(function(cb){ cb.checked = false; });
    renderList();
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
