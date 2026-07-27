(function(){
  var ACCOUNT_TYPES = {
    fan: {
      note: "Free forever — follow artists, log gigs you've attended, and book talent.",
      roleLabel: 'Favorite genres (optional)',
      rolePlaceholder: 'e.g. Afrobeat, Indie Rock, Jazz',
      roleRequired: false,
      submitLabel: 'Create free fan profile'
    },
    musician: {
      note: 'Free forever — list your instruments, build a gig history, get booked.',
      roleLabel: 'Primary instrument or skill',
      rolePlaceholder: 'e.g. Bassist, Sound Engineer, Tour Manager',
      roleRequired: true,
      submitLabel: 'Create free profile'
    },
    educator: {
      note: '$12/mo — post lessons, manage students, accept bookings. Subscription starts after signup.',
      roleLabel: 'What do you teach?',
      rolePlaceholder: 'e.g. Vocal coaching, Guitar, Music theory',
      roleRequired: true,
      submitLabel: 'Continue to educator subscription'
    },
    venue: {
      note: '$29/mo — post gigs, manage bookings, get priority placement. Subscription starts after signup.',
      roleLabel: 'Business type',
      rolePlaceholder: 'e.g. Live music venue, Recording studio, Label',
      roleRequired: true,
      submitLabel: 'Continue to booker subscription'
    },
    publicspace: {
      note: '$39/mo — book live music directly for your space. Subscription starts after signup.',
      roleLabel: 'What kind of space is this?',
      rolePlaceholder: 'e.g. Café, Gym, Hotel lobby, Retail store',
      roleRequired: true,
      submitLabel: 'Continue to Public Space subscription'
    }
  };
  var currentAccountType = 'fan';
  var currentProfileKind = 'personal';

  document.querySelectorAll('.account-type-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      currentAccountType = btn.getAttribute('data-type');
      document.querySelectorAll('.account-type-btn').forEach(function(b){
        b.classList.toggle('active', b === btn);
      });
      var cfg = ACCOUNT_TYPES[currentAccountType];
      document.getElementById('account-type-note').textContent = cfg.note;
      document.getElementById('signup-role-label').textContent = cfg.roleLabel;
      document.getElementById('signup-role').placeholder = cfg.rolePlaceholder;
      document.getElementById('signup-role-field').style.display = currentAccountType === 'fan' ? 'block' : 'block';
      // A fan is always a personal profile — the Personal/Band choice only
      // makes sense for the roles that can actually be a group act.
      document.getElementById('profile-kind-field').style.display = currentAccountType === 'fan' ? 'none' : 'block';
      updateSubmitLabel();
    });
  });

  document.querySelectorAll('.profile-kind-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      currentProfileKind = btn.getAttribute('data-kind');
      document.querySelectorAll('.profile-kind-btn').forEach(function(b){
        b.classList.toggle('active', b === btn);
      });
    });
  });

  function updateSubmitLabel(){
    var submitBtn = document.getElementById('signup-submit-btn');
    var hasLocation = document.getElementById('loc-selected').classList.contains('show');
    if (!hasLocation) return; // the location-picker script controls the disabled/placeholder state itself
    submitBtn.textContent = ACCOUNT_TYPES[currentAccountType].submitLabel;
  }

  window.getCurrentAccountType = function(){ return currentAccountType; };
  window.getAccountTypeConfig = function(type){ return ACCOUNT_TYPES[type]; };
  window.setSignupAccountType = function(type){
    var btn = document.querySelector('.account-type-btn[data-type="' + type + '"]');
    if (btn) btn.click();
  };
  // A fan can never be a band profile, regardless of what was selected
  // before switching account type back to fan.
  window.getCurrentProfileKind = function(){ return currentAccountType === 'fan' ? 'personal' : currentProfileKind; };

  // Sync the role field to the default (Fan) state on load, since the HTML
  // ships with musician-oriented copy as a static fallback.
  (function syncInitialState(){
    var cfg = ACCOUNT_TYPES[currentAccountType];
    document.getElementById('signup-role-label').textContent = cfg.roleLabel;
    document.getElementById('signup-role').placeholder = cfg.rolePlaceholder;
  })();
})();
