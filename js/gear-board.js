(function(){
  // Shared storage module defined once, near the top of the file (see the
  // script block right after the focus-trap utility).
  var storageGet = window.siteStorage.get;
  var storageSet = window.siteStorage.set;

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  var SEED_GEAR = [
    { id:'g1', name:'Yamaha FG800 Acoustic Guitar', category:'Guitar', condition:'Good — light fret wear, new strings', loc:'Austin, US', claimed:false },
    { id:'g2', name:'Roland TD-1DMK Electronic Drum Kit', category:'Drums', condition:'Very good — barely used, all pads working', loc:'London, UK', claimed:false },
    { id:'g3', name:'Shure SM58 Microphone', category:'Microphone', condition:'Excellent — industry standard, well maintained', loc:'Lagos, NG', claimed:false },
    { id:'g4', name:'Fender Rumble 25 Bass Amp', category:'Amp', condition:'Good — small cosmetic scuff, sounds great', loc:'Midrand, ZA', claimed:false },
    { id:'g5', name:'Korg Volca Keys Synth', category:'Keyboard', condition:'Like new — barely powered on', loc:'Berlin, DE', claimed:false },
    { id:'g6', name:'Behringer Xenyx Mixer (8-channel)', category:'Studio Gear', condition:'Fair — fully functional, some knob wear', loc:'Mumbai, IN', claimed:false }
  ];

  var GEAR_KEY = 'gear-listings';
  var GEAR_CLAIMS_KEY = 'gear-claims';
  var activeGearFilter = 'all';
  var gearItems = [];
  var claimedIds = {};       // local-only claims: seed items + items added while unconfigured
  var remoteClaimedIds = {}; // real gear_claims rows, keyed by gear_listings.id

  var configured = !!window.mmSupabaseConfigured;

  function isSignedIn(){
    return !!(configured && window.mmAuth && window.mmAuth.getUser());
  }

  function loadGearLocal(){
    return storageGet(GEAR_KEY).then(function(val){
      return val ? JSON.parse(val) : SEED_GEAR.slice();
    }).catch(function(){ return SEED_GEAR.slice(); });
  }
  function saveGear(items){
    return storageSet(GEAR_KEY, JSON.stringify(items));
  }
  function loadClaims(){
    return storageGet(GEAR_CLAIMS_KEY).then(function(val){
      return val ? JSON.parse(val) : {};
    }).catch(function(){ return {}; });
  }
  function saveClaims(map){
    return storageSet(GEAR_CLAIMS_KEY, JSON.stringify(map));
  }

  // Real listings live in gear_listings (publicly readable regardless of
  // sign-in state) and sit alongside the hardcoded SEED_GEAR samples. Claims
  // on those real rows go in gear_claims — a separate table, since seed
  // items have no row in gear_listings for a claim to foreign-key against.
  function loadGear(){
    if (!configured) return loadGearLocal();
    return window.mmSupabase.from('gear_listings').select('*').order('created_at', { ascending: true })
      .then(function(res){
        var remoteItems = (res.data || []).map(function(row){
          return { id: row.id, name: row.name, category: row.category, condition: row.condition, loc: row.location_label, remote: true };
        });
        return SEED_GEAR.concat(remoteItems);
      })
      .catch(function(){ return SEED_GEAR.slice(); });
  }
  function loadRemoteClaims(){
    if (!configured) return Promise.resolve({});
    return window.mmSupabase.from('gear_claims').select('gear_id').then(function(res){
      var map = {};
      (res.data || []).forEach(function(row){ map[row.gear_id] = true; });
      return map;
    }).catch(function(){ return {}; });
  }

  function renderGearTabs(){
    var cats = ['all'].concat(Array.from(new Set(gearItems.map(function(g){ return g.category; }))));
    var tabsEl = document.getElementById('gear-filter-tabs');
    tabsEl.innerHTML = '';
    cats.forEach(function(cat){
      var btn = document.createElement('button');
      btn.className = 'gear-filter-tab' + (cat === activeGearFilter ? ' active' : '');
      btn.textContent = cat === 'all' ? 'All' : cat;
      btn.addEventListener('click', function(){
        activeGearFilter = cat;
        renderGearTabs();
        renderGearGrid();
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderGearGrid(){
    var grid = document.getElementById('gear-grid');
    var visible = gearItems.filter(function(g){ return activeGearFilter === 'all' || g.category === activeGearFilter; });
    if (visible.length === 0){
      grid.innerHTML = '<div class="gear-empty">No items in this category yet.</div>';
      return;
    }
    grid.innerHTML = '';
    visible.forEach(function(g){
      var isClaimed = g.remote ? !!remoteClaimedIds[g.id] : !!claimedIds[g.id];
      var card = document.createElement('div');
      card.className = 'gear-card';
      card.innerHTML =
        '<div class="gear-card-cat">' + escapeHtml(g.category) + '</div>' +
        '<h4>' + escapeHtml(g.name) + '</h4>' +
        '<p class="gear-card-condition">' + escapeHtml(g.condition) + '</p>' +
        '<div class="gear-card-foot">' +
          '<span class="gear-card-loc"><span class="pindot"></span>' + escapeHtml(g.loc) + '</span>' +
          '<button class="gear-claim-btn' + (isClaimed ? ' claimed' : '') + '">' + (isClaimed ? '✓ Claimed' : 'Claim item') + '</button>' +
        '</div>';
      card.querySelector('.gear-claim-btn').addEventListener('click', function(){
        if (isClaimed) return;

        if (g.remote){
          if (!isSignedIn()){
            if (window.openSignin) window.openSignin();
            return;
          }
          window.mmSupabase.from('gear_claims').insert({
            gear_id: g.id,
            claimed_by: window.mmAuth.getUser().id
          }).then(function(res){
            if (res.error) return;
            remoteClaimedIds[g.id] = true;
            renderGearGrid();
            if (window.refreshRealXP) window.refreshRealXP();
          });
          return;
        }

        var confirmed = confirm(
          'Claim "' + g.name + '"?\n\n' +
          'This is free — no fee, ever. You\'ll need to collect it yourself; items aren\'t shipped. Kids get preference if more than one person wants the same item.'
        );
        if (!confirmed) return;
        claimedIds[g.id] = true;
        saveClaims(claimedIds);
        renderGearGrid();
      });
      grid.appendChild(card);
    });
  }

  Promise.all([loadGear(), loadClaims(), loadRemoteClaims()]).then(function(results){
    gearItems = results[0];
    claimedIds = results[1];
    remoteClaimedIds = results[2];
    renderGearTabs();
    renderGearGrid();
  });

  // ===== list an item =====
  function openGearList(){
    document.getElementById('gear-list-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(document.getElementById('gear-list-modal'));
  }
  function closeGearList(){
    document.getElementById('gear-list-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  document.getElementById('gear-list-btn').addEventListener('click', function(){
    if (configured && !isSignedIn()){
      if (window.openSignin) window.openSignin();
      return;
    }
    openGearList();
  });
  document.getElementById('gear-list-close-btn').addEventListener('click', closeGearList);
  document.getElementById('gear-list-modal').addEventListener('click', function(e){
    if (e.target.id === 'gear-list-modal') closeGearList();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('gear-list-modal').classList.contains('open')) closeGearList();
  });
  document.getElementById('gear-list-save-btn').addEventListener('click', function(){
    var name = document.getElementById('gear-item-name').value.trim();
    var category = document.getElementById('gear-item-category').value.trim() || 'Other';
    var condition = document.getElementById('gear-item-condition').value.trim() || 'Condition not specified';
    var loc = document.getElementById('gear-item-loc').value.trim() || 'Location not specified';
    var statusEl = document.getElementById('gear-list-status');
    var saveBtn = document.getElementById('gear-list-save-btn');
    if (!name){
      document.getElementById('gear-item-name').focus();
      return;
    }

    function resetForm(){
      document.getElementById('gear-item-name').value = '';
      document.getElementById('gear-item-category').value = '';
      document.getElementById('gear-item-condition').value = '';
      document.getElementById('gear-item-loc').value = '';
      if (statusEl) statusEl.textContent = '';
      closeGearList();
    }

    if (configured && isSignedIn()){
      saveBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Listing…';
      window.mmSupabase.from('gear_listings').insert({
        user_id: window.mmAuth.getUser().id,
        name: name, category: category, condition: condition, location_label: loc
      }).select().single().then(function(res){
        saveBtn.disabled = false;
        if (res.error){
          if (statusEl) statusEl.textContent = res.error.message;
          return;
        }
        gearItems.push({ id: res.data.id, name: res.data.name, category: res.data.category, condition: res.data.condition, loc: res.data.location_label, remote: true });
        renderGearTabs();
        renderGearGrid();
        resetForm();
      });
    } else {
      var newItem = { id:'g-' + Date.now(), name:name, category:category, condition:condition, loc:loc };
      gearItems.push(newItem);
      saveGear(gearItems);
      renderGearTabs();
      renderGearGrid();
      resetForm();
    }
  });
})();
