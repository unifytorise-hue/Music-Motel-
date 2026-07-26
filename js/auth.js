(function(){
  var configured = !!window.mmSupabaseConfigured;
  var client = window.mmSupabase;
  var currentUser = null;
  var readyResolve;

  // Other modules (gig log, following, referrals) need to know whether a
  // signed-in session exists before deciding to read from Supabase or from
  // local storage. They await this once on load instead of racing the
  // async getSession() call below. This part is safe to run immediately —
  // unlike everything below it, it doesn't touch the DOM — because this
  // script tag loads early (right after storage.js) so later scripts such
  // as hero-game.js can rely on window.mmAuth/mmAuthReady existing.
  window.mmAuthReady = new Promise(function(res){ readyResolve = res; });

  window.mmAuth = {
    isConfigured: function(){ return configured; },
    getUser: function(){ return currentUser; },
    signUp: function(email, password){
      if (!configured) return Promise.reject(new Error('Backend not configured yet.'));
      return client.auth.signUp({ email: email, password: password });
    },
    signIn: function(email, password){
      if (!configured) return Promise.reject(new Error('Backend not configured yet.'));
      return client.auth.signInWithPassword({ email: email, password: password });
    },
    signOut: function(){
      if (!configured) return Promise.resolve();
      return client.auth.signOut();
    }
  };

  function renderAuthUI(){
    if (!configured) return; // leave the original signed-out-only UI untouched

    var signinNav = document.getElementById('open-signin-nav');
    var signupNav = document.getElementById('open-signup-nav');
    var accountEl = document.getElementById('nav-account');
    var accountEmail = document.getElementById('nav-account-email');
    var signinMobile = document.getElementById('open-signin-mobile');
    var signupMobile = document.getElementById('open-signup-mobile');
    var accountMobile = document.getElementById('mobile-account');
    var accountMobileEmail = document.getElementById('mobile-account-email');
    var authFields = document.getElementById('signup-auth-fields');

    if (authFields) authFields.style.display = '';

    var signedIn = !!currentUser;
    if (signinNav) signinNav.style.display = signedIn ? 'none' : '';
    if (signupNav) signupNav.style.display = signedIn ? 'none' : '';
    if (accountEl) accountEl.style.display = signedIn ? 'flex' : 'none';
    if (accountEmail) accountEmail.textContent = signedIn ? (currentUser.email || '') : '';
    if (signinMobile) signinMobile.style.display = signedIn ? 'none' : '';
    if (signupMobile) signupMobile.style.display = signedIn ? 'none' : '';
    if (accountMobile) accountMobile.style.display = signedIn ? 'block' : 'none';
    if (accountMobileEmail) accountMobileEmail.textContent = signedIn ? (currentUser.email || '') : '';
  }

  function setCurrentUser(user){
    currentUser = user || null;
    renderAuthUI();
  }

  if (configured){
    client.auth.getSession().then(function(res){
      setCurrentUser(res.data && res.data.session ? res.data.session.user : null);
      readyResolve();
    }).catch(function(){ readyResolve(); });
    client.auth.onAuthStateChange(function(_event, session){
      setCurrentUser(session ? session.user : null);
    });
  } else {
    readyResolve();
  }

  // ===== DOM-dependent wiring =====
  // Everything below touches elements defined later in the document (the
  // sign-in modal, the signup email/password fields), which don't exist
  // yet at this script's position. Deferring to DOMContentLoaded — rather
  // than relying on this script tag's position relative to those elements
  // — means it keeps working even if the page's markup order changes.
  function wireDomInteractions(){
    function openSignin(){
      var m = document.getElementById('signin-modal');
      if (!m) return;
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (window.trapFocus) window.trapFocus(m);
    }
    function closeSignin(){
      var m = document.getElementById('signin-modal');
      if (!m) return;
      m.classList.remove('open');
      document.body.style.overflow = '';
      if (window.releaseFocusTrap) window.releaseFocusTrap();
    }
    window.openSignin = openSignin;

    ['open-signin-nav', 'open-signin-mobile'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function(e){
        e.preventDefault();
        if (window.closeMobileMenu) window.closeMobileMenu();
        openSignin();
      });
    });
    var signinCloseBtn = document.getElementById('signin-close-btn');
    if (signinCloseBtn) signinCloseBtn.addEventListener('click', closeSignin);
    var signinModal = document.getElementById('signin-modal');
    if (signinModal) signinModal.addEventListener('click', function(e){
      if (e.target.id === 'signin-modal') closeSignin();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && signinModal && signinModal.classList.contains('open')) closeSignin();
    });

    var signinSubmitBtn = document.getElementById('signin-submit-btn');
    if (signinSubmitBtn){
      signinSubmitBtn.addEventListener('click', function(){
        var email = document.getElementById('signin-email').value.trim();
        var password = document.getElementById('signin-password').value;
        var status = document.getElementById('signin-status');
        if (!configured){
          status.textContent = 'Backend not configured yet.';
          return;
        }
        if (!email || !password){
          status.textContent = 'Enter your email and password.';
          return;
        }
        signinSubmitBtn.disabled = true;
        status.textContent = 'Signing in…';
        window.mmAuth.signIn(email, password).then(function(res){
          signinSubmitBtn.disabled = false;
          if (res.error){
            status.textContent = res.error.message;
            return;
          }
          status.textContent = '';
          document.getElementById('signin-email').value = '';
          document.getElementById('signin-password').value = '';
          closeSignin();
          var user = res.data && res.data.user;
          if (user && window.syncReferralCodeForUser) window.syncReferralCodeForUser(user.id);
        }).catch(function(err){
          signinSubmitBtn.disabled = false;
          status.textContent = (err && err.message) || 'Sign in failed.';
        });
      });
    }

    ['nav-signout-btn', 'mobile-signout-btn'].forEach(function(id){
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function(){ window.mmAuth.signOut(); });
    });

    // Re-sync now that every element in the document exists — catches up
    // on any state set by getSession()/onAuthStateChange firing earlier.
    renderAuthUI();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireDomInteractions);
  } else {
    wireDomInteractions();
  }
})();
