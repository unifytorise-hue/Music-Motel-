(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  if (!document.getElementById('skills-card')) return;

  // ===== generic "add/remove a tag into a text[] column" list =====
  // Same add-one-at-a-time / remove pattern already used for favorite
  // bands/songs in js/music-taste.js, generalized here since the skills
  // card needs four independent tag lists (genres, software, languages,
  // gear) that only differ by which profiles column they save to.
  function makeTagList(opts){
    var column = opts.column;
    var inputEl = document.getElementById(opts.inputId);
    var addBtn = document.getElementById(opts.addBtnId);
    var listEl = document.getElementById(opts.listId);
    var emptyEl = document.getElementById(opts.emptyId); // captured once, before any render moves it via innerHTML
    var items = [];

    function save(){
      var payload = {};
      payload[column] = items;
      return window.mmSupabase.from('profiles').update(payload).eq('id', currentUser().id).then(function(){});
    }
    function render(){
      listEl.innerHTML = '';
      if (!items.length){
        listEl.appendChild(emptyEl);
        return;
      }
      items.forEach(function(item, idx){
        var row = document.createElement('div');
        row.className = 'gig-log-item';
        row.innerHTML =
          '<span class="gig-log-dot"></span>' +
          '<div style="flex:1;"><h5>' + escapeHtml(item) + '</h5></div>' +
          '<button class="gig-log-remove" aria-label="Remove">✕</button>';
        row.querySelector('.gig-log-remove').addEventListener('click', function(){
          items.splice(idx, 1);
          save().then(render);
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function(){
      var val = (inputEl.value || '').trim();
      if (!val) return;
      items.push(val);
      inputEl.value = '';
      save().then(render);
    });
    return {
      setItems: function(newItems){ items = newItems || []; render(); }
    };
  }

  var genresList = makeTagList({ column: 'genres', inputId: 'genres-input', addBtnId: 'genres-add-btn', listId: 'genres-list', emptyId: 'genres-empty' });
  var softwareList = makeTagList({ column: 'software', inputId: 'software-input', addBtnId: 'software-add-btn', listId: 'software-list', emptyId: 'software-empty' });
  var languagesList = makeTagList({ column: 'languages', inputId: 'languages-input', addBtnId: 'languages-add-btn', listId: 'languages-list', emptyId: 'languages-empty' });
  var gearList = makeTagList({ column: 'gear_list', inputId: 'profile-gear-input', addBtnId: 'profile-gear-add-btn', listId: 'profile-gear-list', emptyId: 'profile-gear-empty' });

  // ===== touring level =====
  var touringSelect = document.getElementById('touring-level-select');
  var touringStatus = document.getElementById('touring-level-status');
  document.getElementById('touring-level-save-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    window.mmSupabase.from('profiles').update({ touring_level: touringSelect.value || null }).eq('id', user.id).then(function(res){
      touringStatus.textContent = res.error ? res.error.message : 'Saved!';
    });
  });

  function loadMine(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('genres,software,languages,gear_list,touring_level').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }

  function init(){
    var card = document.getElementById('skills-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    // A fan has no professional skill set to list — same reasoning already
    // applied to the rate card, availability, and media portfolio cards.
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      if (accountType === 'fan'){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      loadMine().then(function(row){
        genresList.setItems(row && row.genres);
        softwareList.setItems(row && row.software);
        languagesList.setItems(row && row.languages);
        gearList.setItems(row && row.gear_list);
        touringSelect.value = (row && row.touring_level) || '';
        touringStatus.textContent = '';
      });
    });
  }

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
