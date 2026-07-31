(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  if (!document.getElementById('availability-card')) return;

  var statusSelect = document.getElementById('availability-status-select');
  var untilField = document.getElementById('availability-until-field');
  var untilInput = document.getElementById('availability-until-input');
  var saveBtn = document.getElementById('availability-save-btn');
  var msgEl = document.getElementById('availability-status-msg');

  function syncUntilFieldVisibility(){
    untilField.style.display = statusSelect.value === 'booked_until' ? 'block' : 'none';
  }
  statusSelect.addEventListener('change', syncUntilFieldVisibility);

  function loadMine(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('availability_status,availability_until').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }

  function init(){
    var card = document.getElementById('availability-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    // A fan has no bookable availability to advertise — same reasoning
    // already applied to the rate card and incoming-requests sections.
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      if (accountType === 'fan'){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      loadMine().then(function(row){
        statusSelect.value = (row && row.availability_status) || '';
        untilInput.value = (row && row.availability_until) || '';
        syncUntilFieldVisibility();
        msgEl.textContent = '';
      });
    });
  }

  saveBtn.addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    var status = statusSelect.value || null;
    var until = status === 'booked_until' ? (untilInput.value || null) : null;
    if (status === 'booked_until' && !until){
      msgEl.textContent = 'Pick a date, or choose a different status.';
      return;
    }
    saveBtn.disabled = true;
    window.mmSupabase.from('profiles').update({ availability_status: status, availability_until: until }).eq('id', user.id)
      .then(function(res){
        saveBtn.disabled = false;
        msgEl.textContent = res.error ? res.error.message : 'Saved!';
      })
      .catch(function(err){
        saveBtn.disabled = false;
        msgEl.textContent = (err && err.message) || 'Could not save that.';
      });
  });

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
