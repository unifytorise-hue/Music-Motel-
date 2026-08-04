(function(){
  var escapeHtml = window.mmEscapeHtml;

  var configured = window.mmConfigured;
  var currentUser = window.mmCurrentUser;
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  var PRICING_LABEL = { hour: '/hour', gig: '/gig (flat rate)', set_45min: '/45-min set' };
  var PRICING_SHORT = { hour: '/hr', gig: '/gig', set_45min: '/45-min set' };

  function money(usd){ return window.mmFormatMoney ? window.mmFormatMoney(usd) : '$' + Number(usd).toFixed(2); }

  // Shared with js/booking-requests.js: the directory card and the quote
  // request modal both need a one-line "$X/gig" summary.
  window.formatRateCardShort = function(card){
    if (!card || card.rate_amount == null) return null;
    return money(card.rate_amount) + (PRICING_SHORT[card.pricing_basis] || '');
  };

  // Shared with js/booking-requests.js: renders the same itemized-estimate
  // box both in "My Rate" (the artist's own preview) and inline in the
  // quote-request modal (what a client sees the instant they open it) —
  // one visual language for "here's my standard estimate, apart from
  // travel" everywhere it appears.
  window.renderRateCardBox = function(card, opts){
    opts = opts || {};
    if (!card || card.rate_amount == null){
      return '<div class="rate-card-note">' + escapeHtml(opts.emptyText || 'No standard rate published yet — ask for a custom quote.') + '</div>';
    }
    var rows = [
      '<div class="fee-row"><span>Estimate</span><span class="fee-row-total">' + money(card.rate_amount) + (PRICING_LABEL[card.pricing_basis] || '') + '</span></div>',
      '<div class="fee-row"><span>Travel</span><span>' + escapeHtml(card.travel_note || 'Ask for a travel estimate') + '</span></div>',
      '<div class="fee-row"><span>Accommodation</span><span>' + (card.accommodation_required ? 'Required for travel gigs' : 'Not required') + '</span></div>',
      '<div class="fee-row"><span>Food &amp; drink</span><span>' + (card.food_drink_required ? 'Required (hospitality rider)' : 'Not required') + '</span></div>',
      '<div class="fee-row"><span>Sound / equipment</span><span>' + (card.has_own_equipment ? 'Artist brings own gear' : (escapeHtml(card.equipment_note) || 'Price excludes gear')) + '</span></div>'
    ];
    return '<div class="fee-breakdown">' + rows.join('') + '</div>';
  };

  if (!document.getElementById('my-rate')) return;

  var myRateCard = null;

  function loadMyRateCard(){
    if (!currentUser()) return Promise.resolve(null);
    return window.mmSupabase.from('artist_rate_cards').select('*').eq('user_id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }

  function fillForm(card){
    document.getElementById('rate-basis').value = card.pricing_basis || 'gig';
    document.getElementById('rate-card-amount').value = card.rate_amount != null ? card.rate_amount : '';
    document.getElementById('rate-travel-note').value = card.travel_note || '';
    document.getElementById('rate-accommodation').checked = !!card.accommodation_required;
    document.getElementById('rate-food-drink').checked = !!card.food_drink_required;
    var ownEquipment = card.has_own_equipment !== false;
    document.getElementById('rate-own-equipment').checked = ownEquipment;
    document.getElementById('rate-equipment-note').value = card.equipment_note || '';
    document.getElementById('rate-equipment-note-field').style.display = ownEquipment ? 'none' : 'block';
  }

  function renderGate(){
    var signedOutEl = document.getElementById('rate-card-signed-out');
    var termsEl = document.getElementById('rate-card-terms');
    var formEl = document.getElementById('rate-card-form');
    var previewEl = document.getElementById('rate-card-preview');

    if (!isSignedIn()){
      signedOutEl.style.display = 'block';
      termsEl.style.display = 'none';
      formEl.style.display = 'none';
      previewEl.style.display = 'none';
      return;
    }
    signedOutEl.style.display = 'none';

    var agreed = !!(myRateCard && myRateCard.booking_agent_terms_accepted_at);
    termsEl.style.display = agreed ? 'none' : 'block';
    formEl.style.display = agreed ? 'block' : 'none';
    previewEl.style.display = agreed ? 'block' : 'none';

    if (agreed){
      fillForm(myRateCard);
      document.getElementById('rate-preview-box').innerHTML =
        window.renderRateCardBox(myRateCard, { emptyText: 'Save your rate below to see how clients will see it.' });
    }
  }

  function initRateCard(){
    var section = document.getElementById('my-rate');
    if (!isSignedIn()){
      if (section) section.style.display = 'block';
      renderGate();
      return;
    }
    (window.mmMyAccountType ? window.mmMyAccountType() : Promise.resolve(null)).then(function(accountType){
      // A fan has no service to sell — the whole "set your rate / become a
      // booking agent client" flow doesn't apply, so the section hides
      // entirely rather than just showing an empty gate.
      if (accountType === 'fan'){
        if (section) section.style.display = 'none';
        return;
      }
      if (section) section.style.display = 'block';
      loadMyRateCard().then(function(card){
        myRateCard = card;
        renderGate();
      });
    });
  }

  // ===== booking-agent tick-list terms =====
  var checkboxes = document.querySelectorAll('.terms-checkbox');
  var agreeBtn = document.getElementById('terms-agree-btn');
  function updateAgreeBtn(){
    var allChecked = true;
    checkboxes.forEach(function(cb){ if (!cb.checked) allChecked = false; });
    agreeBtn.disabled = !allChecked;
  }
  checkboxes.forEach(function(cb){ cb.addEventListener('change', updateAgreeBtn); });

  agreeBtn.addEventListener('click', function(){
    if (!currentUser()) return;
    var statusEl = document.getElementById('terms-status');
    agreeBtn.disabled = true;
    statusEl.textContent = 'Saving…';
    window.mmSupabase.from('artist_rate_cards').upsert({
      user_id: currentUser().id,
      booking_agent_terms_accepted_at: new Date().toISOString()
    }).select().single().then(function(res){
      statusEl.textContent = '';
      if (res.error){
        statusEl.textContent = res.error.message;
        agreeBtn.disabled = false;
        return;
      }
      myRateCard = res.data;
      renderGate();
    });
  });

  // ===== rate card form =====
  var ownEquipmentCb = document.getElementById('rate-own-equipment');
  ownEquipmentCb.addEventListener('change', function(){
    document.getElementById('rate-equipment-note-field').style.display = ownEquipmentCb.checked ? 'none' : 'block';
  });

  document.getElementById('rate-card-save-btn').addEventListener('click', function(){
    if (!currentUser()) return;
    var amount = parseFloat(document.getElementById('rate-card-amount').value);
    var statusEl = document.getElementById('rate-card-status');
    if (isNaN(amount) || amount <= 0){
      statusEl.textContent = 'Enter an estimate greater than 0.';
      return;
    }
    var saveBtn = document.getElementById('rate-card-save-btn');
    var payload = {
      user_id: currentUser().id,
      pricing_basis: document.getElementById('rate-basis').value,
      rate_amount: amount,
      travel_note: document.getElementById('rate-travel-note').value.trim(),
      accommodation_required: document.getElementById('rate-accommodation').checked,
      food_drink_required: document.getElementById('rate-food-drink').checked,
      has_own_equipment: document.getElementById('rate-own-equipment').checked,
      equipment_note: document.getElementById('rate-equipment-note').value.trim()
    };
    statusEl.textContent = 'Saving…';
    saveBtn.disabled = true;
    window.mmSupabase.from('artist_rate_cards').upsert(payload).select().single().then(function(res){
      saveBtn.disabled = false;
      if (res.error){
        statusEl.textContent = res.error.message;
        return;
      }
      statusEl.textContent = 'Saved — this is now what clients see.';
      myRateCard = res.data;
      renderGate();
      if (window.refreshRealArtistDirectory) window.refreshRealArtistDirectory();
    });
  });

  authReady.then(initRateCard);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ initRateCard(); });
  }
})();
