(function(){
  // Real, server-computed XP for signed-in users (see xp_schema.sql —
  // profiles.xp is only ever changed by SECURITY DEFINER triggers on
  // gig_log/referrals/gear_claims inserts, never written directly by this
  // client). Distinct from the local, no-stakes band-builder game in
  // hero-game.js, which stays local/anonymous-only.

  var RANKS = [
    { min: 0, name: 'SOLO ACT' },
    { min: 25, name: 'DUO' },
    { min: 75, name: 'TRIO' },
    { min: 150, name: 'POWER FOUR' },
    { min: 250, name: 'FULL BAND' },
    { min: 400, name: 'HEADLINER' },
    { min: 650, name: 'ORCHESTRA' },
    { min: 1000, name: 'FESTIVAL LINEUP' }
  ];

  function rankForXP(xp){
    var rank = RANKS[0];
    for (var i = 0; i < RANKS.length; i++){
      if (xp >= RANKS[i].min) rank = RANKS[i];
    }
    return rank.name;
  }

  function isConfigured(){
    return !!(window.mmSupabaseConfigured && window.mmSupabase);
  }

  function loadRealXP(userId){
    return window.mmSupabase.from('profiles').select('xp').eq('id', userId).maybeSingle()
      .then(function(res){
        if (res.error || !res.data) return 0;
        return res.data.xp || 0;
      })
      .catch(function(){ return 0; });
  }

  function updateHonestyCopy(signedIn){
    var dashNote = document.getElementById('fan-dashboard-note');
    if (dashNote){
      dashNote.textContent = signedIn
        ? 'Saved to your account — this follows you across devices.'
        : "Saved on this device/browser only — sign in to make this follow you across devices.";
    }
    var inviteNote = document.getElementById('invite-honesty-note');
    if (inviteNote){
      inviteNote.innerHTML = signedIn
        ? 'Since you\'re signed in, you\'ll get credit for a friend\'s signup even from a different phone or browser.'
        : 'This works when the link is opened in the <em>same browser</em> you\'re using now — sign in to get credit for a friend\'s signup even from a different phone or browser.';
    }
  }

  function renderRealXP(xp){
    var navXp = document.getElementById('nav-xp');
    if (navXp) navXp.textContent = xp;

    var rankRow = document.getElementById('fan-rank-row');
    var rankBadge = document.getElementById('fan-rank-badge');
    var rankXpNum = document.getElementById('fan-rank-xp-num');
    if (rankRow) rankRow.style.display = 'flex';
    if (rankBadge) rankBadge.textContent = rankForXP(xp);
    if (rankXpNum) rankXpNum.textContent = xp;
  }

  function refresh(){
    if (!isConfigured()) return;
    var user = window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser();
    updateHonestyCopy(!!user);
    if (!user){
      // Without this, signing out mid-session left the last signed-in
      // user's XP badge (and the dashboard rank row) stuck on screen —
      // nothing else clears #nav-xp back to its static "0" markup, or
      // re-hides #fan-rank-row, once a real value has been rendered once.
      var navXp = document.getElementById('nav-xp');
      if (navXp) navXp.textContent = '0';
      var rankRow = document.getElementById('fan-rank-row');
      if (rankRow) rankRow.style.display = 'none';
      return;
    }
    loadRealXP(user.id).then(renderRealXP);
  }

  // Exposed so other modules can pull an up-to-date total right after an
  // action that a server-side trigger awards XP for (logging a gig,
  // claiming gear) — polling isn't needed since we know exactly when to ask.
  window.refreshRealXP = refresh;

  var authReady = window.mmAuthReady || Promise.resolve();
  authReady.then(refresh);

  // Re-sync on sign-in/sign-out, not just on initial load.
  if (isConfigured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ refresh(); });
  }
})();
