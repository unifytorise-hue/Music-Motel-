(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
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

  // Shared by every module that writes a notification for someone else
  // (js/notifications.js call sites in booking-requests.js,
  // invite-gig-follow.js, band-members.js) to compose a body like "Eve
  // Artist sent you a quote" — cached the same way as account type above.
  var cachedName = null;
  function fetchMyName(){
    if (!configured() || !currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('name').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.data && res.data.name) || null; })
      .catch(function(){ return null; });
  }
  window.mmMyName = function(){
    if (!cachedName) cachedName = authReady.then(fetchMyName);
    return cachedName;
  };

  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ cached = null; cachedName = null; });
  }
})();
