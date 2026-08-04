(function(){
  var escapeHtml = window.mmEscapeHtml;
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  function loadProfilesByIds(ids){
    var unique = ids.filter(function(id, i){ return ids.indexOf(id) === i; });
    if (!unique.length) return Promise.resolve({});
    return window.mmSupabase.from('profiles').select('id,name,profile_kind').in('id', unique)
      .then(function(res){
        var map = {};
        (res.data || []).forEach(function(p){ map[p.id] = p; });
        return map;
      })
      .catch(function(){ return {}; });
  }

  // ===== request to join a band (client -> band's directory card) =====
  window.requestJoinBand = function(bandProfile){
    if (!currentUser()){
      if (window.openSignup) window.openSignup();
      return;
    }
    if (bandProfile.id === currentUser().id) return;
    window.mmSupabase.from('band_members').insert({
      band_profile_id: bandProfile.id,
      member_user_id: currentUser().id,
      role: 'editor',
      status: 'pending'
    }).then(function(res){
      if (res.error){
        // unique(band_profile_id, member_user_id) — most likely cause of a
        // failure here is "you already have a request or membership with
        // this band," which isn't worth surfacing as an alarming error.
        alert(res.error.message.indexOf('duplicate') > -1
          ? "You've already requested to unify with " + bandProfile.name + '.'
          : res.error.message);
        return;
      }
      alert('Request sent to ' + bandProfile.name + ' — you\'ll get edit access once they approve it.');
      refreshMyMemberships();
      if (window.mmNotify) window.mmNotify(bandProfile.id, 'band_join_requested', function(name){
        return name + ' wants to unify with your band.';
      }, 'band_manage');
    });
  };

  // ===== "Bands you're in" (any signed-in user) =====
  var myMembershipsEmptyEl = document.getElementById('my-memberships-empty');

  function loadMyMemberships(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('band_members').select('*').eq('member_user_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderMyMemberships(rows, bandNames){
    var card = document.getElementById('my-memberships-card');
    var list = document.getElementById('my-memberships-list');
    if (!card) return;
    if (!rows.length){ card.style.display = 'none'; return; }
    card.style.display = 'block';
    if (!rows.length){
      list.innerHTML = '';
      list.appendChild(myMembershipsEmptyEl);
      return;
    }
    list.innerHTML = '';
    rows.forEach(function(m){
      var band = bandNames[m.band_profile_id];
      var item = document.createElement('div');
      item.className = 'gig-log-item';
      item.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(band ? band.name : 'Unknown band') + '</h5>' +
        '<p>Role: ' + escapeHtml(m.role) + (m.status !== 'approved' ? ' · ' + escapeHtml(m.status) : '') + '</p></div>' +
        '<button class="gig-log-remove" aria-label="Leave">✕</button>';
      item.querySelector('.gig-log-remove').addEventListener('click', function(){
        if (!confirm(m.status === 'pending' ? 'Cancel this request?' : 'Leave this band?')) return;
        window.mmSupabase.from('band_members').delete().eq('id', m.id).then(function(){
          refreshMyMemberships();
        });
      });
      list.appendChild(item);
    });
  }

  function refreshMyMemberships(){
    if (!(configured() && currentUser())) return;
    loadMyMemberships().then(function(rows){
      if (!rows.length){ renderMyMemberships([], {}); return; }
      loadProfilesByIds(rows.map(function(r){ return r.band_profile_id; })).then(function(bandNames){
        renderMyMemberships(rows, bandNames);
      });
    });
  }

  // ===== manage members (only shown when signed in as a band account) =====
  var pendingEmptyEl = document.getElementById('band-pending-empty');
  var approvedEmptyEl = document.getElementById('band-approved-empty');

  function loadBandMembership(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('band_members').select('*').eq('band_profile_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderBandManagement(rows, memberNames, isBandAccount){
    var card = document.getElementById('band-manage-card');
    if (!card) return;
    if (!isBandAccount){ card.style.display = 'none'; return; }
    card.style.display = 'block';

    var pending = rows.filter(function(r){ return r.status === 'pending'; });
    var approved = rows.filter(function(r){ return r.status === 'approved'; });

    var pendingList = document.getElementById('band-pending-list');
    if (!pending.length){
      pendingList.innerHTML = '';
      pendingList.appendChild(pendingEmptyEl);
    } else {
      pendingList.innerHTML = '';
      pending.forEach(function(m){
        var name = memberNames[m.member_user_id] ? memberNames[m.member_user_id].name : 'Someone';
        var item = document.createElement('div');
        item.className = 'request-item';
        item.innerHTML =
          '<div class="request-item-meta"><h5>' + escapeHtml(name) + '</h5><p>Wants to unify with this band</p></div>' +
          '<div class="request-item-actions">' +
            '<select class="band-role-select">' +
              '<option value="editor">Editor — can edit the page</option>' +
              '<option value="admin">Admin — can edit + approve others</option>' +
              '<option value="viewer">Viewer — view only</option>' +
            '</select>' +
            '<button class="request-action-btn approve-btn">Approve</button>' +
            '<button class="request-action-btn decline decline-btn">Decline</button>' +
          '</div>';
        item.querySelector('.approve-btn').addEventListener('click', function(){
          var role = item.querySelector('.band-role-select').value;
          window.mmSupabase.from('band_members').update({ status: 'approved', role: role, decided_at: new Date().toISOString() }).eq('id', m.id).then(function(res){
            if (res.error){ alert(res.error.message); return; }
            refreshBandManagement();
            if (window.mmNotify) window.mmNotify(m.member_user_id, 'band_join_approved', function(name){
              return name + ' approved your request to unify.';
            }, 'my_memberships');
          });
        });
        item.querySelector('.decline-btn').addEventListener('click', function(){
          window.mmSupabase.from('band_members').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', m.id).then(function(res){
            if (res.error){ alert(res.error.message); return; }
            refreshBandManagement();
            if (window.mmNotify) window.mmNotify(m.member_user_id, 'band_join_declined', function(name){
              return name + ' declined your request to unify.';
            }, 'my_memberships');
          });
        });
        pendingList.appendChild(item);
      });
    }

    var approvedList = document.getElementById('band-approved-list');
    if (!approved.length){
      approvedList.innerHTML = '';
      approvedList.appendChild(approvedEmptyEl);
    } else {
      approvedList.innerHTML = '';
      approved.forEach(function(m){
        var name = memberNames[m.member_user_id] ? memberNames[m.member_user_id].name : 'Someone';
        var item = document.createElement('div');
        item.className = 'gig-log-item';
        item.innerHTML =
          '<span class="gig-log-dot"></span>' +
          '<div style="flex:1;"><h5>' + escapeHtml(name) + '</h5><p>' + escapeHtml(m.role) + '</p></div>' +
          '<button class="gig-log-remove" aria-label="Remove">✕</button>';
        item.querySelector('.gig-log-remove').addEventListener('click', function(){
          if (!confirm('Remove ' + name + ' from this band?')) return;
          window.mmSupabase.from('band_members').delete().eq('id', m.id).then(function(){
            refreshBandManagement();
          });
        });
        approvedList.appendChild(item);
      });
    }
  }

  function refreshBandManagement(){
    if (!(configured() && currentUser())) return;
    loadProfilesByIds([currentUser().id]).then(function(mine){
      var isBandAccount = mine[currentUser().id] && mine[currentUser().id].profile_kind === 'band';
      loadBandMembership().then(function(rows){
        if (!isBandAccount || !rows.length){
          renderBandManagement(rows, {}, isBandAccount);
          return;
        }
        loadProfilesByIds(rows.map(function(r){ return r.member_user_id; })).then(function(memberNames){
          renderBandManagement(rows, memberNames, isBandAccount);
        });
      });
    });
  }

  function refreshAll(){
    refreshMyMemberships();
    refreshBandManagement();
  }

  authReady.then(refreshAll);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ refreshAll(); });
  }
})();
