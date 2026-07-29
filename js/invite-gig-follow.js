(function(){
  function slugify(str){
    return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  window.slugifyPersonName = slugify;

  // ===== invite & earn UI =====
  var INVITE_SHARE_BONUS_KEY = 'invite-share-bonus-claimed';
  var REFERRAL_WELCOME_KEY = 'referral-welcome-claimed';

  function bumpInviteXPDisplay(amount){
    var el = document.getElementById('invite-xp-earned');
    if (!el) return;
    var current = parseInt(el.textContent, 10) || 0;
    el.textContent = current + amount;
  }

  function handleReferralCodeReady(){
    var link = window.getReferralLink ? window.getReferralLink() : null;
    var input = document.getElementById('invite-link-input');
    if (input && link) input.value = link;

    // one-time "you generated your invite link" bonus
    window.siteStorage.get(INVITE_SHARE_BONUS_KEY).then(function(claimed){
      if (claimed) return;
      window.siteStorage.set(INVITE_SHARE_BONUS_KEY, 'true');
      if (window.addXP) window.addXP(10, 'invite link ready');
      bumpInviteXPDisplay(10);
    });

    // if this visitor arrived via someone's link, give them a welcome bonus once
    if (window.markReferralConversion){
      window.markReferralConversion().then(function(referredByCode){
        if (!referredByCode) return;
        window.siteStorage.get(REFERRAL_WELCOME_KEY).then(function(claimed){
          if (claimed) return;
          window.siteStorage.set(REFERRAL_WELCOME_KEY, 'true');
          if (window.addXP) window.addXP(25, 'welcome bonus from an invite');
        });
      });
    }
  }

  // The referral code is generated asynchronously by another inline script
  // block. Rather than depending on script execution order (fragile across
  // two separate blocks), poll briefly until the code is available.
  var referralPollAttempts = 0;
  function pollForReferralCode(){
    referralPollAttempts++;
    if (typeof window.getReferralCode === 'function' && window.getReferralCode()){
      handleReferralCodeReady();
      return;
    }
    if (referralPollAttempts > 40) return; // ~4s of polling, then give up quietly
    setTimeout(pollForReferralCode, 100);
  }
  pollForReferralCode();

  var copyBtn = document.getElementById('invite-copy-btn');
  if (copyBtn){
    copyBtn.addEventListener('click', function(){
      var input = document.getElementById('invite-link-input');
      var status = document.getElementById('invite-status');
      if (!input.value || input.value.indexOf('Generating') === 0) return;

      var doCopySuccess = function(){
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        status.textContent = 'Link copied — share it anywhere.';
        setTimeout(function(){
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 1800);
      };

      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(input.value).then(doCopySuccess).catch(function(){
          input.select();
          status.textContent = 'Press Ctrl/Cmd+C to copy.';
        });
      } else {
        input.select();
        status.textContent = 'Press Ctrl/Cmd+C to copy.';
      }
    });
  }

  // ===== storage abstraction =====
  // Shared module defined once, near the top of the file (see the script
  // block right after the focus-trap utility).
  var siteStorage = window.siteStorage;

  function isSignedIn(){
    return !!(window.mmSupabaseConfigured && window.mmAuth && window.mmAuth.getUser());
  }
  var authReady = window.mmAuthReady || Promise.resolve();

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ===== gig log =====
  var GIG_LOG_KEY = 'fan-gig-log';

  function loadGigLogLocal(){
    return siteStorage.get(GIG_LOG_KEY)
      .then(function(val){ return val ? JSON.parse(val) : []; })
      .catch(function(){ return []; });
  }
  function saveGigLogLocal(gigs){
    return siteStorage.set(GIG_LOG_KEY, JSON.stringify(gigs));
  }
  function loadGigLogRemote(){
    return window.mmSupabase.from('gig_log').select('*').order('created_at', { ascending: true })
      .then(function(res){
        if (res.error || !res.data) return [];
        return res.data.map(function(row){
          return { id: row.id, artist: row.artist, venue: row.venue, date: row.date_text };
        });
      })
      .catch(function(){ return []; });
  }

  // Captured once, before any render ever clears #gig-log-list via
  // innerHTML — that placeholder is a child of the list, so re-querying it
  // by id after the first non-empty render would return null (it was
  // wiped out along with the old items) and crash the next empty render.
  var gigLogEmptyEl = document.getElementById('gig-log-empty');

  function renderGigLog(gigs){
    var list = document.getElementById('gig-log-list');
    if (!list) return;
    var empty = gigLogEmptyEl;
    if (!gigs || gigs.length === 0){
      list.innerHTML = '';
      list.appendChild(empty);
      return;
    }
    list.innerHTML = '';
    gigs.slice().reverse().forEach(function(gig, reversedIdx){
      var realIdx = gigs.length - 1 - reversedIdx;
      var item = document.createElement('div');
      item.className = 'gig-log-item';
      item.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(gig.artist) + '</h5><p>' + escapeHtml(gig.venue) + (gig.date ? ' · ' + escapeHtml(gig.date) : '') + '</p></div>' +
        '<button class="gig-log-remove" aria-label="Remove">✕</button>';
      item.querySelector('.gig-log-remove').addEventListener('click', function(){
        removeGig(realIdx);
      });
      list.appendChild(item);
    });
  }

  var currentGigs = [];
  function removeGig(idx){
    var removed = currentGigs[idx];
    currentGigs.splice(idx, 1);
    renderGigLog(currentGigs);
    if (isSignedIn() && removed && removed.id){
      // Supabase's query builder is a lazy thenable — the request isn't
      // actually dispatched until something calls .then()/awaits it, so
      // this can't be fire-and-forget without one.
      window.mmSupabase.from('gig_log').delete().eq('id', removed.id).then(function(){});
    } else {
      saveGigLogLocal(currentGigs);
    }
  }

  authReady.then(function(){
    var loader = isSignedIn() ? loadGigLogRemote() : loadGigLogLocal();
    return loader.then(function(gigs){
      currentGigs = gigs;
      renderGigLog(currentGigs);
    });
  });

  // The gig-log card (and its "+ Add a show" modal) only exists in the fan
  // dashboard, which now lives on profile.html only — guarded so this file
  // can still load on index.html (for the follow-state logic below, which
  // IS needed there) without crashing on missing elements.
  if (document.getElementById('fan-add-gig-btn')){
    document.getElementById('fan-add-gig-btn').addEventListener('click', function(){
      document.getElementById('add-gig-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      if (window.trapFocus) window.trapFocus(document.getElementById('add-gig-modal'));
    });
    var closeAddGig = function(){
      document.getElementById('add-gig-modal').classList.remove('open');
      document.body.style.overflow = '';
      if (window.releaseFocusTrap) window.releaseFocusTrap();
    };
    document.getElementById('add-gig-close-btn').addEventListener('click', closeAddGig);
    document.getElementById('add-gig-modal').addEventListener('click', function(e){
      if (e.target.id === 'add-gig-modal') closeAddGig();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && document.getElementById('add-gig-modal').classList.contains('open')) closeAddGig();
    });
    document.getElementById('gig-save-btn').addEventListener('click', function(){
      var artist = document.getElementById('gig-artist').value.trim();
      var venue = document.getElementById('gig-venue').value.trim();
      var date = document.getElementById('gig-date').value.trim();
      var statusEl = document.getElementById('gig-log-status');
      var saveBtn = document.getElementById('gig-save-btn');
      if (!artist){
        document.getElementById('gig-artist').focus();
        return;
      }

      function resetForm(){
        document.getElementById('gig-artist').value = '';
        document.getElementById('gig-venue').value = '';
        document.getElementById('gig-date').value = '';
        if (statusEl) statusEl.textContent = '';
        closeAddGig();
      }

      if (isSignedIn()){
        saveBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Saving…';
        window.mmSupabase.from('gig_log').insert({
          user_id: window.mmAuth.getUser().id,
          artist: artist, venue: venue, date_text: date
        }).select().single().then(function(res){
          saveBtn.disabled = false;
          if (res.error){
            if (statusEl) statusEl.textContent = res.error.message;
            return;
          }
          currentGigs.push({ id: res.data.id, artist: res.data.artist, venue: res.data.venue, date: res.data.date_text });
          renderGigLog(currentGigs);
          resetForm();
          if (window.refreshRealXP) window.refreshRealXP();
        });
      } else {
        currentGigs.push({ artist: artist, venue: venue, date: date });
        saveGigLogLocal(currentGigs);
        renderGigLog(currentGigs);
        resetForm();
      }
    });
  }

  // ===== following =====
  var FOLLOW_KEY = 'fan-following';

  function loadFollowingLocal(){
    return siteStorage.get(FOLLOW_KEY)
      .then(function(val){ return val ? JSON.parse(val) : {}; })
      .catch(function(){ return {}; });
  }
  function saveFollowingLocal(map){
    return siteStorage.set(FOLLOW_KEY, JSON.stringify(map));
  }

  // The follows table only stores follower_id/following_id (no name/role/
  // color), so on load we resolve each id back to display info: sample
  // people via the client-side PATCH_JACKS lookup, real accounts via a
  // public read of their profiles row.
  function resolvePersonMeta(id){
    var sample = window.getSamplePersonBySlug && window.getSamplePersonBySlug(id);
    if (sample) return Promise.resolve(sample);
    return window.mmSupabase.from('profiles').select('name,role_label,avatar_color,avatar_url').eq('id', id).maybeSingle()
      .then(function(res){
        if (res.error || !res.data) return { name: id, role: '', loc: '', color: '#2BE8D9', avatarUrl: null };
        return { name: res.data.name, role: res.data.role_label, loc: '', color: res.data.avatar_color, avatarUrl: res.data.avatar_url };
      })
      .catch(function(){ return { name: id, role: '', loc: '', color: '#2BE8D9', avatarUrl: null }; });
  }

  function loadFollowingRemote(){
    return window.mmSupabase.from('follows').select('following_id').eq('follower_id', window.mmAuth.getUser().id)
      .then(function(res){
        if (res.error || !res.data) return {};
        var ids = res.data.map(function(r){ return r.following_id; });
        return Promise.all(ids.map(resolvePersonMeta)).then(function(metas){
          var map = {};
          ids.forEach(function(id, i){ map[id] = metas[i]; });
          return map;
        });
      })
      .catch(function(){ return {}; });
  }

  var followingMap = {};
  authReady.then(function(){
    var loader = isSignedIn() ? loadFollowingRemote() : loadFollowingLocal();
    return loader.then(function(map){
      followingMap = map || {};
      renderFollowList();
    });
  });

  // Same reasoning as gigLogEmptyEl above: capture once, before any render
  // wipes #follow-list's children (including this placeholder) via
  // innerHTML.
  var followEmptyEl = document.getElementById('follow-empty');

  function renderFollowList(){
    var list = document.getElementById('follow-list');
    if (!list) return;
    var empty = followEmptyEl;
    var ids = Object.keys(followingMap);
    document.getElementById('fan-follow-count').textContent = ids.length + (ids.length === 1 ? ' artist' : ' artists');
    if (ids.length === 0){
      list.innerHTML = '';
      list.appendChild(empty);
      return;
    }
    list.innerHTML = '';
    ids.forEach(function(id){
      var person = followingMap[id];
      var item = document.createElement('div');
      item.className = 'follow-item';
      item.innerHTML =
        '<div class="follow-avatar"></div>' +
        '<div class="follow-meta"><h5>' + escapeHtml(person.name) + '</h5><p>' + escapeHtml(person.role) + '</p></div>' +
        '<button class="unfollow-btn">Unfollow</button>';
      // person.color/avatarUrl can come from a real profiles row
      // (resolvePersonMeta), which is remote, other-user-controlled data —
      // mmRenderAvatar only ever assigns it via img.src / a regex-validated
      // color, never string-concatenates it into innerHTML or a CSS value.
      if (window.mmRenderAvatar) window.mmRenderAvatar(item.querySelector('.follow-avatar'), person.avatarUrl, person.color, person.name);
      item.querySelector('.unfollow-btn').addEventListener('click', function(){
        window.toggleFollow(id, person);
      });
      list.appendChild(item);
    });
  }

  window.toggleFollow = function(personId, person){
    var wasFollowing = !!followingMap[personId];
    if (wasFollowing){
      delete followingMap[personId];
    } else {
      followingMap[personId] = person;
    }
    renderFollowList();

    if (isSignedIn()){
      var uid = window.mmAuth.getUser().id;
      var op = wasFollowing
        ? window.mmSupabase.from('follows').delete().eq('follower_id', uid).eq('following_id', personId)
        : window.mmSupabase.from('follows').insert({ follower_id: uid, following_id: personId });
      op.then(function(res){
        if (res && res.error){
          // revert the optimistic update if the write failed
          if (wasFollowing) followingMap[personId] = person; else delete followingMap[personId];
          renderFollowList();
        }
      });
    } else {
      saveFollowingLocal(followingMap);
    }
  };

  window.refreshFollowButton = function(btn, personId){
    var isFollowing = !!followingMap[personId];
    btn.textContent = isFollowing ? '✓ Following' : '+ Follow';
    btn.classList.toggle('following', isFollowing);
  };

  // expose slugify for the profile modal script
  window.slugify = slugify;
})();
