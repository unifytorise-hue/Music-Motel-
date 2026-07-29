(function(){
  var configured = !!window.mmSupabaseConfigured;
  var client = window.mmSupabase;
  var currentUser = null;
  var currentProfileName = null; // profiles.name — shown in the nav instead of the raw email
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
    // Full-page redirect to Google, then back to this same URL with a
    // session already established — Supabase's JS client picks the token
    // up from the redirect URL automatically (detectSessionInUrl is on by
    // default), which is what fires onAuthStateChange/getSession() below.
    signInWithGoogle: function(){
      if (!configured) return Promise.reject(new Error('Backend not configured yet.'));
      return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    },
    signOut: function(){
      if (!configured) return Promise.resolve();
      return client.auth.signOut();
    },
    // Emails a link back to redirectTo (this same origin); clicking it
    // signs the visitor in with a short-lived recovery session and fires
    // onAuthStateChange with event "PASSWORD_RECOVERY" below, which is
    // what actually opens the "set a new password" modal.
    requestPasswordReset: function(email){
      if (!configured) return Promise.reject(new Error('Backend not configured yet.'));
      return client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    },
    // Only meaningful during that recovery session — updateUser() applies
    // to whoever the current session belongs to.
    updatePassword: function(newPassword){
      if (!configured) return Promise.reject(new Error('Backend not configured yet.'));
      return client.auth.updateUser({ password: newPassword });
    }
  };

  // Google sign-in skips the multi-step signup form entirely (no
  // account_type/location/etc. ever gets collected), so a user can land
  // back here signed in with zero rows in public.profiles. Detected once
  // per sign-in transition and handled by prompting the same signup form,
  // just without the now-irrelevant email/password fields — see
  // window.openProfileCompletion in js/signup-location.js. Also picks up
  // profiles.name for the nav display while it's already fetching the row.
  function refreshOwnProfile(user){
    if (!user || !configured) return;
    client.from('profiles').select('id,name').eq('id', user.id).maybeSingle().then(function(res){
      if (res.error) return;
      if (!res.data){
        if (window.openProfileCompletion) window.openProfileCompletion(user);
        return;
      }
      currentProfileName = res.data.name || null;
      renderAuthUI();
    }).catch(function(){});
  }
  // Called once a freshly-created (or just-completed) profile row exists,
  // so the nav shows the real name immediately instead of waiting for
  // another sign-in transition.
  window.mmAuth.refreshOwnProfile = function(){ refreshOwnProfile(currentUser); };

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
    var signupHero = document.getElementById('open-signup-hero');
    var signupFinal = document.getElementById('open-signup-final');

    // Hidden while completing a profile after Google sign-in — that user
    // is already authenticated, so email/password fields (and a second
    // "Continue with Google" button) make no sense.
    if (authFields) authFields.style.display = window.__mmCompletingProfile ? 'none' : '';
    var googleSignup = document.getElementById('google-auth-section-signup');
    var googleSignin = document.getElementById('google-auth-section-signin');
    if (googleSignup) googleSignup.style.display = window.__mmCompletingProfile ? 'none' : '';
    if (googleSignin) googleSignin.style.display = '';

    var signedIn = !!currentUser;
    var displayName = (currentProfileName || (currentUser && currentUser.email) || '');
    if (signinNav) signinNav.style.display = signedIn ? 'none' : '';
    if (signupNav) signupNav.style.display = signedIn ? 'none' : '';
    // Two more "Create your profile" CTAs live further down the page (hero,
    // bottom cta-section) — pointless to show someone who already has a
    // profile, same reasoning as hiding the nav version above.
    if (signupHero) signupHero.style.display = signedIn ? 'none' : '';
    if (signupFinal) signupFinal.style.display = signedIn ? 'none' : '';
    if (accountEl) accountEl.style.display = signedIn ? 'flex' : 'none';
    if (accountEmail) accountEmail.textContent = signedIn ? displayName : '';
    if (signinMobile) signinMobile.style.display = signedIn ? 'none' : '';
    if (signupMobile) signupMobile.style.display = signedIn ? 'none' : '';
    if (accountMobile) accountMobile.style.display = signedIn ? 'block' : 'none';
    if (accountMobileEmail) accountMobileEmail.textContent = signedIn ? displayName : '';
  }

  function setCurrentUser(user){
    var wasSignedOut = !currentUser;
    currentUser = user || null;
    if (!currentUser) currentProfileName = null;
    renderAuthUI();
    if (currentUser && wasSignedOut) refreshOwnProfile(currentUser);
  }

  // Guards against opening the "set a new password" modal twice — both
  // call sites below (the initial getSession() and onAuthStateChange) can
  // independently decide this is a recovery landing.
  var recoveryModalTriggered = false;
  function maybeTriggerRecoveryModal(event, session){
    if (!session || recoveryModalTriggered) return;
    // event === 'PASSWORD_RECOVERY' is the documented signal, but Supabase's
    // JS client is known to sometimes fire a plain SIGNED_IN/INITIAL_SESSION
    // instead when landing from a recovery link (supabase-js#836, supabase
    // discussion #18059) — window.__mmUrlIsPasswordRecovery (set by the
    // inline script at the very top of <head>, before this client could
    // touch the URL) is the reliable fallback signal.
    if (event !== 'PASSWORD_RECOVERY' && !window.__mmUrlIsPasswordRecovery) return;
    recoveryModalTriggered = true;
    // js/auth.js loads near the top of the page, js/password-reset.js
    // (which defines this) near the bottom — Supabase's redirect-driven
    // session detection can resolve before the rest of the page has
    // finished loading, so window.openSetNewPassword may not exist yet.
    // Flag it instead of silently dropping the event; password-reset.js
    // checks this flag itself once it's actually ready.
    if (window.openSetNewPassword) window.openSetNewPassword();
    else window.__mmPendingPasswordRecovery = true;
  }

  if (configured){
    client.auth.getSession().then(function(res){
      var session = res.data && res.data.session;
      setCurrentUser(session ? session.user : null);
      // Covers the case where onAuthStateChange's listener (registered
      // just below) subscribed a beat too late to catch the client's own
      // internal initial event — getSession() always reflects the real
      // session regardless of that timing.
      maybeTriggerRecoveryModal('INITIAL_LOAD', session);
      readyResolve();
    }).catch(function(){ readyResolve(); });
    client.auth.onAuthStateChange(function(event, session){
      setCurrentUser(session ? session.user : null);
      maybeTriggerRecoveryModal(event, session);
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

    ['google-signup-btn', 'google-signin-btn'].forEach(function(id){
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function(){
        btn.disabled = true;
        window.mmAuth.signInWithGoogle().catch(function(err){
          btn.disabled = false;
          alert((err && err.message) || 'Could not start Google sign-in.');
        });
      });
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
