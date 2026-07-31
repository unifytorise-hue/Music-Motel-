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

    var user = currentUser();
    var isOwnProfile = !!(user && user.id === profile.id);

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
    var locationHidden = profile.hide_exact_location && !isOwnProfile;
    if (profile.location_label && !locationHidden){
      locRow.style.display = 'flex';
      document.getElementById('public-profile-loc-text').textContent = profile.location_label;
    } else {
      locRow.style.display = 'none';
    }

    var boostBadgeEl = document.getElementById('public-profile-boost-badge');
    boostBadgeEl.style.display = (window.mmIsBoosted && window.mmIsBoosted(profile)) ? 'inline-flex' : 'none';

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
        if (window.toggleFollow) window.toggleFollow(profile.id, { name: profile.name, role: profile.role_label, loc: locationHidden ? '' : profile.location_label, color: profile.avatar_color, avatarUrl: profile.avatar_url });
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

      var requestRepBtn = document.getElementById('public-profile-request-rep-btn');
      if (template === 'manager_agent'){
        requestRepBtn.style.display = '';
        requestRepBtn.addEventListener('click', function(){
          if (window.requestRepresentation) window.requestRepresentation(profile);
        });
      }
    }

    if (!configured()) return;
    if (!profile.hide_rate || isOwnProfile){
      window.mmSupabase.from('artist_rate_cards').select('*').eq('user_id', profile.id).maybeSingle().then(function(res){
        var card = (res.error || !res.data) ? null : res.data;
        if (!card || card.rate_amount == null || !card.booking_agent_terms_accepted_at) return;
        document.getElementById('public-profile-rate-box').style.display = 'block';
        document.getElementById('public-profile-rate-preview').innerHTML = window.renderRateCardBox ? window.renderRateCardBox(card) : '';
      }).catch(function(){});
    }

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

    if (window.mmVerificationTiers){
      Promise.all([
        window.mmSupabase.from('profile_platform_links').select('verified_at').eq('user_id', profile.id),
        window.mmSupabase.from('profile_credits').select('id').eq('user_id', profile.id),
        window.mmSupabase.from('booking_requests').select('id').eq('artist_id', profile.id).eq('status', 'completed'),
        window.mmSupabase.from('booking_reviews').select('rating').eq('reviewee_id', profile.id)
      ]).then(function(results){
        var signals = {
          hasVerifiedPlatformLink: (results[0].data || []).some(function(l){ return l.verified_at; }),
          hasCreditsOrTouring: (results[1].data || []).length > 0 || !!profile.touring_level || !!profile.pro_membership_number,
          completedBookingCount: (results[2].data || []).length,
          hasPositiveReview: (results[3].data || []).some(function(r){ return r.rating >= 4; })
        };
        var earned = window.mmVerificationTiers(profile, signals).filter(function(t){ return t.done; });
        document.getElementById('public-profile-verification-badges').innerHTML = earned.map(function(t){
          return '<span class="verification-tier-pill earned" title="' + escapeHtml(t.desc) + '"><span class="tier-dot"></span>' + escapeHtml(t.label) + '</span>';
        }).join('');
      }).catch(function(){});
    }

    // Represented artists (this profile is the manager/agent) and
    // represented-by (this profile is the artist) are independent
    // queries — a profile could in principle show both, though in
    // practice only one direction will ever have rows for a given account.
    window.mmSupabase.from('manager_roster').select('artist_id').eq('manager_id', profile.id).eq('status', 'approved').then(function(res){
      var rows = res.data || [];
      if (!rows.length) return;
      window.mmSupabase.from('profiles').select('id,name,role_label,avatar_color,avatar_url,profile_kind').in('id', rows.map(function(r){ return r.artist_id; })).then(function(res2){
        var artists = res2.data || [];
        if (!artists.length) return;
        var box = document.getElementById('public-profile-roster-box');
        var list = document.getElementById('public-profile-roster-list');
        box.style.display = 'block';
        list.innerHTML = '';
        artists.forEach(function(a){
          var item = document.createElement('a');
          item.href = window.mmProfileShareUrl ? window.mmProfileShareUrl(a.id) : ('profile.html?id=' + encodeURIComponent(a.id));
          item.className = 'gig-log-item tappable';
          item.innerHTML =
            '<span class="player-avatar"></span>' +
            '<div style="flex:1;"><h5>' + escapeHtml(a.name) + '</h5>' +
            '<p>' + escapeHtml(window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(a) : (a.role_label || '')) + '</p></div>';
          if (window.mmRenderAvatar) window.mmRenderAvatar(item.querySelector('.player-avatar'), a.avatar_url, a.avatar_color, a.name);
          list.appendChild(item);
        });
      }).catch(function(){});
    }).catch(function(){});

    window.mmSupabase.from('manager_roster').select('manager_id').eq('artist_id', profile.id).eq('status', 'approved').then(function(res){
      var rows = res.data || [];
      if (!rows.length) return;
      window.mmSupabase.from('profiles').select('id,name').in('id', rows.map(function(r){ return r.manager_id; })).then(function(res2){
        var managers = res2.data || [];
        if (!managers.length) return;
        var el = document.getElementById('public-profile-represented-by');
        el.style.display = 'block';
        el.textContent = 'Represented by ' + managers.map(function(m){ return m.name; }).join(', ') + '.';
      }).catch(function(){});
    }).catch(function(){});

    window.mmSupabase.from('listings').select('*').eq('user_id', profile.id).eq('active', true).order('created_at').then(function(res){
      var rows = res.data || [];
      var box = document.getElementById('public-profile-listings-box');
      var list = document.getElementById('public-profile-listings-list');
      if (!rows.length){ box.style.display = 'none'; return; }
      box.style.display = 'block';
      list.innerHTML = '';
      rows.forEach(function(l){
        var typeLabel = window.mmListingTypeLabel ? window.mmListingTypeLabel(l.listing_type) : l.listing_type;
        var priceText = window.mmListingPriceText ? window.mmListingPriceText(l) : null;
        var metaBits = [typeLabel];
        if (priceText) metaBits.push(priceText);
        if (l.location_label) metaBits.push(l.location_label);
        var card = document.createElement('div');
        card.className = 'content-box';
        card.style.marginBottom = '12px';
        card.innerHTML =
          '<h4 style="margin-bottom:4px;">' + escapeHtml(l.title) + '</h4>' +
          '<p class="rate-card-note" style="margin-bottom:8px;">' + escapeHtml(metaBits.join(' · ')) + '</p>' +
          (l.description ? '<p class="profile-bio" style="margin-bottom:10px;">' + escapeHtml(l.description) + '</p>' : '') +
          (isOwnProfile ? '' : '<button class="request-quote-btn book-listing-btn" type="button">Request to book</button>');
        var bookBtn = card.querySelector('.book-listing-btn');
        if (bookBtn){
          bookBtn.addEventListener('click', function(){
            if (window.openQuoteRequest) window.openQuoteRequest(profile, {
              eventType: l.listing_type === 'space' ? 'Space rental' : 'Lesson / workshop',
              details: l.title + (l.description ? ' — ' + l.description : '')
            });
          });
        }
        list.appendChild(card);
      });
    }).catch(function(){});
  }

  function renderPrivate(){
    document.getElementById('public-profile-loading').style.display = 'none';
    document.getElementById('public-profile-private').style.display = 'block';
  }

  // ===== Similar profiles =====
  // Scored purely on overlap with the viewed profile's own fields (account
  // type, genres, instruments, role_label) — no click-through or booking
  // history involved, so this can't leak anything the visitor couldn't
  // already see on each candidate's own public profile.
  var SIMILAR_MAX = 5;

  function similarityScore(target, candidate){
    var score = 0;
    if (candidate.account_type && candidate.account_type === target.account_type) score += 3;
    if (target.role_label && candidate.role_label && candidate.role_label.toLowerCase() === target.role_label.toLowerCase()) score += 2;
    function overlapCount(a, b){
      if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
      var bLower = b.map(function(v){ return String(v).toLowerCase(); });
      return a.filter(function(v){ return bLower.indexOf(String(v).toLowerCase()) > -1; }).length;
    }
    score += overlapCount(target.genres, candidate.genres) * 2;
    score += overlapCount(target.instruments, candidate.instruments) * 2;
    score += overlapCount(target.gear_list, candidate.gear_list);
    score += overlapCount(target.languages, candidate.languages);
    // A paid boost (monetization layer — see js/boost.js) nudges ranking
    // among otherwise-relevant candidates; it never surfaces a profile with
    // no genuine overlap, since callers still filter on score > 0 first.
    if (window.mmIsBoosted && window.mmIsBoosted(candidate)) score += 1;
    return score;
  }

  function renderSimilarProfiles(target, followSets){
    var box = document.getElementById('public-profile-similar-box');
    var list = document.getElementById('public-profile-similar-list');
    if (!box || !list || !configured()) return;
    window.mmSupabase.from('profiles')
      .select('id,name,account_type,role_label,bio,location_label,avatar_color,avatar_url,profile_kind,instruments,genres,gear_list,languages,profile_visibility,hide_exact_location,boosted_until')
      .neq('id', target.id)
      .then(function(res){
        var rows = res.data || [];
        var viewerId = (currentUser() || {}).id;
        var scored = rows
          .filter(function(r){ return window.mmCanViewProfile ? window.mmCanViewProfile(r, viewerId, followSets) : true; })
          .map(function(r){ return { profile: r, score: similarityScore(target, r) }; })
          .filter(function(s){ return s.score > 0; })
          .sort(function(a, b){ return b.score - a.score; })
          .slice(0, SIMILAR_MAX);

        if (!scored.length){ box.style.display = 'none'; return; }
        box.style.display = 'block';
        list.innerHTML = '';
        scored.forEach(function(s){
          var p = s.profile;
          var isBand = p.profile_kind === 'band';
          var subBits = [];
          var roleAndType = window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(p) : '';
          if (roleAndType) subBits.push(roleAndType);
          if (p.location_label && !p.hide_exact_location) subBits.push(p.location_label);

          var boostBadgeHtml = window.mmIsBoosted && window.mmIsBoosted(p) ? '<span class="boost-badge">⚡ Boosted</span> ' : '';

          var item = document.createElement('div');
          item.className = 'gig-log-item tappable';
          item.setAttribute('tabindex', '0');
          item.setAttribute('role', 'button');
          item.setAttribute('aria-label', 'View profile for ' + p.name);
          item.innerHTML =
            '<span class="player-avatar"></span>' +
            '<div style="flex:1;"><h5>' + boostBadgeHtml + escapeHtml(p.name) + (isBand ? ' · BAND' : '') + '</h5>' +
            '<p>' + escapeHtml(subBits.join(' · ')) + '</p></div>' +
            '<span class="gig-log-chevron">→</span>';
          if (window.mmRenderAvatar) window.mmRenderAvatar(item.querySelector('.player-avatar'), p.avatar_url, p.avatar_color, p.name);
          function activate(){
            if (window.openRealProfile) window.openRealProfile(p, null);
          }
          item.addEventListener('click', activate);
          item.addEventListener('keydown', function(e){
            if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activate(); }
          });
          list.appendChild(item);
        });
      }).catch(function(){});
  }

  authReady.then(function(){
    if (!configured()){ renderNotFound(); return; }
    window.mmSupabase.from('profiles')
      .select('id,name,role_label,location_label,account_type,instruments,profile_kind,avatar_url,avatar_color,bio,favorite_bands,favorite_songs,want_to_see_live,availability_status,availability_until,genres,software,languages,gear_list,touring_level,profile_template,profile_visibility,hide_rate,hide_exact_location,phone_verified_at,id_verified_at,id_verification_confidence,pro_membership_org,pro_membership_number,boosted_until')
      .eq('id', sharedId).maybeSingle()
      .then(function(res){
        if (res.error || !res.data){ renderNotFound(); return; }
        var profile = res.data;
        var user = currentUser();
        (window.mmLoadMyFollowSets ? window.mmLoadMyFollowSets() : Promise.resolve(null)).then(function(followSets){
          if (user && user.id === profile.id){ renderProfile(profile); renderSimilarProfiles(profile, followSets); return; }
          var canView = window.mmCanViewProfile ? window.mmCanViewProfile(profile, user && user.id, followSets) : true;
          if (!canView){ renderPrivate(); return; }
          renderProfile(profile);
          renderSimilarProfiles(profile, followSets);
        });
      })
      .catch(function(){ renderNotFound(); });
  });
})();
