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
      return '<span class="profile-modal-badge">' + escapeHtmlProfile(b.icon) + ' ' + escapeHtmlProfile(b.label) + '</span>';
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
      '<button class="profile-book-btn" id="profile-book-btn">📅 Book ' + escapeHtmlProfile(p.name.split(' ')[0]) + '</button>' +
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
      if (typeof window.openSignupWithRole === 'function'){
        window.openSignupWithRole(p.role);
      }
    });

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
