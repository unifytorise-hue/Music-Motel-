(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  var escapeHtml = window.mmEscapeHtml;

  if (!document.getElementById('media-portfolio-card')) return;

  // Captured once, before any render clears this list via innerHTML — see
  // the same pattern already used in js/booking-requests.js etc.
  var emptyEl = document.getElementById('media-portfolio-empty');

  var myMedia = [];

  function loadMine(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('profile_media').select('*').eq('user_id', currentUser().id).order('sort_order', { ascending: true })
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderList(){
    var list = document.getElementById('media-portfolio-list');
    list.innerHTML = '';
    if (!myMedia.length){
      list.appendChild(emptyEl);
      return;
    }
    myMedia.forEach(function(item){
      var row = document.createElement('div');
      row.className = 'gig-log-item';
      row.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;">' +
          '<h5>' + escapeHtml(item.title || (window.mmMediaPlatformLabel ? window.mmMediaPlatformLabel(item.media_type) : item.media_type)) + (item.is_featured ? ' · FEATURED' : '') + '</h5>' +
          '<p>' + escapeHtml(window.mmMediaPlatformLabel ? window.mmMediaPlatformLabel(item.media_type) : item.media_type) + '</p>' +
        '</div>' +
        '<button class="gig-log-remove media-feature-btn" type="button" aria-label="Toggle featured" title="Feature this on your profile">' + (item.is_featured ? '★' : '☆') + '</button>' +
        '<button class="gig-log-remove" type="button" aria-label="Remove">✕</button>';
      row.querySelector('.media-feature-btn').addEventListener('click', function(){
        var makeFeatured = !item.is_featured;
        // Only one featured item at a time — clear any other row's flag
        // client-side too so the list reflects it immediately.
        var updates = myMedia.map(function(m){
          return window.mmSupabase.from('profile_media').update({ is_featured: m.id === item.id ? makeFeatured : false }).eq('id', m.id);
        });
        Promise.all(updates).then(function(){
          myMedia.forEach(function(m){ m.is_featured = (m.id === item.id) ? makeFeatured : false; });
          renderList();
        });
      });
      row.querySelectorAll('.gig-log-remove')[1].addEventListener('click', function(){
        window.mmSupabase.from('profile_media').delete().eq('id', item.id).then(function(){
          myMedia = myMedia.filter(function(m){ return m.id !== item.id; });
          renderList();
        });
      });
      list.appendChild(row);
    });
  }

  function init(){
    var card = document.getElementById('media-portfolio-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    // Same reasoning as the rate card / availability status — a fan has no
    // professional work to showcase in a media portfolio.
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      if (accountType === 'fan'){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      loadMine().then(function(rows){
        myMedia = rows;
        renderList();
      });
    });
  }

  document.getElementById('media-add-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    var urlInput = document.getElementById('media-url-input');
    var titleInput = document.getElementById('media-title-input');
    var statusEl = document.getElementById('media-add-status');
    var url = urlInput.value.trim();
    var parsed = window.mmParseMediaUrl ? window.mmParseMediaUrl(url) : null;
    if (!parsed){
      statusEl.textContent = "Couldn't recognize that link — paste a Spotify, Apple Music, SoundCloud, Bandcamp, YouTube, or Vimeo URL.";
      return;
    }
    statusEl.textContent = 'Adding…';
    window.mmSupabase.from('profile_media').insert({
      user_id: user.id, media_type: parsed.type, url: parsed.sourceUrl,
      title: titleInput.value.trim(), sort_order: myMedia.length
    }).select().then(function(res){
      if (res.error){ statusEl.textContent = res.error.message; return; }
      statusEl.textContent = 'Added!';
      urlInput.value = '';
      titleInput.value = '';
      myMedia.push((res.data && res.data[0]) || { id: 'tmp-' + Date.now(), media_type: parsed.type, url: parsed.sourceUrl, title: titleInput.value, is_featured: false });
      renderList();
    }).catch(function(err){
      statusEl.textContent = (err && err.message) || 'Could not add that link.';
    });
  });

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
