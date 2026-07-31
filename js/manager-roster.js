(function(){
  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  function loadProfilesByIds(ids){
    var unique = ids.filter(function(id, i){ return ids.indexOf(id) === i; });
    if (!unique.length) return Promise.resolve({});
    return window.mmSupabase.from('profiles').select('id,name,account_type,profile_template').in('id', unique)
      .then(function(res){
        var map = {};
        (res.data || []).forEach(function(p){ map[p.id] = p; });
        return map;
      })
      .catch(function(){ return {}; });
  }

  // ===== request representation (artist -> manager/agent profile) =====
  window.requestRepresentation = function(managerProfile){
    if (!currentUser()){
      if (window.openSignup) window.openSignup();
      return;
    }
    if (managerProfile.id === currentUser().id) return;
    window.mmSupabase.from('manager_roster').insert({
      manager_id: managerProfile.id,
      artist_id: currentUser().id,
      status: 'pending'
    }).then(function(res){
      if (res.error){
        // unique(manager_id, artist_id) — most likely cause of a failure
        // here is "you've already requested representation from them,"
        // which isn't worth surfacing as an alarming error.
        alert(res.error.message.indexOf('duplicate') > -1
          ? "You've already requested representation from " + managerProfile.name + '.'
          : res.error.message);
        return;
      }
      alert('Request sent to ' + managerProfile.name + " — you'll be notified once they respond.");
      refreshMyRepresentation();
      if (window.mmNotify) window.mmNotify(managerProfile.id, 'roster_requested', function(name){
        return name + ' requested representation from you.';
      }, 'roster_manage');
    });
  };

  // ===== "My representation" (any signed-in user — requests they've sent) =====
  // No empty-state placeholder needed here (unlike roster-manage-card's
  // pending/approved sub-lists below) — the whole card hides itself
  // instead when there's nothing to show.
  function loadMyRepresentation(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('manager_roster').select('*').eq('artist_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderMyRepresentation(rows, managerNames){
    var card = document.getElementById('my-representation-card');
    var list = document.getElementById('my-representation-list');
    if (!card) return;
    if (!rows.length){ card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = '';
    rows.forEach(function(m){
      var manager = managerNames[m.manager_id];
      var item = document.createElement('div');
      item.className = 'gig-log-item';
      item.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(manager ? manager.name : 'Unknown manager') + '</h5>' +
        '<p>' + (m.status === 'pending' ? 'Request pending' : (m.status === 'approved' ? 'Representing you' : 'Declined')) + '</p></div>' +
        '<button class="gig-log-remove" aria-label="Remove">✕</button>';
      item.querySelector('.gig-log-remove').addEventListener('click', function(){
        if (!confirm(m.status === 'pending' ? 'Cancel this request?' : 'End this representation?')) return;
        window.mmSupabase.from('manager_roster').delete().eq('id', m.id).then(function(){
          refreshMyRepresentation();
        });
      });
      list.appendChild(item);
    });
  }

  function refreshMyRepresentation(){
    if (!(configured() && currentUser())) return;
    loadMyRepresentation().then(function(rows){
      if (!rows.length){ renderMyRepresentation([], {}); return; }
      loadProfilesByIds(rows.map(function(r){ return r.manager_id; })).then(function(managerNames){
        renderMyRepresentation(rows, managerNames);
      });
    });
  }

  // ===== manage roster (only shown when signed in as a manager/agent) =====
  var rosterPendingEmptyEl = document.getElementById('roster-pending-empty');
  var rosterApprovedEmptyEl = document.getElementById('roster-approved-empty');

  function loadMyRosterRows(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('manager_roster').select('*').eq('manager_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderRosterManagement(rows, artistNames, isManagerAccount){
    var card = document.getElementById('roster-manage-card');
    if (!card) return;
    if (!isManagerAccount){ card.style.display = 'none'; return; }
    card.style.display = 'block';

    var pending = rows.filter(function(r){ return r.status === 'pending'; });
    var approved = rows.filter(function(r){ return r.status === 'approved'; });

    var pendingList = document.getElementById('roster-pending-list');
    if (!pending.length){
      pendingList.innerHTML = '';
      pendingList.appendChild(rosterPendingEmptyEl);
    } else {
      pendingList.innerHTML = '';
      pending.forEach(function(m){
        var name = artistNames[m.artist_id] ? artistNames[m.artist_id].name : 'Someone';
        var item = document.createElement('div');
        item.className = 'request-item';
        item.innerHTML =
          '<div class="request-item-meta"><h5>' + escapeHtml(name) + '</h5><p>Wants you to represent them</p></div>' +
          '<div class="request-item-actions">' +
            '<button class="request-action-btn approve-btn">Approve</button>' +
            '<button class="request-action-btn decline decline-btn">Decline</button>' +
          '</div>';
        item.querySelector('.approve-btn').addEventListener('click', function(){
          window.mmSupabase.from('manager_roster').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', m.id).then(function(res){
            if (res.error){ alert(res.error.message); return; }
            refreshRosterManagement();
            if (window.mmNotify) window.mmNotify(m.artist_id, 'roster_approved', function(name){
              return name + ' agreed to represent you.';
            }, 'my_representation');
          });
        });
        item.querySelector('.decline-btn').addEventListener('click', function(){
          window.mmSupabase.from('manager_roster').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', m.id).then(function(res){
            if (res.error){ alert(res.error.message); return; }
            refreshRosterManagement();
            if (window.mmNotify) window.mmNotify(m.artist_id, 'roster_declined', function(name){
              return name + ' declined to represent you.';
            }, 'my_representation');
          });
        });
        pendingList.appendChild(item);
      });
    }

    var approvedList = document.getElementById('roster-approved-list');
    if (!approved.length){
      approvedList.innerHTML = '';
      approvedList.appendChild(rosterApprovedEmptyEl);
    } else {
      approvedList.innerHTML = '';
      approved.forEach(function(m){
        var name = artistNames[m.artist_id] ? artistNames[m.artist_id].name : 'Someone';
        var item = document.createElement('div');
        item.className = 'gig-log-item';
        item.innerHTML =
          '<span class="gig-log-dot"></span>' +
          '<div style="flex:1;"><h5>' + escapeHtml(name) + '</h5><p>Represented</p></div>' +
          '<button class="gig-log-remove" aria-label="Remove">✕</button>';
        item.querySelector('.gig-log-remove').addEventListener('click', function(){
          if (!confirm('Remove ' + name + ' from your roster?')) return;
          window.mmSupabase.from('manager_roster').delete().eq('id', m.id).then(function(){
            refreshRosterManagement();
          });
        });
        approvedList.appendChild(item);
      });
    }
  }

  function refreshRosterManagement(){
    if (!(configured() && currentUser())) return;
    loadProfilesByIds([currentUser().id]).then(function(mine){
      var me = mine[currentUser().id];
      var isManagerAccount = !!(me && me.account_type === 'venue' && me.profile_template === 'manager_agent');
      loadMyRosterRows().then(function(rows){
        if (!isManagerAccount || !rows.length){
          renderRosterManagement(rows, {}, isManagerAccount);
          return;
        }
        loadProfilesByIds(rows.map(function(r){ return r.artist_id; })).then(function(artistNames){
          renderRosterManagement(rows, artistNames, isManagerAccount);
        });
      });
    });
  }

  function refreshAll(){
    refreshMyRepresentation();
    refreshRosterManagement();
  }

  authReady.then(refreshAll);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ refreshAll(); });
  }
})();
