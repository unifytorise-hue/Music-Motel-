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
  var claimedIds = {};

  function loadGear(){
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
      var isClaimed = !!claimedIds[g.id];
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
        if (claimedIds[g.id]) return;
        var fee = '5%';
        var confirmed = confirm(
          'Claim "' + g.name + '"?\n\n' +
          'This item is free — Music Motel applies a ' + fee + ' facilitation fee on claimed items to cover payment processing and platform costs.\n\n' +
          '(No real payment happens here yet — this is the claim flow UI, ready to connect to a real payment provider.)'
        );
        if (!confirmed) return;
        claimedIds[g.id] = true;
        saveClaims(claimedIds);
        renderGearGrid();
      });
      grid.appendChild(card);
    });
  }

  Promise.all([loadGear(), loadClaims()]).then(function(results){
    gearItems = results[0];
    claimedIds = results[1];
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
  document.getElementById('gear-list-btn').addEventListener('click', openGearList);
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
    if (!name){
      document.getElementById('gear-item-name').focus();
      return;
    }
    var newItem = { id:'g-' + Date.now(), name:name, category:category, condition:condition, loc:loc, claimed:false };
    gearItems.push(newItem);
    saveGear(gearItems);
    renderGearTabs();
    renderGearGrid();
    document.getElementById('gear-item-name').value = '';
    document.getElementById('gear-item-category').value = '';
    document.getElementById('gear-item-condition').value = '';
    document.getElementById('gear-item-loc').value = '';
    closeGearList();
  });
})();
