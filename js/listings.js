(function(){
  var escapeHtml = window.mmEscapeHtml;
  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();
  function money(amount){ return window.mmFormatMoney ? window.mmFormatMoney(amount) : '$' + Number(amount).toFixed(2); }

  if (!document.getElementById('listings-card')) return;

  var TYPE_LABELS = { lesson: 'Lesson', workshop: 'Workshop', space: 'Bookable space' };
  window.mmListingTypeLabel = function(type){ return TYPE_LABELS[type] || type; };
  var PRICE_BASIS_SUFFIX = { hour: '/hour', session: '/session', day: '/day', flat: ' flat rate' };
  window.mmListingPriceText = function(l){
    if (l.price_amount == null) return null;
    return money(l.price_amount) + (PRICE_BASIS_SUFFIX[l.price_basis] || '');
  };

  var listingsEmptyEl = document.getElementById('listings-empty');
  var myListings = [];

  function loadMine(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('listings').select('*').eq('user_id', currentUser().id).order('created_at', { ascending: false })
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderMine(){
    var list = document.getElementById('listings-list');
    list.innerHTML = '';
    if (!myListings.length){
      list.appendChild(listingsEmptyEl);
      return;
    }
    myListings.forEach(function(l){
      var priceText = window.mmListingPriceText(l);
      var detailBits = [TYPE_LABELS[l.listing_type]];
      if (priceText) detailBits.push(priceText);
      if (!l.active) detailBits.push('Hidden from your public profile');
      var item = document.createElement('div');
      item.className = 'gig-log-item';
      item.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(l.title) + '</h5><p>' + escapeHtml(detailBits.join(' · ')) + '</p></div>' +
        '<button class="request-action-btn toggle-btn" type="button">' + (l.active ? 'Hide' : 'Show') + '</button>' +
        '<button class="gig-log-remove" aria-label="Remove">✕</button>';
      item.querySelector('.toggle-btn').addEventListener('click', function(){
        // Capture the intended new value up front rather than re-negating
        // l.active inside the callback — the mock test harness (and this
        // matters just as much against real Supabase's returned row)
        // shares the same object reference, so re-reading l.active after
        // the update already landed would flip it back to where it started.
        var newActive = !l.active;
        window.mmSupabase.from('listings').update({ active: newActive }).eq('id', l.id).then(function(res){
          if (res.error) return;
          l.active = newActive;
          renderMine();
        });
      });
      item.querySelector('.gig-log-remove').addEventListener('click', function(){
        if (!confirm('Remove this listing?')) return;
        window.mmSupabase.from('listings').delete().eq('id', l.id).then(function(){
          myListings = myListings.filter(function(x){ return x.id !== l.id; });
          renderMine();
        });
      });
      list.appendChild(item);
    });
  }

  function init(){
    var card = document.getElementById('listings-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    // Same gate as rates-card/credits-card — a fan has nothing to list.
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      if (accountType === 'fan'){
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      loadMine().then(function(rows){
        myListings = rows;
        renderMine();
      });
    });
  }

  function updateFieldVisibility(){
    var type = document.getElementById('listing-type-select').value;
    document.getElementById('listing-format-field').style.display = type === 'space' ? 'none' : 'block';
    document.getElementById('listing-capacity-field').style.display = type === 'space' ? 'block' : 'none';
  }
  document.getElementById('listing-type-select').addEventListener('change', updateFieldVisibility);
  updateFieldVisibility();

  document.getElementById('listing-add-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    var type = document.getElementById('listing-type-select').value;
    var title = document.getElementById('listing-title-input').value.trim();
    var description = document.getElementById('listing-description-input').value.trim();
    var priceRaw = document.getElementById('listing-price-input').value;
    var price = priceRaw ? parseFloat(priceRaw) : null;
    var priceBasis = document.getElementById('listing-price-basis-select').value;
    var format = type === 'space' ? null : document.getElementById('listing-format-select').value;
    var capacityRaw = document.getElementById('listing-capacity-input').value;
    var capacity = (type === 'space' && capacityRaw) ? parseInt(capacityRaw, 10) : null;
    var location = document.getElementById('listing-location-input').value.trim();
    var statusEl = document.getElementById('listing-add-status');

    if (!title){ statusEl.textContent = 'Add a title first.'; return; }
    statusEl.textContent = 'Saving…';
    window.mmSupabase.from('listings').insert({
      user_id: user.id,
      listing_type: type,
      title: title,
      description: description,
      price_amount: price,
      price_basis: priceBasis,
      format: format,
      capacity: capacity,
      location_label: location,
      active: true
    }).select().then(function(res){
      if (res.error){ statusEl.textContent = res.error.message; return; }
      statusEl.textContent = 'Added!';
      document.getElementById('listing-title-input').value = '';
      document.getElementById('listing-description-input').value = '';
      document.getElementById('listing-price-input').value = '';
      document.getElementById('listing-location-input').value = '';
      document.getElementById('listing-capacity-input').value = '';
      myListings.unshift((res.data && res.data[0]) || { id: 'tmp-' + Date.now(), listing_type: type, title: title, price_amount: price, price_basis: priceBasis, active: true });
      renderMine();
    });
  });

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
