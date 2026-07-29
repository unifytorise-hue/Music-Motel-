(function(){
  // ===== booking flow =====
  var FEE_RATE = 0.10;
  var currentBookingArtist = null;

  function openBookingModal(){
    document.getElementById('booking-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(document.getElementById('booking-modal'));
  }
  function closeBookingModal(){
    document.getElementById('booking-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }

  function escapeHtmlBooking(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  window.openBooking = function(artist){
    currentBookingArtist = artist;
    document.getElementById('booking-modal-title').textContent = 'Book ' + artist.name.split(' ')[0];
    document.getElementById('booking-artist-row').innerHTML =
      '<div class="booking-artist-avatar" style="background:linear-gradient(135deg, ' + artist.color + ', var(--yellow));"></div>' +
      '<div class="booking-artist-meta"><h5>' + escapeHtmlBooking(artist.name) + '</h5><p>' + escapeHtmlBooking(artist.role) + ' · ' + escapeHtmlBooking(artist.loc) + '</p></div>';

    // reset to form step
    document.getElementById('booking-step-form').style.display = 'block';
    document.getElementById('booking-step-status').style.display = 'none';
    document.getElementById('booking-date').value = '';
    document.getElementById('booking-details').value = '';
    document.getElementById('booking-amount').value = '';
    updateFeeBreakdown(0);

    openBookingModal();
  };

  // The client pays exactly their offer — Music Motel's 10% comes out of
  // the artist's side, same model stated everywhere else on the site
  // (pricing footnote, booking-honesty notes, the tick-list terms). It
  // never gets added on top of what the client pays.
  function updateFeeBreakdown(amount){
    var offer = isNaN(amount) ? 0 : amount;
    var fee = offer * FEE_RATE;
    var payout = offer - fee;
    document.getElementById('fee-offer').textContent = '$' + offer.toFixed(2);
    document.getElementById('fee-platform').textContent = '-$' + fee.toFixed(2);
    document.getElementById('fee-payout').textContent = '$' + payout.toFixed(2);
  }

  document.getElementById('booking-amount').addEventListener('input', function(e){
    var val = parseFloat(e.target.value);
    updateFeeBreakdown(val);
  });

  document.getElementById('booking-close-btn').addEventListener('click', closeBookingModal);
  document.getElementById('booking-modal').addEventListener('click', function(e){
    if (e.target.id === 'booking-modal') closeBookingModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('booking-modal').classList.contains('open')) closeBookingModal();
  });

  document.getElementById('booking-submit-btn').addEventListener('click', function(){
    var date = document.getElementById('booking-date').value.trim();
    var details = document.getElementById('booking-details').value.trim();
    var amount = parseFloat(document.getElementById('booking-amount').value);

    if (!date || !details || isNaN(amount) || amount <= 0){
      alert('Add a date, a short description of the gig, and an offer amount before sending the request.');
      return;
    }

    showBookingStatus(currentBookingArtist, date, details, amount);
  });

  function showBookingStatus(artist, date, details, amount){
    document.getElementById('booking-step-form').style.display = 'none';
    document.getElementById('booking-step-status').style.display = 'block';

    var steps = [
      { key:'requested', label:'Requested', done:true },
      { key:'pending', label:'Awaiting confirm', active:true },
      { key:'confirmed', label:'Confirmed', done:false },
      { key:'paid', label:'Paid out', done:false }
    ];
    var track = document.getElementById('booking-status-track');
    track.innerHTML = steps.map(function(s){
      var cls = s.done ? 'done' : (s.active ? 'active' : '');
      var icon = s.done ? '✓' : (s.active ? '•' : '');
      return '<div class="booking-status-step ' + cls + '">' +
        '<div class="booking-status-dot">' + icon + '</div>' +
        '<div class="booking-status-label">' + s.label + '</div>' +
      '</div>';
    }).join('');

    var fee = amount * FEE_RATE;
    var payout = amount - fee;

    document.getElementById('booking-status-detail').innerHTML =
      '<strong>Request sent to ' + escapeHtmlBooking(artist.name) + '.</strong><br><br>' +
      escapeHtmlBooking(date) + ' — ' + escapeHtmlBooking(details) + '<br><br>' +
      'Total held: <strong>$' + amount.toFixed(2) + '</strong> (artist receives $' + payout.toFixed(2) + ' once the gig is confirmed complete by both sides)<br><br>' +
      '<span style="color:var(--cream-dim); font-size:12px;">This is the booking-flow UI — no real payment is captured here yet. Connecting Stripe Connect (or similar) would let this actually hold and release funds at this exact step.</span>';
  }

  document.getElementById('booking-close-status-btn').addEventListener('click', closeBookingModal);
})();
