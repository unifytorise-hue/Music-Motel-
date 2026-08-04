(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  if (!document.getElementById('boost-card')) return;

  // Monetization layer, UI/UX scaffolding only — same "simulate, don't fake
  // production-grade" pattern used for escrow and ID verification. Prices
  // are flat and hardcoded (no real checkout); confirming a boost just
  // writes boosted_until into the future, which every directory/search
  // surface (js/nearby-players.js, js/booking-requests.js,
  // js/share-profile.js) already reads via window.mmIsBoosted to sort that
  // profile first and show a "Boosted" badge.
  var DURATION_PRICES = { 7: 9, 14: 15, 30: 25 };
  var myProfile = null;

  function loadMyProfile(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('id,boosted_until,boost_started_at,boost_amount_paid').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }

  function renderStatus(){
    var statusEl = document.getElementById('boost-status');
    var boosted = window.mmIsBoosted && window.mmIsBoosted(myProfile);
    if (boosted){
      var until = new Date(myProfile.boosted_until);
      statusEl.textContent = 'Boosted — shown first until ' + until.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + '.';
    } else {
      statusEl.textContent = 'Not currently boosted.';
    }
  }

  function initBoost(){
    var card = document.getElementById('boost-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      // A fan has no listing to promote in search/directory results — same
      // gate used for rates-card/skills-card/media-portfolio-card.
      if (accountType === 'fan'){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      loadMyProfile().then(function(profile){
        myProfile = profile;
        renderStatus();
      });
    });
  }

  document.getElementById('boost-confirm-btn').addEventListener('click', function(){
    if (!currentUser()) return;
    var days = parseInt(document.getElementById('boost-duration-select').value, 10);
    var price = DURATION_PRICES[days];
    var statusEl = document.getElementById('boost-status');
    var btn = document.getElementById('boost-confirm-btn');

    // Extends from the current boosted_until if it's still in the future
    // (stacking a renewal) rather than always restarting from now, so
    // buying more time never shortens time already paid for.
    var base = (window.mmIsBoosted && window.mmIsBoosted(myProfile)) ? new Date(myProfile.boosted_until) : new Date();
    var until = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    btn.disabled = true;
    statusEl.textContent = 'Processing (simulated)…';
    window.mmSupabase.from('profiles').update({
      boosted_until: until.toISOString(),
      boost_started_at: new Date().toISOString(),
      boost_amount_paid: price
    }).eq('id', currentUser().id).select().single().then(function(res){
      btn.disabled = false;
      if (res.error){
        statusEl.textContent = res.error.message;
        return;
      }
      myProfile = res.data;
      renderStatus();
      if (window.refreshNearbyPlayers) window.refreshNearbyPlayers();
      if (window.refreshRealArtistDirectory) window.refreshRealArtistDirectory();
    });
  });

  authReady.then(initBoost);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ initBoost(); });
  }
})();
