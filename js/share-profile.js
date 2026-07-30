(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  var authReady = window.mmAuthReady || Promise.resolve();

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  window.mmProfileShareUrl = function(userId){
    var url = new URL(window.location.origin + '/profile.html');
    url.searchParams.set('id', userId);
    return url.toString();
  };

  // ===== "Share your profile" / "Share my rate" buttons =====
  // Both point at the same public-profile link (the rate, if published,
  // already shows inline on that page) — sharing from either spot is just
  // a convenience for wherever the visitor happens to be on their own
  // dashboard.
  function wireShareButton(btnId, linkInputId, statusId, shareText){
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function(){
      var user = currentUser();
      if (!user){
        if (window.openSignup) window.openSignup();
        return;
      }
      var url = window.mmProfileShareUrl(user.id);
      var input = document.getElementById(linkInputId);
      if (input) input.value = url;
      var status = document.getElementById(statusId);

      if (navigator.share){
        navigator.share({ title: 'Book me now', text: shareText, url: url }).then(function(){
          if (status) status.textContent = 'Shared!';
        }).catch(function(){}); // user cancelled the share sheet — not an error
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){
          if (status) status.textContent = 'Link copied — post it anywhere.';
        }).catch(function(){
          if (input) input.select();
          if (status) status.textContent = 'Press Ctrl/Cmd+C to copy.';
        });
      } else if (input){
        input.select();
        if (status) status.textContent = 'Press Ctrl/Cmd+C to copy.';
      }
    });
  }
  wireShareButton('share-profile-btn', 'share-profile-link', 'share-profile-status', 'Book me now — check out my profile on Music Motel.');
  wireShareButton('share-rate-btn', 'share-rate-link', 'share-rate-status', 'Book me now — here\'s my rate on Music Motel.');

  function fillShareLinks(){
    var user = currentUser();
    if (!user) return;
    var url = window.mmProfileShareUrl(user.id);
    var profileLink = document.getElementById('share-profile-link');
    if (profileLink) profileLink.value = url;
    var rateLink = document.getElementById('share-rate-link');
    if (rateLink) rateLink.value = url;
  }
  authReady.then(fillShareLinks);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ fillShareLinks(); });
  }

  // ===== public profile landing view (?id=<uuid>) =====
  var sharedId = new URLSearchParams(window.location.search).get('id');
  if (!sharedId) return;

  var dashboard = document.getElementById('fan-dashboard');
  var myRateSection = document.getElementById('my-rate');
  var view = document.getElementById('public-profile-view');
  if (!view) return;
  if (dashboard) dashboard.style.display = 'none';
  if (myRateSection) myRateSection.style.display = 'none';
  view.style.display = '';

  function bookingNoun(profile){
    if (profile.profile_kind === 'band') return 'band';
    if (profile.account_type === 'musician' || profile.account_type === 'educator') return 'artist';
    return 'person';
  }

  function renderNotFound(){
    document.getElementById('public-profile-loading').style.display = 'none';
    document.getElementById('public-profile-notfound').style.display = 'block';
  }

  function renderProfile(profile){
    document.getElementById('public-profile-loading').style.display = 'none';
    document.getElementById('public-profile-body').style.display = 'block';
    document.title = profile.name + ' — Music Motel';

    var noun = bookingNoun(profile);
    document.getElementById('public-profile-tag').textContent = '/ ' + (noun === 'band' ? 'Band' : noun === 'artist' ? 'Artist' : 'Profile');
    document.getElementById('public-profile-heading').textContent = 'Book this ' + noun + ' now';
    document.getElementById('public-profile-name').textContent = profile.name || 'Unnamed profile';
    document.getElementById('public-profile-role').textContent = profile.role_label || (window.mmAccountTypeLabel ? window.mmAccountTypeLabel(profile.account_type) : profile.account_type) || '';

    var locRow = document.getElementById('public-profile-loc');
    if (profile.location_label){
      locRow.style.display = 'flex';
      document.getElementById('public-profile-loc-text').textContent = profile.location_label;
    } else {
      locRow.style.display = 'none';
    }

    var bioEl = document.getElementById('public-profile-bio');
    if (profile.bio){
      bioEl.style.display = 'block';
      bioEl.textContent = profile.bio;
    } else {
      bioEl.style.display = 'none';
    }

    var instrEl = document.getElementById('public-profile-instruments');
    instrEl.innerHTML = (profile.instruments || []).map(function(instr){
      return '<span class="profile-modal-badge">' + escapeHtml(instr) + '</span>';
    }).join('');

    // profile.avatar_color/avatar_url are remote, other-user-controlled data
    // — mmRenderAvatar assigns them via img.src / a regex-validated color
    // rather than interpolating into an HTML string.
    if (window.mmRenderAvatar) window.mmRenderAvatar(document.getElementById('public-profile-avatar'), profile.avatar_url, profile.avatar_color, profile.name);

    var user = currentUser();
    var isOwnProfile = !!(user && user.id === profile.id);
    var actions = document.getElementById('public-profile-actions');
    var ownNote = document.getElementById('public-profile-own-note');

    if (isOwnProfile){
      actions.style.display = 'none';
      ownNote.style.display = 'block';
    } else {
      ownNote.style.display = 'none';
      actions.style.display = 'block';

      var followBtn = document.getElementById('public-profile-follow-btn');
      followBtn.style.display = '';
      if (window.refreshFollowButton) window.refreshFollowButton(followBtn, profile.id);
      followBtn.addEventListener('click', function(){
        if (window.toggleFollow) window.toggleFollow(profile.id, { name: profile.name, role: profile.role_label, loc: profile.location_label, color: profile.avatar_color, avatarUrl: profile.avatar_url });
        if (window.refreshFollowButton) window.refreshFollowButton(followBtn, profile.id);
      });

      var bookBtn = document.getElementById('public-profile-book-btn');
      if (profile.account_type !== 'fan'){
        bookBtn.style.display = '';
        bookBtn.addEventListener('click', function(){
          if (window.openQuoteRequest) window.openQuoteRequest(profile);
        });
      }

      var unifyBtn = document.getElementById('public-profile-unify-btn');
      if (profile.profile_kind === 'band'){
        unifyBtn.style.display = '';
        unifyBtn.addEventListener('click', function(){
          if (window.requestJoinBand) window.requestJoinBand(profile);
        });
      }
    }

    if (!configured()) return;
    window.mmSupabase.from('artist_rate_cards').select('*').eq('user_id', profile.id).maybeSingle().then(function(res){
      var card = (res.error || !res.data) ? null : res.data;
      if (!card || card.rate_amount == null || !card.booking_agent_terms_accepted_at) return;
      document.getElementById('public-profile-rate-box').style.display = 'block';
      document.getElementById('public-profile-rate-preview').innerHTML = window.renderRateCardBox ? window.renderRateCardBox(card) : '';
    }).catch(function(){});
  }

  authReady.then(function(){
    if (!configured()){ renderNotFound(); return; }
    window.mmSupabase.from('profiles')
      .select('id,name,role_label,location_label,account_type,instruments,profile_kind,avatar_url,avatar_color,bio')
      .eq('id', sharedId).maybeSingle()
      .then(function(res){
        if (res.error || !res.data){ renderNotFound(); return; }
        renderProfile(res.data);
      })
      .catch(function(){ renderNotFound(); });
  });
})();
