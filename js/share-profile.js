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

  // Reorders the already-rendered content-boxes below the main profile card
  // to match what this template leads with — producer/engineer profiles
  // lead with proof of work (skills + credits) rather than media, since
  // "here's what I've built" matters more to a hiring client than a demo
  // reel. Every other template keeps the default Featured work → Portfolio
  // → Rate → Skills → Credits → Taste order already in the HTML.
  function reorderForTemplate(template){
    if (template !== 'producer_engineer') return;
    var featuredBox = document.getElementById('public-profile-featured-box');
    var wrap = featuredBox.parentNode;
    wrap.insertBefore(document.getElementById('public-profile-skills-box'), featuredBox);
    wrap.insertBefore(document.getElementById('public-profile-credits-box'), featuredBox);
  }

  function renderNotFound(){
    document.getElementById('public-profile-loading').style.display = 'none';
    document.getElementById('public-profile-notfound').style.display = 'block';
  }

  function renderProfile(profile){
    document.getElementById('public-profile-loading').style.display = 'none';
    document.getElementById('public-profile-body').style.display = 'block';
    document.title = profile.name + ' — Music Motel';

    var template = window.mmResolveTemplate ? window.mmResolveTemplate(profile) : 'performing_artist';
    var isFanProfile = template === 'fan';
    var isBand = profile.profile_kind === 'band';
    reorderForTemplate(template);
    document.getElementById('public-profile-tag').textContent = '/ ' + (isBand ? 'Band' : (window.mmTemplateTag ? window.mmTemplateTag(template) : 'Profile'));
    // A fan has nothing to book — same condition already used below to hide
    // the "Request a quote" button — so the heading shouldn't imply they do.
    document.getElementById('public-profile-heading').textContent = isFanProfile
      ? (profile.name || 'This profile') + ' on Music Motel'
      : isBand ? 'Book this band now' : (window.mmTemplateHeading ? window.mmTemplateHeading(template) : 'Book this profile now');
    document.getElementById('public-profile-sub').textContent = isFanProfile
      ? 'A fan on Music Motel — follow to keep up with them.'
      : 'Real profile on Music Motel — connect directly, no agency markup.';
    document.getElementById('public-profile-name').textContent = profile.name || 'Unnamed profile';
    document.getElementById('public-profile-role').textContent = window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(profile) : (profile.role_label || '');

    var locRow = document.getElementById('public-profile-loc');
    if (profile.location_label){
      locRow.style.display = 'flex';
      document.getElementById('public-profile-loc-text').textContent = profile.location_label;
    } else {
      locRow.style.display = 'none';
    }

    var availEl = document.getElementById('public-profile-availability');
    var availLabel = window.mmAvailabilityLabel ? window.mmAvailabilityLabel(profile.availability_status, profile.availability_until) : '';
    if (availLabel){
      availEl.style.display = 'inline-flex';
      availEl.textContent = availLabel;
      availEl.className = 'availability-pill avail-' + profile.availability_status;
    } else {
      availEl.style.display = 'none';
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

    function renderBadgeWrap(wrapId, listId, items){
      var wrap = document.getElementById(wrapId);
      var has = items && items.length;
      wrap.style.display = has ? 'block' : 'none';
      document.getElementById(listId).innerHTML = has
        ? items.map(function(v){ return '<span class="profile-modal-badge">' + escapeHtml(v) + '</span>'; }).join('')
        : '';
      return !!has;
    }
    var skillsBox = document.getElementById('public-profile-skills-box');
    var touringEl = document.getElementById('public-profile-touring');
    var touringLabel = window.mmTouringLevelLabel ? window.mmTouringLevelLabel(profile.touring_level) : '';
    var hasGenres = renderBadgeWrap('public-profile-genres-wrap', 'public-profile-genres', profile.genres);
    var hasSoftware = renderBadgeWrap('public-profile-software-wrap', 'public-profile-software', profile.software);
    var hasLanguages = renderBadgeWrap('public-profile-languages-wrap', 'public-profile-languages', profile.languages);
    var hasGear = renderBadgeWrap('public-profile-gear-wrap', 'public-profile-gear', profile.gear_list);
    if (touringLabel){
      touringEl.style.display = 'block';
      touringEl.textContent = touringLabel + ' touring level.';
    } else {
      touringEl.style.display = 'none';
    }
    skillsBox.style.display = (touringLabel || hasGenres || hasSoftware || hasLanguages || hasGear) ? 'block' : 'none';

    var tasteBox = document.getElementById('public-profile-taste-box');
    var bandsWrap = document.getElementById('public-profile-bands-wrap');
    var songsWrap = document.getElementById('public-profile-songs-wrap');
    var wantLiveEl = document.getElementById('public-profile-want-live');
    var hasBands = profile.favorite_bands && profile.favorite_bands.length;
    var hasSongs = profile.favorite_songs && profile.favorite_songs.length;
    var hasWantLive = !!profile.want_to_see_live;
    tasteBox.style.display = (hasBands || hasSongs || hasWantLive) ? 'block' : 'none';
    if (hasWantLive){
      wantLiveEl.style.display = 'block';
      wantLiveEl.textContent = 'Wants to see ' + profile.want_to_see_live + ' live.';
    } else {
      wantLiveEl.style.display = 'none';
    }
    bandsWrap.style.display = hasBands ? 'block' : 'none';
    document.getElementById('public-profile-bands').innerHTML = hasBands
      ? profile.favorite_bands.map(function(b){ return '<span class="profile-modal-badge">' + escapeHtml(b) + '</span>'; }).join('')
      : '';
    songsWrap.style.display = hasSongs ? 'block' : 'none';
    document.getElementById('public-profile-songs').innerHTML = hasSongs
      ? profile.favorite_songs.map(function(s){ return '<span class="profile-modal-badge">' + escapeHtml(s) + '</span>'; }).join('')
      : '';

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

    window.mmSupabase.from('profile_media').select('*').eq('user_id', profile.id).order('sort_order', { ascending: true }).then(function(res){
      var rows = res.data || [];
      if (!rows.length || !window.mmRenderMediaEmbed) return;
      var featured = rows.filter(function(r){ return r.is_featured; })[0];
      if (featured){
        var featuredBox = document.getElementById('public-profile-featured-box');
        featuredBox.style.display = 'block';
        var featuredEl = document.getElementById('public-profile-featured-embed');
        featuredEl.innerHTML = '';
        featuredEl.appendChild(window.mmRenderMediaEmbed(featured));
      }
      var rest = rows.filter(function(r){ return !featured || r.id !== featured.id; });
      if (rest.length){
        var portfolioBox = document.getElementById('public-profile-portfolio-box');
        portfolioBox.style.display = 'block';
        var portfolioEl = document.getElementById('public-profile-portfolio-list');
        portfolioEl.innerHTML = '';
        rest.forEach(function(item){ portfolioEl.appendChild(window.mmRenderMediaEmbed(item)); });
      }
    }).catch(function(){});

    window.mmSupabase.from('profile_credits').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).then(function(res){
      var rows = res.data || [];
      if (!rows.length) return;
      document.getElementById('public-profile-credits-box').style.display = 'block';
      var list = document.getElementById('public-profile-credits-list');
      list.innerHTML = rows.map(function(c){
        var detail = escapeHtml(c.credit_role) + (c.year ? ' · ' + escapeHtml(String(c.year)) : '');
        var titleHtml = c.link
          ? '<a href="' + escapeHtml(c.link) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(c.title) + '</a>'
          : escapeHtml(c.title);
        return '<div class="gig-log-item"><span class="gig-log-dot"></span><div style="flex:1;"><h5>' + titleHtml + '</h5><p>' + detail + '</p></div></div>';
      }).join('');
    }).catch(function(){});
  }

  authReady.then(function(){
    if (!configured()){ renderNotFound(); return; }
    window.mmSupabase.from('profiles')
      .select('id,name,role_label,location_label,account_type,instruments,profile_kind,avatar_url,avatar_color,bio,favorite_bands,favorite_songs,want_to_see_live,availability_status,availability_until,genres,software,languages,gear_list,touring_level,profile_template')
      .eq('id', sharedId).maybeSingle()
      .then(function(res){
        if (res.error || !res.data){ renderNotFound(); return; }
        renderProfile(res.data);
      })
      .catch(function(){ renderNotFound(); });
  });
})();
