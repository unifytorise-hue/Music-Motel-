(function(){
  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  var authReady = window.mmAuthReady || Promise.resolve();
  function money(usd){ return window.mmFormatMoney ? window.mmFormatMoney(usd) : '$' + Number(usd).toFixed(2); }

  // Captured once, before any render ever clears these lists via
  // innerHTML — each placeholder is a child of the list it describes, so
  // re-querying by id after the first non-empty render would return null
  // (see the same bug already fixed in js/invite-gig-follow.js).
  var ratesEmptyEl = document.getElementById('rates-empty');
  var incomingEmptyEl = document.getElementById('incoming-requests-empty');
  var sentEmptyEl = document.getElementById('sent-requests-empty');

  // ===== real artist directory =====
  function loadRealArtists(){
    return window.mmSupabase.from('profiles').select('id,name,role_label,location_label,account_type,instruments,profile_kind,avatar_url,avatar_color')
      .then(function(res){
        if (res.error || !res.data) return [];
        return res.data.filter(function(p){ return p.account_type !== 'fan'; });
      })
      .catch(function(){ return []; });
  }

  function loadRateCards(){
    return window.mmSupabase.from('artist_rate_cards')
      .select('user_id,pricing_basis,rate_amount,travel_note,accommodation_required,food_drink_required,has_own_equipment,equipment_note,booking_agent_terms_accepted_at')
      .then(function(res){
        var map = {};
        (res.data || []).forEach(function(row){
          // Only treat a card as "published" once the artist has agreed to
          // the booking-agent terms and actually set an amount — a bare
          // row can exist the moment someone ticks the terms checklist,
          // before they've filled in a real rate.
          if (row.booking_agent_terms_accepted_at && row.rate_amount != null) map[row.user_id] = row;
        });
        return map;
      })
      .catch(function(){ return {}; });
  }

  function loadReviewSummaries(){
    return window.mmSupabase.from('booking_reviews').select('reviewee_id,rating')
      .then(function(res){
        var summaries = {};
        (res.data || []).forEach(function(r){
          var s = summaries[r.reviewee_id] || (summaries[r.reviewee_id] = { total: 0, count: 0 });
          s.total += r.rating;
          s.count += 1;
        });
        return summaries;
      })
      .catch(function(){ return {}; });
  }

  function reviewSummaryText(summary){
    if (!summary || !summary.count) return 'No reviews yet';
    var avg = summary.total / summary.count;
    return '★ ' + avg.toFixed(1) + ' (' + summary.count + (summary.count === 1 ? ' review' : ' reviews') + ')';
  }

  function renderRealArtists(artists, reviewSummaries, rateCards){
    var section = document.getElementById('real-artists');
    var grid = document.getElementById('real-artist-grid');
    var empty = document.getElementById('real-artist-empty');
    if (!section || !grid) return;
    section.style.display = '';
    if (!artists.length){
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = '';
    artists.forEach(function(p){
      var isBand = p.profile_kind === 'band';
      var instrumentsText = (p.instruments && p.instruments.length) ? 'Plays: ' + p.instruments.join(', ') : '';
      var rateShort = window.formatRateCardShort ? window.formatRateCardShort(rateCards[p.id]) : null;
      var card = document.createElement('div');
      card.className = 'gear-card';
      card.innerHTML =
        '<div class="real-artist-card-head">' +
          '<div>' +
            '<div class="gear-card-cat">' + escapeHtml(window.mmAccountTypeLabel ? window.mmAccountTypeLabel(p.account_type) : p.account_type) + (isBand ? ' · BAND' : '') + '</div>' +
            '<h4>' + escapeHtml(p.name) + '</h4>' +
          '</div>' +
          '<span class="real-artist-avatar"></span>' +
        '</div>' +
        '<p class="gear-card-condition">' + escapeHtml(p.role_label || 'No role listed yet') + '</p>' +
        (instrumentsText ? '<p class="gear-card-condition">' + escapeHtml(instrumentsText) + '</p>' : '') +
        (rateShort ? '<p class="gear-card-condition">From ' + escapeHtml(rateShort) + ', apart from travel</p>' : '') +
        '<p class="gear-card-condition">' + escapeHtml(reviewSummaryText(reviewSummaries[p.id])) + '</p>' +
        '<div class="gear-card-foot">' +
          '<span class="gear-card-loc"><span class="pindot"></span>' + escapeHtml(p.location_label || 'Location not set') + '</span>' +
          '<div class="gear-card-actions">' +
            (isBand ? '<button class="request-quote-btn unify-band-btn">Unify</button>' : '') +
            '<button class="request-quote-btn">Request a quote</button>' +
          '</div>' +
        '</div>';
      card.querySelector('.gear-card-actions .request-quote-btn:not(.unify-band-btn)').addEventListener('click', function(){
        openQuoteRequest(p);
      });
      var unifyBtn = card.querySelector('.unify-band-btn');
      if (unifyBtn) unifyBtn.addEventListener('click', function(){
        if (window.requestJoinBand) window.requestJoinBand(p);
      });
      if (window.mmRenderAvatar) window.mmRenderAvatar(card.querySelector('.real-artist-avatar'), p.avatar_url, p.avatar_color, p.name);
      grid.appendChild(card);
    });
  }

  function initRealArtists(){
    if (!configured()) return;
    Promise.all([loadRealArtists(), loadReviewSummaries(), loadRateCards()]).then(function(results){
      renderRealArtists(results[0], results[1], results[2]);
    });
  }
  // Called by js/rate-card.js after a save, so a fresh rate shows up in
  // the directory without waiting for the next page load.
  window.refreshRealArtistDirectory = initRealArtists;

  // ===== quote request modal (client -> artist) =====
  var quoteTargetArtist = null;

  window.openQuoteRequest = function(artist){
    if (!currentUser()){
      if (window.openSignup) window.openSignup();
      return;
    }
    quoteTargetArtist = artist;
    document.getElementById('quote-modal-title').textContent = 'Request ' + artist.name.split(' ')[0];
    document.getElementById('quote-intro').textContent =
      'Are you available for a gig on your date, ' + artist.name.split(' ')[0] + ', and what’s your estimate apart from travel?';
    document.getElementById('quote-date').value = '';
    document.getElementById('quote-time').value = '';
    document.getElementById('quote-location').value = '';
    document.getElementById('quote-details').value = '';
    document.getElementById('quote-budget').value = '';
    document.getElementById('quote-status').textContent = '';

    var previewEl = document.getElementById('quote-rate-preview');
    previewEl.style.display = 'none';
    if (configured()){
      window.mmSupabase.from('artist_rate_cards').select('*').eq('user_id', artist.id).maybeSingle().then(function(res){
        if (quoteTargetArtist !== artist) return; // modal moved on to a different artist
        var card = (res.error || !res.data) ? null : res.data;
        if (card && card.rate_amount != null && card.booking_agent_terms_accepted_at){
          previewEl.innerHTML = '<div class="rate-card-note" style="margin-bottom:8px;">' + escapeHtml(artist.name.split(' ')[0]) + '’s standing estimate:</div>' +
            window.renderRateCardBox(card);
          previewEl.style.display = 'block';
        }
      }).catch(function(){});
    }

    var modal = document.getElementById('quote-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  };

  function closeQuoteModal(){
    var modal = document.getElementById('quote-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  document.getElementById('quote-close-btn').addEventListener('click', closeQuoteModal);
  document.getElementById('quote-modal').addEventListener('click', function(e){
    if (e.target.id === 'quote-modal') closeQuoteModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('quote-modal').classList.contains('open')) closeQuoteModal();
  });

  document.getElementById('quote-submit-btn').addEventListener('click', function(){
    var eventType = document.getElementById('quote-event-type').value;
    var date = document.getElementById('quote-date').value.trim();
    var time = document.getElementById('quote-time').value.trim();
    var location = document.getElementById('quote-location').value.trim();
    var details = document.getElementById('quote-details').value.trim();
    var budgetRaw = document.getElementById('quote-budget').value.trim();
    var budget = budgetRaw ? parseFloat(budgetRaw) : null;
    var statusEl = document.getElementById('quote-status');
    var btn = document.getElementById('quote-submit-btn');

    if (!date || !details){
      statusEl.textContent = 'Add a date and a short description of the gig.';
      return;
    }
    if (budgetRaw && (isNaN(budget) || budget <= 0)){
      statusEl.textContent = 'Budget should be a number greater than 0, or leave it blank.';
      return;
    }
    if (!quoteTargetArtist) return;

    btn.disabled = true;
    statusEl.textContent = 'Sending…';
    window.mmSupabase.from('booking_requests').insert({
      client_id: currentUser().id,
      artist_id: quoteTargetArtist.id,
      event_type: eventType,
      event_date: date,
      event_time: time,
      location_label: location,
      details: details,
      budget_amount: budget
    }).select().single().then(function(res){
      btn.disabled = false;
      if (res.error){
        statusEl.textContent = res.error.message;
        return;
      }
      statusEl.textContent = '';
      closeQuoteModal();
      refreshRequests();
    });
  });

  // ===== artist rates (quick-reply price presets) =====
  var myRates = [];

  function loadMyRates(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('artist_rates').select('*').eq('user_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function renderRates(){
    var card = document.getElementById('rates-card');
    var list = document.getElementById('rates-list');
    var empty = ratesEmptyEl;
    if (!card) return;
    card.style.display = 'block';
    if (!myRates.length){
      list.innerHTML = '';
      list.appendChild(empty);
      return;
    }
    list.innerHTML = '';
    myRates.forEach(function(r){
      var item = document.createElement('div');
      item.className = 'gig-log-item';
      item.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + money(r.amount) + '</h5><p>' + escapeHtml(r.label) + '</p></div>' +
        '<button class="gig-log-remove" aria-label="Remove">✕</button>';
      item.querySelector('.gig-log-remove').addEventListener('click', function(){
        window.mmSupabase.from('artist_rates').delete().eq('id', r.id).then(function(){
          myRates = myRates.filter(function(x){ return x.id !== r.id; });
          renderRates();
        });
      });
      list.appendChild(item);
    });
  }

  function initRates(){
    if (!(configured() && currentUser())) return;
    loadMyRates().then(function(rates){
      myRates = rates;
      renderRates();
    });
  }

  // The rates-card ("Your rates" quick-reply presets) only exists in the
  // fan dashboard, which lives on profile.html only — guarded so this file
  // can still load on index.html (for the real-artist directory / quote
  // request flow above, which IS needed there) without crashing.
  if (document.getElementById('rates-add-btn')){
    document.getElementById('rates-add-btn').addEventListener('click', function(){
      document.getElementById('rate-label').value = '';
      document.getElementById('rate-amount').value = '';
      document.getElementById('rate-status').textContent = '';
      var modal = document.getElementById('add-rate-modal');
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (window.trapFocus) window.trapFocus(modal);
    });
    var closeAddRate = function(){
      var modal = document.getElementById('add-rate-modal');
      modal.classList.remove('open');
      document.body.style.overflow = '';
      if (window.releaseFocusTrap) window.releaseFocusTrap();
    };
    document.getElementById('add-rate-close-btn').addEventListener('click', closeAddRate);
    document.getElementById('add-rate-modal').addEventListener('click', function(e){
      if (e.target.id === 'add-rate-modal') closeAddRate();
    });
    document.getElementById('rate-save-btn').addEventListener('click', function(){
      var label = document.getElementById('rate-label').value.trim();
      var amount = parseFloat(document.getElementById('rate-amount').value);
      var statusEl = document.getElementById('rate-status');
      if (!label || isNaN(amount) || amount <= 0){
        statusEl.textContent = 'Add a label and a price greater than 0.';
        return;
      }
      window.mmSupabase.from('artist_rates').insert({
        user_id: currentUser().id, label: label, amount: amount
      }).select().single().then(function(res){
        if (res.error){
          statusEl.textContent = res.error.message;
          return;
        }
        myRates.push(res.data);
        renderRates();
        closeAddRate();
      });
    });
  }

  // ===== booking requests: incoming (artist) + sent (client) =====
  var incomingRequests = [];
  var sentRequests = [];
  var reviewedBookingIds = {};

  function loadMyReviewedBookingIds(){
    if (!currentUser()) return Promise.resolve({});
    return window.mmSupabase.from('booking_reviews').select('booking_request_id').eq('reviewer_id', currentUser().id)
      .then(function(res){
        var map = {};
        (res.data || []).forEach(function(row){ map[row.booking_request_id] = true; });
        return map;
      })
      .catch(function(){ return {}; });
  }

  function loadIncomingRequests(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('booking_requests').select('*').eq('artist_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }
  function loadSentRequests(){
    if (!currentUser()) return Promise.resolve([]);
    return window.mmSupabase.from('booking_requests').select('*').eq('client_id', currentUser().id).order('created_at')
      .then(function(res){ return res.data || []; })
      .catch(function(){ return []; });
  }

  function statusLabel(status){
    return { requested:'Requested', quoted:'Quoted', accepted:'Accepted', declined:'Declined', completed:'Completed', cancelled:'Cancelled' }[status] || status;
  }

  function eventWhen(r){
    var parts = [];
    if (r.event_date) parts.push(r.event_date);
    if (r.event_time) parts.push(r.event_time);
    return parts.join(' at ');
  }

  // The same request row is an "estimate" once quoted, a "formal proforma
  // invoice" the moment the client accepts it, and an "invoice" once the
  // gig is completed — same numbers throughout, just relabeled at each
  // step of the funnel.
  // The client pays exactly the quoted amount — the platform fee comes out
  // of the artist's side (matches the pricing footnote, the booking-
  // honesty notes on both modals, and the tick-list terms: "the artist
  // keeps 90%", never "the client pays 110%"). Previously this added the
  // fee on top of what the client pays instead of deducting it from the
  // artist's payout — fixed to match the site's actual, stated policy.
  function renderFeeBreakdown(r){
    if (!r.quote_amount) return '';
    var heading = r.status === 'quoted' ? 'Estimate' : (r.status === 'accepted' ? 'Proforma invoice' : 'Invoice');
    var fee = Number(r.quote_amount) * Number(r.platform_fee_rate);
    var payout = Number(r.quote_amount) - fee;
    return '<div class="fee-breakdown">' +
      '<div class="fee-row"><span>' + heading + ' (client pays)</span><span>' + money(r.quote_amount) + '</span></div>' +
      '<div class="fee-row fee-row-fee"><span>Booking fee (10%, incl. transaction costs)</span><span>-' + money(fee) + '</span></div>' +
      '<div class="fee-row fee-row-payout"><span>Artist receives</span><span>' + money(payout) + '</span></div>' +
    '</div>';
  }

  function renderIncoming(){
    var list = document.getElementById('incoming-requests-list');
    var empty = incomingEmptyEl;
    if (!list) return;
    if (!incomingRequests.length){
      list.innerHTML = '';
      list.appendChild(empty);
      return;
    }
    list.innerHTML = '';
    incomingRequests.forEach(function(r){
      var item = document.createElement('div');
      item.className = 'request-item';
      var actionsHtml = '';
      if (r.status === 'requested'){
        actionsHtml = '<button class="request-action-btn quote-btn">Send quote</button>';
      } else if (r.status === 'accepted'){
        actionsHtml = '<button class="request-action-btn complete-btn">Mark complete</button>';
      }
      item.innerHTML =
        '<div class="request-item-meta">' +
          '<h5>' + escapeHtml(r.event_type) + (eventWhen(r) ? ' — ' + escapeHtml(eventWhen(r)) : '') + '</h5>' +
          '<p>' + escapeHtml(r.details) + (r.location_label ? ' · ' + escapeHtml(r.location_label) : '') + '</p>' +
          (r.budget_amount ? '<p>Their budget: ' + money(r.budget_amount) + '</p>' : '') +
          renderFeeBreakdown(r) +
        '</div>' +
        '<div class="request-item-actions">' +
          '<span class="request-status-pill status-' + r.status + '">' + statusLabel(r.status) + '</span>' +
          actionsHtml +
        '</div>';
      var quoteBtn = item.querySelector('.quote-btn');
      if (quoteBtn) quoteBtn.addEventListener('click', function(){ openRespondQuote(r); });
      var completeBtn = item.querySelector('.complete-btn');
      if (completeBtn) completeBtn.addEventListener('click', function(){
        window.mmSupabase.from('booking_requests').update({ status: 'completed' }).eq('id', r.id).then(function(res){
          if (res.error) return;
          r.status = 'completed';
          renderIncoming();
        });
      });
      list.appendChild(item);
    });
  }

  function renderSent(){
    var list = document.getElementById('sent-requests-list');
    var empty = sentEmptyEl;
    if (!list) return;
    if (!sentRequests.length){
      list.innerHTML = '';
      list.appendChild(empty);
      return;
    }
    list.innerHTML = '';
    sentRequests.forEach(function(r){
      var item = document.createElement('div');
      item.className = 'request-item';
      var actionsHtml = '';
      if (r.status === 'quoted' && r.quote_amount){
        actionsHtml = '<button class="request-action-btn accept-btn">Accept</button><button class="request-action-btn decline decline-btn">Decline</button>';
      } else if (r.status === 'completed'){
        actionsHtml = reviewedBookingIds[r.id]
          ? '<span class="request-status-pill status-completed">★ Reviewed</span>'
          : '<button class="request-action-btn review-btn">Leave a review</button>';
      }
      item.innerHTML =
        '<div class="request-item-meta">' +
          '<h5>' + escapeHtml(r.event_type) + (eventWhen(r) ? ' — ' + escapeHtml(eventWhen(r)) : '') + '</h5>' +
          '<p>' + escapeHtml(r.details) + (r.location_label ? ' · ' + escapeHtml(r.location_label) : '') + '</p>' +
          (r.budget_amount ? '<p>Your budget: ' + money(r.budget_amount) + '</p>' : '') +
          renderFeeBreakdown(r) +
        '</div>' +
        '<div class="request-item-actions">' +
          '<span class="request-status-pill status-' + r.status + '">' + statusLabel(r.status) + '</span>' +
          actionsHtml +
        '</div>';
      var acceptBtn = item.querySelector('.accept-btn');
      if (acceptBtn) acceptBtn.addEventListener('click', function(){
        window.mmSupabase.from('booking_requests').update({ status: 'accepted' }).eq('id', r.id).then(function(res){
          if (res.error) return;
          r.status = 'accepted';
          renderSent();
        });
      });
      var declineBtn = item.querySelector('.decline-btn');
      if (declineBtn) declineBtn.addEventListener('click', function(){
        window.mmSupabase.from('booking_requests').update({ status: 'declined' }).eq('id', r.id).then(function(res){
          if (res.error) return;
          r.status = 'declined';
          renderSent();
        });
      });
      var reviewBtn = item.querySelector('.review-btn');
      if (reviewBtn) reviewBtn.addEventListener('click', function(){ openReviewModal(r); });
      list.appendChild(item);
    });
  }

  function refreshRequests(){
    if (!(configured() && currentUser())) return;
    var requestsCard = document.getElementById('requests-card');
    if (requestsCard) requestsCard.style.display = 'block';
    loadIncomingRequests().then(function(rows){ incomingRequests = rows; renderIncoming(); });
    loadSentRequests().then(function(rows){ sentRequests = rows; renderSent(); });
    loadMyReviewedBookingIds().then(function(map){ reviewedBookingIds = map; renderSent(); });
  }

  // ===== respond-to-request (artist sends a quote) =====
  var respondingTo = null;

  function openRespondQuote(request){
    respondingTo = request;
    document.getElementById('respond-quote-title').textContent = 'Quote for ' + request.event_type;
    document.getElementById('respond-quote-detail').innerHTML =
      '<div class="request-item-meta"><h5>' + escapeHtml(request.event_type) +
      (eventWhen(request) ? ' — ' + escapeHtml(eventWhen(request)) : '') + '</h5><p>' +
      escapeHtml(request.details) + (request.location_label ? ' · ' + escapeHtml(request.location_label) : '') +
      '</p>' + (request.budget_amount ? '<p>Their budget: ' + money(request.budget_amount) + '</p>' : '') + '</div>';

    var ratesField = document.getElementById('respond-quote-rates-field');
    var ratesRow = document.getElementById('respond-quote-rates');
    ratesRow.innerHTML = '';

    function addPresetButtons(){
      myRates.forEach(function(r){
        var btn = document.createElement('button');
        btn.className = 'patch-tab';
        btn.textContent = money(r.amount) + ' — ' + r.label;
        btn.addEventListener('click', function(){ submitQuote(r.amount); });
        ratesRow.appendChild(btn);
      });
      ratesField.style.display = ratesRow.children.length ? 'block' : 'none';
    }

    // "Use my standard rate" (from My Rate) sits alongside any named
    // quick-reply presets, so responding to a request never means retyping
    // a price that's already published.
    if (configured() && currentUser()){
      window.mmSupabase.from('artist_rate_cards').select('rate_amount,pricing_basis').eq('user_id', currentUser().id).maybeSingle().then(function(res){
        if (respondingTo !== request) return;
        var card = (res.error || !res.data) ? null : res.data;
        if (card && card.rate_amount != null){
          var btn = document.createElement('button');
          btn.className = 'patch-tab';
          btn.textContent = 'My standard rate — ' + (window.formatRateCardShort ? window.formatRateCardShort(card) : money(card.rate_amount));
          btn.addEventListener('click', function(){ submitQuote(card.rate_amount); });
          ratesRow.insertBefore(btn, ratesRow.firstChild);
        }
        addPresetButtons();
      }).catch(addPresetButtons);
    } else {
      addPresetButtons();
    }

    document.getElementById('respond-quote-amount').value = '';
    document.getElementById('respond-quote-status').textContent = '';
    var modal = document.getElementById('respond-quote-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  }
  function closeRespondQuote(){
    var modal = document.getElementById('respond-quote-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  // respond-quote-modal only exists alongside the requests-card, which is
  // fan-dashboard-only (now profile.html) — guarded so this file can still
  // load on index.html for the real-artist directory above.
  if (document.getElementById('respond-quote-close-btn')){
    document.getElementById('respond-quote-close-btn').addEventListener('click', closeRespondQuote);
    document.getElementById('respond-quote-modal').addEventListener('click', function(e){
      if (e.target.id === 'respond-quote-modal') closeRespondQuote();
    });
  }

  function submitQuote(amount){
    if (!respondingTo) return;
    var statusEl = document.getElementById('respond-quote-status');
    statusEl.textContent = 'Sending…';
    window.mmSupabase.from('booking_requests').update({ status: 'quoted', quote_amount: amount }).eq('id', respondingTo.id)
      .then(function(res){
        if (res.error){
          statusEl.textContent = res.error.message;
          return;
        }
        statusEl.textContent = '';
        closeRespondQuote();
        refreshRequests();
      });
  }

  if (document.getElementById('respond-quote-submit-btn')){
    document.getElementById('respond-quote-submit-btn').addEventListener('click', function(){
      var amount = parseFloat(document.getElementById('respond-quote-amount').value);
      if (isNaN(amount) || amount <= 0){
        document.getElementById('respond-quote-status').textContent = 'Enter a price greater than 0.';
        return;
      }
      submitQuote(amount);
    });
  }

  // ===== leave a review (client, on a completed booking) =====
  var reviewingBooking = null;

  function openReviewModal(booking){
    reviewingBooking = booking;
    document.getElementById('review-rating').value = '5';
    document.getElementById('review-comment').value = '';
    document.getElementById('review-status').textContent = '';
    var modal = document.getElementById('review-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  }
  function closeReviewModal(){
    var modal = document.getElementById('review-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  // review-modal is only reachable from the requests-card's sent-requests
  // list, which is fan-dashboard-only (now profile.html) — guarded so this
  // file can still load on index.html for the real-artist directory above.
  if (document.getElementById('review-close-btn')){
    document.getElementById('review-close-btn').addEventListener('click', closeReviewModal);
    document.getElementById('review-modal').addEventListener('click', function(e){
      if (e.target.id === 'review-modal') closeReviewModal();
    });

    document.getElementById('review-submit-btn').addEventListener('click', function(){
      if (!reviewingBooking) return;
      var rating = parseInt(document.getElementById('review-rating').value, 10);
      var comment = document.getElementById('review-comment').value.trim();
      var statusEl = document.getElementById('review-status');
      statusEl.textContent = 'Submitting…';
      window.mmSupabase.from('booking_reviews').insert({
        booking_request_id: reviewingBooking.id,
        reviewer_id: currentUser().id,
        reviewee_id: reviewingBooking.artist_id,
        rating: rating,
        comment: comment
      }).then(function(res){
        if (res.error){
          statusEl.textContent = res.error.message;
          return;
        }
        statusEl.textContent = '';
        reviewedBookingIds[reviewingBooking.id] = true;
        closeReviewModal();
        renderSent();
        initRealArtists();
      });
    });
  }

  // ===== boot =====
  authReady.then(function(){
    initRealArtists();
    initRates();
    refreshRequests();
  });
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){
      // A new artist may have just signed up since the directory last
      // loaded (authReady only resolves once, at initial page load) —
      // re-check it on every auth change too, not just once.
      initRealArtists();
      initRates();
      refreshRequests();
    });
  }
})();
