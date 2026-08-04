(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  if (!document.getElementById('privacy-card')) return;

  var visibilitySelect = document.getElementById('privacy-visibility-select');
  var hideRateCheck = document.getElementById('privacy-hide-rate-check');
  var hideLocationCheck = document.getElementById('privacy-hide-location-check');
  var statusEl = document.getElementById('privacy-status');

  function loadMine(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('profile_visibility,hide_rate,hide_exact_location').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }

  // Every signed-in account gets privacy controls, regardless of account
  // type — unlike the professional-only cards (rate card, skills, etc.),
  // there's nothing fan-irrelevant about wanting to limit who sees you.
  function init(){
    var card = document.getElementById('privacy-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    loadMine().then(function(row){
      visibilitySelect.value = (row && row.profile_visibility) || 'public';
      hideRateCheck.checked = !!(row && row.hide_rate);
      hideLocationCheck.checked = !!(row && row.hide_exact_location);
      statusEl.textContent = '';
    });
  }

  document.getElementById('privacy-save-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    window.mmSupabase.from('profiles').update({
      profile_visibility: visibilitySelect.value,
      hide_rate: hideRateCheck.checked,
      hide_exact_location: hideLocationCheck.checked
    }).eq('id', user.id).then(function(res){
      statusEl.textContent = res.error ? res.error.message : 'Saved!';
    });
  });

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
