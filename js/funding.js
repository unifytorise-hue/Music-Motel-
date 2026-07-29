(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  var authReady = window.mmAuthReady || Promise.resolve();

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
  function money(amount){
    return window.mmFormatMoney ? window.mmFormatMoney(amount) : '$' + Number(amount).toFixed(0);
  }

  // This page doesn't load js/hero-game.js (index.html-only), which is
  // where window.showToast normally comes from — same implementation,
  // reused here so pledge/share confirmations have the same feedback as
  // everywhere else on the site.
  if (!window.showToast){
    window.showToast = function(text){
      var toast = document.getElementById('toast');
      if (!toast) return;
      document.getElementById('toast-text').textContent = text;
      toast.classList.add('show');
      clearTimeout(toast._t);
      var duration = Math.max(1800, Math.min(4200, text.length * 55));
      toast._t = setTimeout(function(){ toast.classList.remove('show'); }, duration);
    };
  }

  var CATEGORIES = {
    gear:       { label: 'Gear',        heading: 'Fund my gear',        color: 'var(--orange)' },
    bus:        { label: 'Tour Bus',    heading: 'Fund my tour bus',    color: 'var(--cyan)' },
    gig:        { label: 'A Gig',       heading: 'Fund my gig',         color: 'var(--green)' },
    recordings: { label: 'Recordings',  heading: 'Fund my recordings',  color: 'var(--purple)' },
    demo:       { label: 'A Demo',      heading: 'Fund my demo',        color: 'var(--pink)' },
    album:      { label: 'An Album',    heading: 'Fund my album',       color: 'var(--yellow)' },
    other:      { label: 'Something Else', heading: 'Fund this',        color: 'var(--cream-dim)' }
  };
  function catMeta(cat){ return CATEGORIES[cat] || CATEGORIES.other; }

  window.mmCampaignShareUrl = function(campaignId){
    var url = new URL(window.location.origin + '/funding.html');
    url.searchParams.set('id', campaignId);
    return url.toString();
  };

  function shareCampaign(campaign){
    var url = window.mmCampaignShareUrl(campaign.id);
    var text = catMeta(campaign.category).heading + ' — help me get there on Music Motel.';
    if (navigator.share){
      navigator.share({ title: campaign.title || catMeta(campaign.category).heading, text: text, url: url }).catch(function(){});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){
        if (window.showToast) window.showToast('Link copied — post it anywhere.');
      });
    }
  }

  function loadProfilesByIds(ids){
    var unique = ids.filter(function(id, i){ return ids.indexOf(id) === i; });
    if (!unique.length || !configured()) return Promise.resolve({});
    return window.mmSupabase.from('profiles').select('id,name,role_label,account_type,avatar_url,avatar_color').in('id', unique)
      .then(function(res){
        var map = {};
        (res.data || []).forEach(function(p){ map[p.id] = p; });
        return map;
      })
      .catch(function(){ return {}; });
  }

  // ===== browse grid =====
  var allCampaigns = [];
  var profilesById = {};
  var activeFilter = 'all';

  function renderFilterTabs(){
    var tabsEl = document.getElementById('funding-filter-tabs');
    if (!tabsEl) return;
    var cats = ['all'].concat(Array.from(new Set(allCampaigns.map(function(c){ return c.category; }))));
    tabsEl.innerHTML = '';
    cats.forEach(function(cat){
      var btn = document.createElement('button');
      btn.className = 'gear-filter-tab' + (cat === activeFilter ? ' active' : '');
      btn.textContent = cat === 'all' ? 'All' : catMeta(cat).label;
      btn.addEventListener('click', function(){
        activeFilter = cat;
        renderFilterTabs();
        renderGrid();
      });
      tabsEl.appendChild(btn);
    });
  }

  function progressPct(campaign){
    if (!campaign.goal_amount) return 0;
    return Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100));
  }

  function renderGrid(){
    var grid = document.getElementById('funding-grid');
    if (!grid) return;
    if (!configured()){
      grid.innerHTML = '<div class="gear-empty">Fundraising needs a live Music Motel account to work — check back soon.</div>';
      return;
    }
    var visible = allCampaigns.filter(function(c){ return activeFilter === 'all' || c.category === activeFilter; });
    if (!visible.length){
      grid.innerHTML = '<div class="gear-empty">No campaigns yet — be the first to start one.</div>';
      return;
    }
    grid.innerHTML = '';
    visible.forEach(function(c){
      var meta = catMeta(c.category);
      var owner = profilesById[c.user_id];
      var pct = progressPct(c);
      var card = document.createElement('div');
      card.className = 'gear-card campaign-card';
      card.style.setProperty('--camp-color', meta.color);
      card.setAttribute('data-campaign-id', c.id);
      card.innerHTML =
        '<div class="gear-card-cat">' + escapeHtml(meta.label) + (c.item_label ? ' · ' + escapeHtml(c.item_label) : '') + '</div>' +
        '<h4>' + escapeHtml(c.title || meta.heading) + '</h4>' +
        '<p class="gear-card-condition">' + escapeHtml(owner ? owner.name : 'Someone on Music Motel') + '</p>' +
        '<div class="campaign-progress-row">' +
          '<span class="campaign-progress-raised" data-role="raised">' + escapeHtml(money(c.raised_amount)) + '</span>' +
          '<span class="campaign-progress-goal">of ' + escapeHtml(money(c.goal_amount)) + '</span>' +
        '</div>' +
        '<div class="xp-track"><div class="xp-fill" data-role="fill" style="width:' + pct + '%;"></div></div>' +
        '<div class="gear-card-foot" style="margin-top:14px;">' +
          '<div class="gear-card-actions">' +
            '<button class="request-quote-btn" data-action="view">View &amp; support</button>' +
            '<button class="request-quote-btn" data-action="share">Share</button>' +
          '</div>' +
        '</div>';
      card.querySelector('[data-action="view"]').addEventListener('click', function(){
        window.location.href = 'funding.html?id=' + c.id;
      });
      card.querySelector('[data-action="share"]').addEventListener('click', function(){ shareCampaign(c); });
      grid.appendChild(card);
    });
  }

  function initBrowse(){
    if (!document.getElementById('funding-grid')) return;
    if (!configured()){ renderGrid(); return; }
    window.mmSupabase.from('funding_campaigns').select('*').eq('status', 'active').order('created_at', { ascending: false })
      .then(function(res){
        allCampaigns = res.data || [];
        return loadProfilesByIds(allCampaigns.map(function(c){ return c.user_id; }));
      })
      .then(function(map){
        profilesById = map;
        renderFilterTabs();
        renderGrid();
      })
      .catch(function(){ renderGrid(); });
  }

  function applyLiveUpdate(row){
    // Browse-grid card, if present
    var card = document.querySelector('.campaign-card[data-campaign-id="' + row.id + '"]');
    if (card){
      var raisedEl = card.querySelector('[data-role="raised"]');
      if (raisedEl) raisedEl.textContent = money(row.raised_amount);
      var fillEl = card.querySelector('[data-role="fill"]');
      if (fillEl) fillEl.style.width = Math.min(100, Math.round((row.raised_amount / row.goal_amount) * 100)) + '%';
    }
    var cached = allCampaigns.filter(function(c){ return c.id === row.id; })[0];
    if (cached) cached.raised_amount = row.raised_amount;

    // Single-campaign view, if this is the one being viewed
    if (currentSingleCampaign && currentSingleCampaign.id === row.id){
      currentSingleCampaign.raised_amount = row.raised_amount;
      renderSingleProgress(currentSingleCampaign);
    }
  }

  if (configured()){
    window.mmSupabase
      .channel('funding-campaigns-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'funding_campaigns' }, function(payload){
        applyLiveUpdate(payload.new);
      })
      .subscribe();
  }

  // ===== start a campaign =====
  function openStartModal(){
    document.getElementById('funding-start-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(document.getElementById('funding-start-modal'));
  }
  function closeStartModal(){
    document.getElementById('funding-start-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  var startBtn = document.getElementById('funding-start-btn');
  if (startBtn){
    startBtn.addEventListener('click', function(){
      if (!configured() || !currentUser()){
        if (window.openSignup) window.openSignup();
        return;
      }
      openStartModal();
    });
  }
  var startCloseBtn = document.getElementById('funding-start-close-btn');
  if (startCloseBtn){
    startCloseBtn.addEventListener('click', closeStartModal);
    document.getElementById('funding-start-modal').addEventListener('click', function(e){
      if (e.target.id === 'funding-start-modal') closeStartModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && document.getElementById('funding-start-modal').classList.contains('open')) closeStartModal();
    });

    var categorySelect = document.getElementById('funding-category');
    var itemLabelField = document.getElementById('funding-item-label-field');
    var titleInput = document.getElementById('funding-title');
    function syncCategoryFields(){
      var cat = categorySelect.value;
      itemLabelField.style.display = cat === 'gear' ? 'block' : 'none';
      titleInput.placeholder = catMeta(cat).heading;
    }
    categorySelect.addEventListener('change', syncCategoryFields);
    syncCategoryFields();

    document.getElementById('funding-start-save-btn').addEventListener('click', function(){
      var user = currentUser();
      if (!user) return;
      var category = categorySelect.value;
      var itemLabel = document.getElementById('funding-item-label').value.trim();
      var title = titleInput.value.trim() || catMeta(category).heading;
      var story = document.getElementById('funding-story').value.trim();
      var goal = parseFloat(document.getElementById('funding-goal').value);
      var statusEl = document.getElementById('funding-start-status');
      var saveBtn = document.getElementById('funding-start-save-btn');

      if (isNaN(goal) || goal <= 0){
        statusEl.textContent = 'Enter a goal amount greater than 0.';
        return;
      }

      saveBtn.disabled = true;
      statusEl.textContent = 'Starting your campaign…';
      window.mmSupabase.from('funding_campaigns').insert({
        user_id: user.id,
        category: category,
        item_label: category === 'gear' ? itemLabel : '',
        title: title,
        story: story,
        goal_amount: goal
      }).select().single().then(function(res){
        saveBtn.disabled = false;
        if (res.error){
          statusEl.textContent = res.error.message;
          return;
        }
        statusEl.textContent = '';
        closeStartModal();
        document.getElementById('funding-category').value = 'gear';
        document.getElementById('funding-item-label').value = '';
        titleInput.value = '';
        document.getElementById('funding-story').value = '';
        document.getElementById('funding-goal').value = '';
        syncCategoryFields();
        window.location.href = 'funding.html?id=' + res.data.id;
      });
    });
  }

  // ===== support / pledge modal =====
  var supportTarget = null;

  function openSupportModal(campaign){
    if (!configured() || !currentUser()){
      if (window.openSignup) window.openSignup();
      return;
    }
    supportTarget = campaign;
    document.getElementById('funding-support-title').textContent = 'Support ' + (campaign.title || catMeta(campaign.category).heading);
    document.getElementById('funding-support-amount').value = '';
    var user = currentUser();
    var ownProfile = profilesById[user.id];
    document.getElementById('funding-support-name').value = (ownProfile && ownProfile.name) || '';
    document.getElementById('funding-support-message').value = '';
    document.getElementById('funding-support-status').textContent = '';
    var modal = document.getElementById('funding-support-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  }
  function closeSupportModal(){
    var modal = document.getElementById('funding-support-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  var supportCloseBtn = document.getElementById('funding-support-close-btn');
  if (supportCloseBtn){
    supportCloseBtn.addEventListener('click', closeSupportModal);
    document.getElementById('funding-support-modal').addEventListener('click', function(e){
      if (e.target.id === 'funding-support-modal') closeSupportModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && document.getElementById('funding-support-modal').classList.contains('open')) closeSupportModal();
    });

    document.getElementById('funding-support-save-btn').addEventListener('click', function(){
      if (!supportTarget) return;
      var user = currentUser();
      var amount = parseFloat(document.getElementById('funding-support-amount').value);
      var name = document.getElementById('funding-support-name').value.trim() || 'Someone';
      var message = document.getElementById('funding-support-message').value.trim();
      var statusEl = document.getElementById('funding-support-status');
      var saveBtn = document.getElementById('funding-support-save-btn');

      if (isNaN(amount) || amount <= 0){
        statusEl.textContent = 'Enter an amount greater than 0.';
        return;
      }

      saveBtn.disabled = true;
      statusEl.textContent = 'Recording your pledge…';
      window.mmSupabase.from('campaign_donations').insert({
        campaign_id: supportTarget.id,
        donor_user_id: user.id,
        donor_name: name,
        amount: amount,
        message: message
      }).then(function(res){
        saveBtn.disabled = false;
        if (res.error){
          statusEl.textContent = res.error.message;
          return;
        }
        statusEl.textContent = '';
        closeSupportModal();
        var pledgedCampaign = supportTarget;
        // Re-fetch rather than adding `amount` to the value already in
        // memory — the realtime UPDATE from the server-side trigger can
        // arrive before this insert's own .then() runs (it's the same
        // trigger, just delivered over a separate websocket), and adding
        // on top of an already-current value would double-count. A
        // re-fetch is idempotent no matter which order these resolve in,
        // and still works if realtime isn't connected at all.
        window.mmSupabase.from('funding_campaigns').select('raised_amount').eq('id', pledgedCampaign.id).single().then(function(freshRes){
          if (!freshRes.error && freshRes.data){
            pledgedCampaign.raised_amount = freshRes.data.raised_amount;
            applyLiveUpdate(pledgedCampaign);
          }
        });
        if (currentSingleCampaign && currentSingleCampaign.id === pledgedCampaign.id) loadSupporters(pledgedCampaign.id);
        if (window.showToast) window.showToast('Thanks for your support!');
      });
    });
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest('#funding-single-support-btn');
    if (btn && currentSingleCampaign) openSupportModal(currentSingleCampaign);
  });

  // ===== single-campaign view (?id=) =====
  var currentSingleCampaign = null;

  function renderSingleProgress(campaign){
    var pct = progressPct(campaign);
    document.getElementById('funding-single-raised').textContent = money(campaign.raised_amount);
    document.getElementById('funding-single-goal').textContent = 'of ' + money(campaign.goal_amount) + ' goal';
    document.getElementById('funding-single-fill').style.width = pct + '%';
    document.getElementById('funding-single-pct').textContent = pct + '% funded';
  }

  function loadSupporters(campaignId){
    window.mmSupabase.from('campaign_donations').select('donor_name,amount,message,created_at').eq('campaign_id', campaignId)
      .order('created_at', { ascending: false }).limit(20)
      .then(function(res){
        var rows = res.data || [];
        var box = document.getElementById('funding-single-supporters-box');
        var list = document.getElementById('funding-single-supporters-list');
        if (!rows.length){ box.style.display = 'none'; return; }
        box.style.display = 'block';
        list.innerHTML = rows.map(function(r){
          return '<div class="campaign-supporter-item">' +
            '<div><div>' + escapeHtml(r.donor_name) + '</div>' +
            (r.message ? '<div class="campaign-supporter-message">' + escapeHtml(r.message) + '</div>' : '') + '</div>' +
            '<span class="campaign-supporter-amount">' + escapeHtml(money(r.amount)) + '</span>' +
          '</div>';
        }).join('');
      })
      .catch(function(){});
  }

  function renderSingleNotFound(){
    document.getElementById('funding-single-loading').style.display = 'none';
    document.getElementById('funding-single-notfound').style.display = 'block';
  }

  function renderSingleCampaign(campaign, owner){
    document.getElementById('funding-single-loading').style.display = 'none';
    document.getElementById('funding-single-body').style.display = 'block';
    currentSingleCampaign = campaign;

    var meta = catMeta(campaign.category);
    document.title = (campaign.title || meta.heading) + ' — Music Motel';
    document.getElementById('funding-single-tag').textContent = '/ ' + meta.label;
    document.getElementById('funding-single-tag').style.color = meta.color;
    document.getElementById('funding-single-title').textContent = campaign.title || meta.heading;
    document.getElementById('funding-single-item-label').textContent = campaign.item_label || '';
    document.getElementById('funding-single-story').textContent = campaign.story || '';

    document.getElementById('funding-single-owner-name').textContent = owner ? owner.name : 'Someone on Music Motel';
    document.getElementById('funding-single-owner-role').textContent = owner ? (owner.role_label || owner.account_type || '') : '';
    if (window.mmRenderAvatar) window.mmRenderAvatar(document.getElementById('funding-single-owner-avatar'), owner && owner.avatar_url, owner && owner.avatar_color, owner && owner.name);

    renderSingleProgress(campaign);
    loadSupporters(campaign.id);

    var shareBtn = document.getElementById('funding-single-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', function(){ shareCampaign(campaign); });
  }

  function initSingleView(campaignId){
    var browseView = document.getElementById('funding-browse-view');
    var singleView = document.getElementById('funding-single-view');
    if (browseView) browseView.style.display = 'none';
    if (singleView) singleView.style.display = '';

    if (!configured()){ renderSingleNotFound(); return; }
    window.mmSupabase.from('funding_campaigns').select('*').eq('id', campaignId).maybeSingle()
      .then(function(res){
        if (res.error || !res.data){ renderSingleNotFound(); return; }
        var campaign = res.data;
        var user = currentUser();
        var ids = user ? [campaign.user_id, user.id] : [campaign.user_id];
        return loadProfilesByIds(ids).then(function(map){
          // Merged into the shared map (not reassigned) so openSupportModal's
          // own-name prefill also works when pledging from this view — the
          // browse-grid flow is the only other place that populates it.
          Object.keys(map).forEach(function(id){ profilesById[id] = map[id]; });
          renderSingleCampaign(campaign, map[campaign.user_id]);
        });
      })
      .catch(function(){ renderSingleNotFound(); });
  }

  authReady.then(function(){
    // Both this file's own ?id= (a campaign) and js/share-profile.js's ?id=
    // (a profile) are loaded together on profile.html — gated on funding.html's
    // own container elements so this only ever runs on funding.html, where
    // that query param actually means "which campaign."
    if (!document.getElementById('funding-browse-view') && !document.getElementById('funding-single-view')) return;
    var campaignId = new URLSearchParams(window.location.search).get('id');
    if (campaignId){
      initSingleView(campaignId);
    } else {
      initBrowse();
    }
  });

  // ===== "Your campaigns" card (profile.html fan dashboard) =====
  var myCampaignsEmptyEl = document.getElementById('my-campaigns-empty');

  function renderMyCampaigns(campaigns){
    var list = document.getElementById('my-campaigns-list');
    if (!list) return;
    if (!campaigns.length){
      list.innerHTML = '';
      list.appendChild(myCampaignsEmptyEl);
      return;
    }
    list.innerHTML = '';
    campaigns.forEach(function(c){
      var meta = catMeta(c.category);
      var pct = progressPct(c);
      var item = document.createElement('div');
      item.className = 'gig-log-item';
      item.innerHTML =
        '<span class="gig-log-dot" style="background:' + meta.color + ';"></span>' +
        '<div style="flex:1;">' +
          '<h5><a href="funding.html?id=' + c.id + '" style="color:inherit;">' + escapeHtml(c.title || meta.heading) + '</a></h5>' +
          '<p>' + escapeHtml(money(c.raised_amount)) + ' of ' + escapeHtml(money(c.goal_amount)) + ' — ' + pct + '% funded</p>' +
        '</div>' +
        '<button class="gig-log-remove" aria-label="Share this campaign">Share</button>';
      item.querySelector('.gig-log-remove').addEventListener('click', function(){ shareCampaign(c); });
      list.appendChild(item);
    });
  }

  function initMyCampaigns(){
    if (!document.getElementById('my-campaigns-list') || !configured()) return;
    authReady.then(function(){
      var user = currentUser();
      if (!user) return;
      window.mmSupabase.from('funding_campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(function(res){ renderMyCampaigns(res.data || []); })
        .catch(function(){});
    });
  }
  initMyCampaigns();
})();
