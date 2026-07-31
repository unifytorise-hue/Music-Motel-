(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  if (!document.getElementById('verification-card')) return;

  function randomDigits(len){
    var out = '';
    for (var i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
    return out;
  }
  function randomAlnumCode(len){
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  var myProfile = null;
  var myPlatformLinks = [];
  var myCreditsCount = 0;
  var myCompletedBookingCount = 0;
  var myHasPositiveReview = false;
  var pendingPhoneCode = null;

  function loadSignals(){
    var uid = currentUser().id;
    return Promise.all([
      window.mmSupabase.from('profiles').select('phone,phone_verified_at,id_verified_at,id_verification_confidence,id_verification_session_id,id_verification_provider,pro_membership_org,pro_membership_number,touring_level').eq('id', uid).maybeSingle(),
      window.mmSupabase.from('profile_platform_links').select('*').eq('user_id', uid),
      window.mmSupabase.from('profile_credits').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      window.mmSupabase.from('booking_requests').select('id').eq('artist_id', uid).eq('status', 'completed'),
      window.mmSupabase.from('booking_reviews').select('rating').eq('reviewee_id', uid)
    ]).then(function(results){
      myProfile = (results[0].error || !results[0].data) ? {} : results[0].data;
      myPlatformLinks = results[1].data || [];
      myCreditsCount = (results[2].data || []).length || results[2].count || 0;
      myCompletedBookingCount = (results[3].data || []).length;
      myHasPositiveReview = (results[4].data || []).some(function(r){ return r.rating >= 4; });
    }).catch(function(){});
  }

  function renderTierList(){
    var signals = {
      hasVerifiedPlatformLink: myPlatformLinks.some(function(l){ return l.verified_at; }),
      hasCreditsOrTouring: myCreditsCount > 0 || !!myProfile.touring_level || !!myProfile.pro_membership_number,
      completedBookingCount: myCompletedBookingCount,
      hasPositiveReview: myHasPositiveReview
    };
    var tiers = window.mmVerificationTiers ? window.mmVerificationTiers(myProfile, signals) : [];
    document.getElementById('verification-tier-list').innerHTML = tiers.map(function(t){
      return '<span class="verification-tier-pill' + (t.done ? ' earned' : '') + '" title="' + escapeHtml(t.desc) + '">' +
        '<span class="tier-dot"></span>' + escapeHtml(t.label) + '</span>';
    }).join('');
  }

  function renderPhoneSection(){
    document.getElementById('verify-phone-input').value = myProfile.phone || '';
    var isVerified = !!myProfile.phone_verified_at;
    document.getElementById('verify-phone-status').textContent = isVerified ? 'Verified.' : '';
  }

  function renderPlatformList(){
    var list = document.getElementById('verify-platform-list');
    if (!myPlatformLinks.length){ list.innerHTML = ''; return; }
    list.innerHTML = myPlatformLinks.map(function(l){
      var label = window.mmMediaPlatformLabel ? window.mmMediaPlatformLabel(l.platform) : l.platform;
      var statusText = l.verified_at ? 'Verified' : 'Code: ' + l.verification_code;
      return '<div class="gig-log-item"><span class="gig-log-dot"></span><div style="flex:1;"><h5>' + escapeHtml(label) + '</h5><p>' + escapeHtml(statusText) + '</p></div></div>';
    }).join('');
  }

  function renderProSection(){
    document.getElementById('verify-pro-org-input').value = myProfile.pro_membership_org || '';
    document.getElementById('verify-pro-number-input').value = myProfile.pro_membership_number || '';
  }

  function renderIdSection(){
    var statusEl = document.getElementById('verify-id-status-text');
    var detailEl = document.getElementById('verify-id-detail-text');
    var startBtn = document.getElementById('verify-id-start-btn');
    var deleteBtn = document.getElementById('verify-id-delete-btn');
    if (myProfile.id_verified_at){
      var confidencePct = myProfile.id_verification_confidence != null ? (myProfile.id_verification_confidence * 100).toFixed(1) + '%' : 'n/a';
      statusEl.textContent = 'Verified — confidence ' + confidencePct + '.';
      detailEl.style.display = 'block';
      detailEl.textContent = 'Provider: ' + (myProfile.id_verification_provider || 'n/a') + ' · Session: ' + (myProfile.id_verification_session_id || 'n/a');
      startBtn.textContent = 'Re-verify';
      deleteBtn.style.display = 'inline-block';
    } else {
      statusEl.textContent = 'Not verified yet.';
      detailEl.style.display = 'none';
      startBtn.textContent = 'Start free ID + Liveness check';
      deleteBtn.style.display = 'none';
    }
  }

  function renderAll(){
    renderTierList();
    renderPhoneSection();
    renderPlatformList();
    renderProSection();
    renderIdSection();
  }

  function init(){
    var card = document.getElementById('verification-card');
    if (!isSignedIn()){
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    loadSignals().then(renderAll);
  }
  // Called by js/id-liveness.js once a (simulated) verification finishes,
  // so the dashboard reflects it immediately without a full page reload.
  window.mmRefreshVerification = function(){ loadSignals().then(renderAll); };

  // ===== phone (simulated OTP — no SMS provider is connected in this
  // preview, so the "sent" code is shown directly rather than pretending
  // an SMS went out) =====
  document.getElementById('verify-phone-send-btn').addEventListener('click', function(){
    var phone = document.getElementById('verify-phone-input').value.trim();
    var statusEl = document.getElementById('verify-phone-status');
    if (!phone){ statusEl.textContent = 'Enter a phone number first.'; return; }
    pendingPhoneCode = randomDigits(6);
    document.getElementById('verify-phone-code-field').style.display = 'block';
    document.getElementById('verify-phone-confirm-btn').style.display = 'inline-block';
    statusEl.textContent = 'No SMS provider is connected in this preview — your code is ' + pendingPhoneCode + '.';
  });
  document.getElementById('verify-phone-confirm-btn').addEventListener('click', function(){
    var user = currentUser();
    var entered = document.getElementById('verify-phone-code-input').value.trim();
    var statusEl = document.getElementById('verify-phone-status');
    if (!pendingPhoneCode || entered !== pendingPhoneCode){
      statusEl.textContent = "That code doesn't match — try sending a new one.";
      return;
    }
    var phone = document.getElementById('verify-phone-input').value.trim();
    window.mmSupabase.from('profiles').update({ phone: phone, phone_verified_at: new Date().toISOString() }).eq('id', user.id).then(function(res){
      if (res.error){ statusEl.textContent = res.error.message; return; }
      statusEl.textContent = 'Verified!';
      pendingPhoneCode = null;
      loadSignals().then(renderAll);
    });
  });

  // ===== platform link (self-attested — the "verify" step is simulated,
  // not a real fetch of the external page, since that would need a
  // server-side check this static site doesn't have) =====
  document.getElementById('verify-platform-generate-btn').addEventListener('click', function(){
    var user = currentUser();
    var platform = document.getElementById('verify-platform-select').value;
    var url = document.getElementById('verify-platform-url-input').value.trim();
    var statusEl = document.getElementById('verify-platform-status');
    if (!url){ statusEl.textContent = 'Paste your profile URL first.'; return; }
    var code = 'MM-' + randomAlnumCode(6);
    window.mmSupabase.from('profile_platform_links').upsert({
      user_id: user.id, platform: platform, url: url, verification_code: code, verified_at: null
    }, { onConflict: 'user_id,platform' }).select().then(function(res){
      if (res.error){ statusEl.textContent = res.error.message; return; }
      document.getElementById('verify-platform-code-box').style.display = 'block';
      document.getElementById('verify-platform-code-text').textContent = code;
      statusEl.textContent = '';
      loadSignals().then(renderAll);
    });
  });
  document.getElementById('verify-platform-confirm-btn').addEventListener('click', function(){
    var user = currentUser();
    var platform = document.getElementById('verify-platform-select').value;
    var statusEl = document.getElementById('verify-platform-status');
    window.mmSupabase.from('profile_platform_links').update({ verified_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('platform', platform).then(function(res){
        if (res.error){ statusEl.textContent = res.error.message; return; }
        statusEl.textContent = 'Verified!';
        document.getElementById('verify-platform-code-box').style.display = 'none';
        loadSignals().then(renderAll);
      });
  });

  // ===== PRO membership (manual entry — self-reported, same trust model
  // as the Fundraising Policy checkboxes elsewhere on the site) =====
  document.getElementById('verify-pro-save-btn').addEventListener('click', function(){
    var user = currentUser();
    var org = document.getElementById('verify-pro-org-input').value.trim();
    var number = document.getElementById('verify-pro-number-input').value.trim();
    var statusEl = document.getElementById('verify-pro-status');
    window.mmSupabase.from('profiles').update({ pro_membership_org: org || null, pro_membership_number: number || null }).eq('id', user.id).then(function(res){
      statusEl.textContent = res.error ? res.error.message : 'Saved!';
      loadSignals().then(renderAll);
    });
  });

  // ===== ID + liveness =====
  document.getElementById('verify-id-start-btn').addEventListener('click', function(){
    if (window.mmOpenIdLiveness) window.mmOpenIdLiveness();
  });

  // Deletion right (POPIA/GDPR/CPRA access-and-deletion rights, and BIPA's
  // destruction requirement) — clears the verification result AND the
  // consent record itself, a full reset back to "not verified, no record
  // on file" rather than a soft delete.
  document.getElementById('verify-id-delete-btn').addEventListener('click', function(){
    if (!confirm('Delete your ID verification data? This removes your ID Verified badge and the record of this check.')) return;
    var user = currentUser();
    var statusEl = document.getElementById('verify-id-status-text');
    window.mmSupabase.from('profiles').update({
      id_verified_at: null,
      id_verification_confidence: null,
      id_verification_session_id: null,
      id_verification_provider: null,
      id_verification_consent_at: null
    }).eq('id', user.id).then(function(res){
      if (res.error){ statusEl.textContent = res.error.message; return; }
      loadSignals().then(renderAll);
    });
  });

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
