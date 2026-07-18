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

  // ===== gig log =====
  var GIG_LOG_KEY = 'fan-gig-log';

  function loadGigLog(){
    return siteStorage.get(GIG_LOG_KEY)
      .then(function(val){ return val ? JSON.parse(val) : []; })
      .catch(function(){ return []; });
  }
  function saveGigLog(gigs){
    return siteStorage.set(GIG_LOG_KEY, JSON.stringify(gigs));
  }

  function renderGigLog(gigs){
    var list = document.getElementById('gig-log-list');
    var empty = document.getElementById('gig-log-empty');
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
        gigs.splice(realIdx, 1);
        saveGigLog(gigs);
        renderGigLog(gigs);
      });
      list.appendChild(item);
    });
  }

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  var currentGigs = [];
  loadGigLog().then(function(gigs){
    currentGigs = gigs;
    renderGigLog(currentGigs);
  });

  document.getElementById('fan-add-gig-btn').addEventListener('click', function(){
    document.getElementById('add-gig-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(document.getElementById('add-gig-modal'));
  });
  function closeAddGig(){
    document.getElementById('add-gig-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
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
    if (!artist){
      document.getElementById('gig-artist').focus();
      return;
    }
    currentGigs.push({ artist: artist, venue: venue, date: date });
    saveGigLog(currentGigs);
    renderGigLog(currentGigs);
    document.getElementById('gig-artist').value = '';
    document.getElementById('gig-venue').value = '';
    document.getElementById('gig-date').value = '';
    closeAddGig();
  });

  // ===== following =====
  var FOLLOW_KEY = 'fan-following';

  function loadFollowing(){
    return siteStorage.get(FOLLOW_KEY)
      .then(function(val){ return val ? JSON.parse(val) : {}; })
      .catch(function(){ return {}; });
  }
  function saveFollowing(map){
    return siteStorage.set(FOLLOW_KEY, JSON.stringify(map));
  }

  var followingMap = {};
  loadFollowing().then(function(map){
    followingMap = map || {};
    renderFollowList();
  });

  function renderFollowList(){
    var list = document.getElementById('follow-list');
    var empty = document.getElementById('follow-empty');
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
        '<div class="follow-avatar" style="background:linear-gradient(135deg, ' + person.color + ', var(--yellow));"></div>' +
        '<div class="follow-meta"><h5>' + escapeHtml(person.name) + '</h5><p>' + escapeHtml(person.role) + '</p></div>' +
        '<button class="unfollow-btn">Unfollow</button>';
      item.querySelector('.unfollow-btn').addEventListener('click', function(){
        delete followingMap[id];
        saveFollowing(followingMap);
        renderFollowList();
      });
      list.appendChild(item);
    });
  }

  window.toggleFollow = function(personId, person){
    if (followingMap[personId]){
      delete followingMap[personId];
    } else {
      followingMap[personId] = person;
    }
    saveFollowing(followingMap);
    renderFollowList();
  };

  window.refreshFollowButton = function(btn, personId){
    var isFollowing = !!followingMap[personId];
    btn.textContent = isFollowing ? '✓ Following' : '+ Follow';
    btn.classList.toggle('following', isFollowing);
  };

  // expose slugify for the profile modal script
  window.slugify = slugify;
})();
