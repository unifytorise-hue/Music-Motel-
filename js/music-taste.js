(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  var escapeHtml = window.mmEscapeHtml;

  if (!document.getElementById('music-taste-card')) return;

  // Captured once, before any render clears these lists via innerHTML —
  // each placeholder is a child of the list it describes, so re-querying
  // by id after the first non-empty render would return null (same bug
  // already fixed in js/invite-gig-follow.js and js/booking-requests.js).
  var bandsEmptyEl = document.getElementById('favorite-bands-empty');
  var songsEmptyEl = document.getElementById('favorite-songs-empty');

  var myBands = [];
  var mySongs = [];

  function loadMyTaste(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('profiles').select('favorite_bands,favorite_songs,want_to_see_live').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }
  function saveBands(){
    return window.mmSupabase.from('profiles').update({ favorite_bands: myBands }).eq('id', currentUser().id).then(function(){});
  }
  function saveSongs(){
    return window.mmSupabase.from('profiles').update({ favorite_songs: mySongs }).eq('id', currentUser().id).then(function(){});
  }

  function renderList(listId, emptyEl, items, onRemove){
    var list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    if (!items.length){
      list.appendChild(emptyEl);
      return;
    }
    items.forEach(function(item, idx){
      var row = document.createElement('div');
      row.className = 'gig-log-item';
      row.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(item) + '</h5></div>' +
        '<button class="gig-log-remove" aria-label="Remove">✕</button>';
      row.querySelector('.gig-log-remove').addEventListener('click', function(){ onRemove(idx); });
      list.appendChild(row);
    });
  }
  function renderBands(){
    renderList('favorite-bands-list', bandsEmptyEl, myBands, function(idx){
      myBands.splice(idx, 1);
      saveBands().then(renderBands);
    });
  }
  function renderSongs(){
    renderList('favorite-songs-list', songsEmptyEl, mySongs, function(idx){
      mySongs.splice(idx, 1);
      saveSongs().then(renderSongs);
    });
  }

  function initMusicTaste(){
    var card = document.getElementById('music-taste-card');
    if (!isSignedIn()){
      if (card) card.style.display = 'none';
      return;
    }
    loadMyTaste().then(function(row){
      if (card) card.style.display = 'block';
      myBands = (row && row.favorite_bands) || [];
      mySongs = (row && row.favorite_songs) || [];
      renderBands();
      renderSongs();
      var wantInput = document.getElementById('want-to-see-live-input');
      if (wantInput) wantInput.value = (row && row.want_to_see_live) || '';
      var statusEl = document.getElementById('want-to-see-live-status');
      if (statusEl) statusEl.textContent = '';
    });
  }

  var bandInput = document.getElementById('favorite-band-input');
  document.getElementById('favorite-band-add-btn').addEventListener('click', function(){
    var val = (bandInput.value || '').trim();
    if (!val) return;
    myBands.push(val);
    bandInput.value = '';
    saveBands().then(renderBands);
  });

  var songInput = document.getElementById('favorite-song-input');
  document.getElementById('favorite-song-add-btn').addEventListener('click', function(){
    var val = (songInput.value || '').trim();
    if (!val) return;
    mySongs.push(val);
    songInput.value = '';
    saveSongs().then(renderSongs);
  });

  document.getElementById('want-to-see-live-save-btn').addEventListener('click', function(){
    var val = (document.getElementById('want-to-see-live-input').value || '').trim();
    var statusEl = document.getElementById('want-to-see-live-status');
    window.mmSupabase.from('profiles').update({ want_to_see_live: val || null }).eq('id', currentUser().id).then(function(res){
      if (statusEl) statusEl.textContent = res.error ? res.error.message : 'Saved!';
    });
  });

  authReady.then(initMusicTaste);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ initMusicTaste(); });
  }
})();
