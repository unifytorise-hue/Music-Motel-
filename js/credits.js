(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  var escapeHtml = window.mmEscapeHtml;

  if (!document.getElementById('credits-card')) return;

  var emptyEl = document.getElementById('credits-empty');
  var myCredits = [];

  function loadMine(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('profile_credits').select('*').eq('user_id', currentUser().id).order('created_at', { ascending: false })
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function render(){
    var list = document.getElementById('credits-list');
    list.innerHTML = '';
    if (!myCredits.length){
      list.appendChild(emptyEl);
      return;
    }
    myCredits.forEach(function(c){
      var row = document.createElement('div');
      row.className = 'gig-log-item';
      var detail = c.credit_role + (c.year ? ' · ' + c.year : '');
      row.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(c.title) + '</h5><p>' + escapeHtml(detail) + '</p></div>' +
        '<button class="gig-log-remove" aria-label="Remove">✕</button>';
      row.querySelector('.gig-log-remove').addEventListener('click', function(){
        window.mmSupabase.from('profile_credits').delete().eq('id', c.id).then(function(){
          myCredits = myCredits.filter(function(x){ return x.id !== c.id; });
          render();
        });
      });
      list.appendChild(row);
    });
  }

  function init(){
    var card = document.getElementById('credits-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    // Same reasoning as the rest of the professional-only cards — a fan
    // has no work credits to list.
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      if (accountType === 'fan'){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      loadMine().then(function(rows){
        myCredits = rows;
        render();
      });
    });
  }

  document.getElementById('credit-add-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    var titleInput = document.getElementById('credit-title-input');
    var roleInput = document.getElementById('credit-role-input');
    var yearInput = document.getElementById('credit-year-input');
    var linkInput = document.getElementById('credit-link-input');
    var statusEl = document.getElementById('credit-add-status');

    var title = titleInput.value.trim();
    var role = roleInput.value.trim();
    if (!title || !role){
      statusEl.textContent = 'Add a title and your role before saving.';
      return;
    }
    var year = yearInput.value ? parseInt(yearInput.value, 10) : null;
    var link = linkInput.value.trim();
    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;

    statusEl.textContent = 'Adding…';
    window.mmSupabase.from('profile_credits').insert({
      user_id: user.id, title: title, credit_role: role, year: year, link: link || null
    }).select().then(function(res){
      if (res.error){ statusEl.textContent = res.error.message; return; }
      statusEl.textContent = 'Added!';
      titleInput.value = '';
      roleInput.value = '';
      yearInput.value = '';
      linkInput.value = '';
      myCredits.unshift((res.data && res.data[0]) || { id: 'tmp-' + Date.now(), title: title, credit_role: role, year: year, link: link });
      render();
    }).catch(function(err){
      statusEl.textContent = (err && err.message) || 'Could not add that credit.';
    });
  });

  // Called by js/musicbrainz-import.js after importing releases as credits,
  // so the list above reflects them immediately without a page reload.
  window.mmRefreshCredits = function(){
    loadMine().then(function(rows){
      myCredits = rows;
      render();
    });
  };

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
