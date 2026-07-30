(function(){
  // ===== profile detail modal =====
  function openProfileModal(){
    document.getElementById('profile-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(document.getElementById('profile-modal'));
  }
  function closeProfileModal(){
    document.getElementById('profile-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }

  function escapeHtmlProfile(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  window.openProfile = function(jack){
    var p = jack.person;
    if (!p) return;
    var personId = slugify(p.name);

    document.getElementById('profile-modal-title').textContent = p.name;

    var badgesHtml = p.badges.map(function(b){
      // b.icon is either a known icon key (rendered as a trusted, hand-written
      // SVG — never user input) or a plain symbol character like ✓/★/♪, which
      // already renders fine as escaped text.
      var iconHtml = (window.mmIcon && window.mmIcon(b.icon)) || escapeHtmlProfile(b.icon);
      return '<span class="profile-modal-badge">' + iconHtml + ' ' + escapeHtmlProfile(b.label) + '</span>';
    }).join('');

    var gigsHtml = p.gigs.map(function(g){
      return '<div class="profile-gig-item">' +
        '<span class="profile-gig-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtmlProfile(g.title) + '</h5><p>' + escapeHtmlProfile(g.detail) + '</p></div>' +
        '<span class="profile-gig-xp">+' + escapeHtmlProfile(g.xp) + 'XP</span>' +
        '</div>';
    }).join('');

    var avatarGradient = 'linear-gradient(135deg, ' + jack.color + ', var(--yellow))';

    document.getElementById('profile-modal-body').innerHTML =
      '<div class="profile-modal-header">' +
        '<div class="profile-modal-avatar" style="background:' + avatarGradient + ';"></div>' +
        '<div class="profile-modal-meta">' +
          '<div class="profile-modal-name">' + escapeHtmlProfile(p.name) + '</div>' +
          '<div class="profile-modal-role">' + escapeHtmlProfile(p.role) + '</div>' +
          '<div class="profile-modal-loc"><span class="pindot"></span>' + escapeHtmlProfile(jack.loc) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="profile-strength-row">' +
        '<div class="xp-row"><span>Profile strength</span><span>' + p.strength + '%</span></div>' +
        '<div class="xp-track"><div class="xp-fill" style="width:' + p.strength + '%;"></div></div>' +
      '</div>' +
      '<p class="profile-bio">' + escapeHtmlProfile(p.bio) + '</p>' +
      '<div class="profile-badge-row">' + badgesHtml + '</div>' +
      '<button class="follow-btn-profile" id="profile-follow-btn">+ Follow</button>' +
      '<div class="profile-gig-label" style="margin-top:20px;">Gig list history</div>' +
      '<div class="profile-gig-list">' + gigsHtml + '</div>' +
      '<button class="profile-book-btn" id="profile-book-btn">' + (window.mmIcon('calendar') || '') + ' Book ' + escapeHtmlProfile(p.name.split(' ')[0]) + '</button>' +
      '<button class="profile-unify-btn" id="profile-unify-btn">Unify with ' + escapeHtmlProfile(p.name.split(' ')[0]) + '</button>' +
      '<div class="profile-fake-note">This is sample profile data for preview — real profiles will be created by members signing up.</div>';

    // wire follow button, reflecting current saved state
    var followBtn = document.getElementById('profile-follow-btn');
    refreshFollowButton(followBtn, personId);
    followBtn.addEventListener('click', function(){
      toggleFollow(personId, { name: p.name, role: p.role, loc: jack.loc, color: jack.color });
      refreshFollowButton(followBtn, personId);
    });

    document.getElementById('profile-book-btn').addEventListener('click', function(){
      closeProfileModal();
      if (typeof window.openBooking === 'function'){
        window.openBooking({ name: p.name, role: p.role, loc: jack.loc, color: jack.color });
      }
    });

    document.getElementById('profile-unify-btn').addEventListener('click', function(){
      closeProfileModal();
      // This card is sample/preview data (see .profile-fake-note above) —
      // there's no real person here to send a request to, so the button
      // instead starts a profile in the same role. Without this toast that
      // reads as a silent, unexplained redirect away from "unify with
      // this person" into an unrelated signup form.
      if (window.showToast) window.showToast(p.name.split(' ')[0] + ' is a preview profile — let\'s set up your own ' + p.role + ' profile instead.');
      if (typeof window.openSignupWithRole === 'function'){
        window.openSignupWithRole(p.role);
      }
    });

    openProfileModal();
  };

  // ===== real registered profile (from the nearby-players directory) =====
  // Distinct render path from openProfile() above: real profiles have no
  // badges/gig-history/strength score (those are sample-data-only fields),
  // but do have a real uuid, so Follow/Request a quote/Unify wire straight
  // into the same real tables/functions the artist directory already uses.
  window.openRealProfile = function(profile, distanceKm){
    document.getElementById('profile-modal-title').textContent = profile.name || 'Unnamed profile';

    var isBand = profile.profile_kind === 'band';
    var locBits = [];
    if (profile.location_label) locBits.push(profile.location_label);
    if (distanceKm != null && window.mmFormatDistanceKm) locBits.push(window.mmFormatDistanceKm(distanceKm));

    var instrumentsHtml = (profile.instruments && profile.instruments.length)
      ? '<div class="profile-badge-row">' + profile.instruments.map(function(instr){
          return '<span class="profile-modal-badge">' + escapeHtmlProfile(instr) + '</span>';
        }).join('') + '</div>'
      : '';

    var availLabel = window.mmAvailabilityLabel ? window.mmAvailabilityLabel(profile.availability_status, profile.availability_until) : '';

    document.getElementById('profile-modal-body').innerHTML =
      '<div class="profile-modal-header">' +
        '<div class="profile-modal-avatar" id="profile-modal-avatar-el"></div>' +
        '<div class="profile-modal-meta">' +
          '<div class="profile-modal-name">' + escapeHtmlProfile(profile.name) + (isBand ? ' · BAND' : '') + '</div>' +
          '<div class="profile-modal-role">' + escapeHtmlProfile(window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(profile) : (profile.role_label || '')) + '</div>' +
          (locBits.length ? '<div class="profile-modal-loc"><span class="pindot"></span>' + escapeHtmlProfile(locBits.join(' · ')) + '</div>' : '') +
        '</div>' +
      '</div>' +
      (availLabel ? '<div class="availability-pill avail-' + escapeHtmlProfile(profile.availability_status) + '">' + escapeHtmlProfile(availLabel) + '</div>' : '') +
      (profile.bio ? '<p class="profile-bio">' + escapeHtmlProfile(profile.bio) + '</p>' : '') +
      instrumentsHtml +
      '<a class="invite-copy-btn" id="profile-view-full-btn" style="display:block; text-align:center; text-decoration:none; margin-bottom:12px;">View full profile</a>' +
      '<button class="follow-btn-profile" id="profile-follow-btn">+ Follow</button>' +
      (profile.account_type !== 'fan' ? '<button class="profile-book-btn" id="profile-book-btn">' + (window.mmIcon('calendar') || '') + ' Request a quote</button>' : '') +
      (isBand ? '<button class="profile-unify-btn" id="profile-unify-btn">Unify with ' + escapeHtmlProfile(profile.name || 'this band') + '</button>' : '');

    // profile.avatar_color/avatar_url are remote, other-user-controlled data
    // — mmRenderAvatar assigns them via img.src / a regex-validated color
    // rather than interpolating into the innerHTML string above.
    if (window.mmRenderAvatar) window.mmRenderAvatar(document.getElementById('profile-modal-avatar-el'), profile.avatar_url, profile.avatar_color, profile.name);

    document.getElementById('profile-view-full-btn').href = window.mmProfileShareUrl
      ? window.mmProfileShareUrl(profile.id)
      : ('profile.html?id=' + encodeURIComponent(profile.id));

    var followBtn = document.getElementById('profile-follow-btn');
    refreshFollowButton(followBtn, profile.id);
    followBtn.addEventListener('click', function(){
      toggleFollow(profile.id, { name: profile.name, role: profile.role_label, loc: profile.location_label, color: profile.avatar_color, avatarUrl: profile.avatar_url });
      refreshFollowButton(followBtn, profile.id);
    });

    var bookBtn = document.getElementById('profile-book-btn');
    if (bookBtn){
      bookBtn.addEventListener('click', function(){
        closeProfileModal();
        if (typeof window.openQuoteRequest === 'function') window.openQuoteRequest(profile);
      });
    }

    var unifyBtn = document.getElementById('profile-unify-btn');
    if (unifyBtn){
      unifyBtn.addEventListener('click', function(){
        closeProfileModal();
        if (typeof window.requestJoinBand === 'function') window.requestJoinBand(profile);
      });
    }

    openProfileModal();
  };

  document.getElementById('profile-close-btn').addEventListener('click', closeProfileModal);
  document.getElementById('profile-modal').addEventListener('click', function(e){
    if (e.target.id === 'profile-modal') closeProfileModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('profile-modal').classList.contains('open')) closeProfileModal();
  });
})();
