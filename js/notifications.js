(function(){
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  var escapeHtml = window.mmEscapeHtml;

  // ===== mmNotify: fire-and-forget cross-user insert =====
  // Same trust model as booking_requests/follows/booking_reviews and every
  // other cross-user insert on this site: there's no server-side trigger
  // in this static-site + Supabase setup, so the acting user's own client
  // inserts directly into the recipient's row. RLS only restricts *reading*
  // and *updating* a notification to its own recipient (see the
  // create_notifications migration) — it does not verify the actor is
  // genuinely part of the underlying relationship, which is a known,
  // disclosed limitation shared with the rest of the schema.
  //
  // `body` may be a plain string, or a function(myName) returning one —
  // the latter lets call sites avoid repeating the window.mmMyName().then()
  // boilerplate at all ~12 places this gets called from.
  window.mmNotify = function(recipientId, type, body, linkType, linkId){
    if (!configured() || !currentUser() || !recipientId || recipientId === currentUser().id) return;
    (window.mmMyName ? window.mmMyName() : Promise.resolve(null)).then(function(myName){
      var text = typeof body === 'function' ? body(myName || 'Someone') : body;
      window.mmSupabase.from('notifications').insert({
        user_id: recipientId,
        type: type,
        body: text,
        link_type: linkType || null,
        link_id: linkId != null ? String(linkId) : null
      }).then(function(){}, function(){});
    });
  };

  // Nothing below this point runs unless at least one notification surface
  // (the nav bell or the dashboard activity card) actually exists on this
  // page — mmNotify above still works standalone since other pages only
  // ever call it, never render its results.
  if (!document.getElementById('nav-bell-btn') && !document.getElementById('activity-card')) return;

  var TYPE_COLOR = {
    booking_requested: 'var(--cyan)', booking_quoted: 'var(--cyan)', booking_accepted: 'var(--green)',
    booking_declined: 'var(--red)', booking_completed: 'var(--green)', booking_message: 'var(--purple)',
    escrow_funded: 'var(--yellow)', escrow_released: 'var(--yellow)',
    new_follower: 'var(--pink)', band_join_requested: 'var(--purple)',
    band_join_approved: 'var(--green)', band_join_declined: 'var(--red)',
    roster_requested: 'var(--purple)', roster_approved: 'var(--green)', roster_declined: 'var(--red)'
  };

  function timeAgo(iso){
    var mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function notifHref(n){
    if (n.link_type === 'profile' && n.link_id) return 'profile.html?id=' + encodeURIComponent(n.link_id);
    if (n.link_type === 'requests') return 'profile.html#requests-card';
    if (n.link_type === 'band_manage') return 'profile.html#band-manage-card';
    if (n.link_type === 'my_memberships') return 'profile.html#my-memberships-card';
    if (n.link_type === 'roster_manage') return 'profile.html#roster-manage-card';
    if (n.link_type === 'my_representation') return 'profile.html#my-representation-card';
    return 'profile.html';
  }

  // Captured once — same "placeholder is a child of the list it describes"
  // reasoning as every other empty-state element on this site (see
  // js/invite-gig-follow.js) — re-querying by id after the first non-empty
  // render would return null.
  var navEmptyEl = document.getElementById('nav-notif-empty');
  var activityEmptyEl = document.getElementById('activity-empty');

  var allNotifs = [];

  function loadNotifications(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('notifications').select('*').eq('user_id', currentUser().id).order('created_at', { ascending: false }).limit(50)
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function markRead(n){
    if (n.read_at) return;
    n.read_at = new Date().toISOString();
    renderAll();
    window.mmSupabase.from('notifications').update({ read_at: n.read_at }).eq('id', n.id).then(function(){}, function(){});
  }

  function renderRow(n){
    var item = document.createElement('a');
    item.href = notifHref(n);
    item.className = 'notif-row' + (n.read_at ? '' : ' unread');
    item.innerHTML =
      '<span class="notif-dot" style="background:' + (TYPE_COLOR[n.type] || 'var(--cream-dim)') + ';"></span>' +
      '<div class="notif-row-body"><p>' + escapeHtml(n.body) + '</p><span class="notif-row-time">' + timeAgo(n.created_at) + '</span></div>';
    item.addEventListener('click', function(){ markRead(n); });
    return item;
  }

  function renderList(listEl, emptyEl, rows){
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!rows.length){
      if (emptyEl) listEl.appendChild(emptyEl);
      return;
    }
    rows.forEach(function(n){ listEl.appendChild(renderRow(n)); });
  }

  function renderAll(){
    var unread = allNotifs.filter(function(n){ return !n.read_at; });

    var dot = document.getElementById('nav-bell-dot');
    if (dot){
      dot.style.display = unread.length ? 'flex' : 'none';
      dot.textContent = unread.length > 9 ? '9+' : String(unread.length);
    }
    var mobileCount = document.getElementById('mobile-notif-count');
    if (mobileCount) mobileCount.textContent = unread.length ? ' (' + unread.length + ')' : '';

    renderList(document.getElementById('nav-notif-list'), navEmptyEl, allNotifs.slice(0, 15));

    var activityCard = document.getElementById('activity-card');
    if (activityCard){
      activityCard.style.display = isSignedIn() ? 'block' : 'none';
      renderList(document.getElementById('activity-list'), activityEmptyEl, allNotifs);
    }
  }

  function refresh(){
    if (!isSignedIn()){
      allNotifs = [];
      renderAll();
      return;
    }
    loadNotifications().then(function(rows){
      allNotifs = rows;
      renderAll();
    });
  }
  window.mmRefreshNotifications = refresh;

  function markAllRead(){
    var unread = allNotifs.filter(function(n){ return !n.read_at; });
    if (!unread.length) return;
    var now = new Date().toISOString();
    unread.forEach(function(n){ n.read_at = now; });
    renderAll();
    // Overwrites read_at for every one of the user's notifications rather
    // than filtering to only-unread — harmless (already-read rows just get
    // a newer read_at, which nothing displays), and avoids relying on a
    // .is('read_at', null) filter this project's mock test harness doesn't
    // implement.
    window.mmSupabase.from('notifications').update({ read_at: now }).eq('user_id', currentUser().id).then(function(){}, function(){});
  }

  var bellBtn = document.getElementById('nav-bell-btn');
  var panel = document.getElementById('nav-notif-panel');
  if (bellBtn && panel){
    bellBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var isOpen = panel.style.display === 'block';
      panel.style.display = isOpen ? 'none' : 'block';
      bellBtn.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) refresh();
    });
    document.addEventListener('click', function(e){
      if (panel.style.display === 'block' && !panel.contains(e.target) && e.target !== bellBtn){
        panel.style.display = 'none';
        bellBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && panel.style.display === 'block'){
        panel.style.display = 'none';
        bellBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var navMarkAllBtn = document.getElementById('nav-notif-markall-btn');
  if (navMarkAllBtn) navMarkAllBtn.addEventListener('click', function(e){ e.stopPropagation(); markAllRead(); });
  var activityMarkAllBtn = document.getElementById('activity-markall-btn');
  if (activityMarkAllBtn) activityMarkAllBtn.addEventListener('click', markAllRead);

  authReady.then(refresh);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ refresh(); });
  }
  // No realtime push in this pass (the funding_campaigns broadcast pattern
  // elsewhere on this site simulates one specific real Postgres trigger;
  // wiring every notification-producing insert through the same mock
  // machinery wasn't worth the added fragility here) — a periodic refresh
  // is enough for a bell/activity feed that's also refreshed on open.
  setInterval(function(){ if (isSignedIn()) refresh(); }, 30000);
})();
