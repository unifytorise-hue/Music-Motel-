(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  if (!document.getElementById('profile-template-card')) return;

  // Only musician and venue account types split into two distinct public-
  // profile templates each — everyone else's template already follows
  // directly from their account_type (see window.mmResolveTemplate in
  // js/icons.js), so there's nothing to choose for them.
  var TEMPLATE_OPTIONS_BY_ACCOUNT_TYPE = {
    musician: [
      { value: 'performing_artist', label: 'Performing artist', desc: "Leads with your media, gigs, and availability — the default for someone who plays live." },
      { value: 'producer_engineer', label: 'Producer / engineer', desc: 'Leads with your credits and studio skills instead of live availability.' }
    ],
    venue: [
      { value: 'venue_space', label: 'Venue / space', desc: 'A physical place people can book live music for.' },
      { value: 'manager_agent', label: 'Manager / agent', desc: "You represent other artists rather than being a bookable space yourself." }
    ]
  };

  var select = document.getElementById('profile-template-select');
  var descEl = document.getElementById('profile-template-desc');
  var statusEl = document.getElementById('profile-template-status');
  var currentOptions = null;

  function populateOptions(options){
    currentOptions = options;
    select.innerHTML = options.map(function(o){ return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
  }
  function updateDesc(){
    var opt = currentOptions && currentOptions.filter(function(o){ return o.value === select.value; })[0];
    descEl.textContent = opt ? opt.desc : '';
  }
  select.addEventListener('change', updateDesc);

  function loadMine(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('profile_template').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }

  function init(){
    var card = document.getElementById('profile-template-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      var options = TEMPLATE_OPTIONS_BY_ACCOUNT_TYPE[accountType];
      if (!options){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      populateOptions(options);
      loadMine().then(function(row){
        select.value = (row && row.profile_template) || options[0].value;
        updateDesc();
        statusEl.textContent = '';
      });
    });
  }

  document.getElementById('profile-template-save-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    window.mmSupabase.from('profiles').update({ profile_template: select.value }).eq('id', user.id).then(function(res){
      statusEl.textContent = res.error ? res.error.message : 'Saved!';
    });
  });

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
