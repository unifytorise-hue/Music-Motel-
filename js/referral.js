(function(){
  // Referral-code generation, the shareable invite link, and incoming-
  // referral detection — split out of js/hero-game.js so it works on every
  // page, not just index.html (the "Invite & earn XP" card lives on
  // profile.html now). js/hero-game.js still owns syncReferralCodeForUser/
  // recordReferralIfAny/getReferralCount/addXP, which are only ever
  // triggered from the index.html-only signup flow.
  var storageGet = window.siteStorage.get;
  var storageSet = window.siteStorage.set;

  var REFERRAL_CODE_KEY = 'referral-code';
  var REFERRED_BY_KEY = 'referred-by-code';

  function generateCode(){
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
    var code = '';
    for (var i=0;i<6;i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }
  window.mmGenerateReferralCode = generateCode;

  function getOrCreateReferralCodeLocal(){
    return storageGet(REFERRAL_CODE_KEY).then(function(existing){
      if (existing) return existing;
      var fresh = generateCode();
      return storageSet(REFERRAL_CODE_KEY, fresh).then(function(){ return fresh; });
    });
  }

  // Signed-in users get a code that lives in referral_codes, so a referrer
  // on a different browser/device can actually be credited (the local-only
  // version above can't cross browsers, which is what referral_codes
  // exists to fix). Signed-out visitors keep the local-only preview code.
  function getOrCreateReferralCodeRemote(userId){
    return window.mmSupabase.from('referral_codes').select('code').eq('user_id', userId).maybeSingle()
      .then(function(res){
        if (res.data && res.data.code) return res.data.code;
        var fresh = generateCode();
        return window.mmSupabase.from('referral_codes').insert({ user_id: userId, code: fresh }).then(function(insertRes){
          if (insertRes.error) return getOrCreateReferralCodeLocal();
          return fresh;
        });
      })
      .catch(function(){ return getOrCreateReferralCodeLocal(); });
  }

  function getOrCreateReferralCode(){
    var authReady = window.mmAuthReady || Promise.resolve();
    return authReady.then(function(){
      var user = window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser();
      if (window.mmSupabaseConfigured && user) return getOrCreateReferralCodeRemote(user.id);
      return getOrCreateReferralCodeLocal();
    });
  }

  function referralLinkFor(code){
    var url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('ref', code);
    return url.toString();
  }

  // Detect if this visitor arrived via someone else's invite link.
  // We only ever record the *first* referrer we see for this browser.
  (function checkIncomingReferral(){
    var params = new URLSearchParams(window.location.search);
    var incomingCode = params.get('ref');
    if (!incomingCode) return;
    storageGet(REFERRED_BY_KEY).then(function(alreadyReferred){
      if (alreadyReferred) return; // don't overwrite an existing referral attribution
      storageSet(REFERRED_BY_KEY, incomingCode);
    });
  })();

  var myReferralCode = null;
  window.getReferralLink = function(){
    return myReferralCode ? referralLinkFor(myReferralCode) : null;
  };
  window.getReferralCode = function(){ return myReferralCode; };
  window.markReferralConversion = function(){
    return storageGet(REFERRED_BY_KEY);
  };
  // Called by js/hero-game.js's syncReferralCodeForUser once a fresh
  // signup's local preview code becomes a real referral_codes row, so the
  // displayed invite link picks up the synced code immediately.
  window.mmSetReferralCode = function(code){
    myReferralCode = code;
    var input = document.getElementById('invite-link-input');
    if (input) input.value = window.getReferralLink();
  };

  getOrCreateReferralCode().then(function(code){
    window.mmSetReferralCode(code);
  });
})();
