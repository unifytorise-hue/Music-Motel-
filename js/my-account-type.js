(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  var authReady = window.mmAuthReady || Promise.resolve();

  // Shared by every dashboard section that only makes sense for an
  // account type someone could actually book (rate card, incoming booking
  // requests) — a fan has nothing to sell, so those sections need to know
  // the signed-in user's own account_type to hide themselves correctly.
  // Cached as a single promise per sign-in so each caller doesn't re-query.
  var cached = null;
  function fetchMyAccountType(){
    if (!configured() || !currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('account_type').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.data && res.data.account_type) || null; })
      .catch(function(){ return null; });
  }
  window.mmMyAccountType = function(){
    if (!cached) cached = authReady.then(fetchMyAccountType);
    return cached;
  };
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ cached = null; });
  }
})();
