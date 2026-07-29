(function(){
  // ===== forgot password (request the reset email) =====
  function openForgotPassword(){
    var modal = document.getElementById('forgot-password-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Carry over whatever the visitor already typed into the sign-in
    // form, so they don't have to type their email twice.
    var signinEmail = document.getElementById('signin-email').value.trim();
    var emailField = document.getElementById('forgot-password-email');
    if (signinEmail) emailField.value = signinEmail;
    document.getElementById('forgot-password-status').textContent = '';
    if (window.trapFocus) window.trapFocus(modal);
  }
  function closeForgotPassword(){
    var modal = document.getElementById('forgot-password-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }

  document.getElementById('open-forgot-password').addEventListener('click', function(){
    // Swap straight from the sign-in modal to this one — no need to make
    // the visitor close one before opening the other.
    var signinModal = document.getElementById('signin-modal');
    if (signinModal.classList.contains('open')){
      signinModal.classList.remove('open');
      document.body.style.overflow = '';
      if (window.releaseFocusTrap) window.releaseFocusTrap();
    }
    openForgotPassword();
  });
  document.getElementById('forgot-password-close-btn').addEventListener('click', closeForgotPassword);
  document.getElementById('forgot-password-modal').addEventListener('click', function(e){
    if (e.target.id === 'forgot-password-modal') closeForgotPassword();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('forgot-password-modal').classList.contains('open')) closeForgotPassword();
  });

  document.getElementById('forgot-password-send-btn').addEventListener('click', function(){
    var email = document.getElementById('forgot-password-email').value.trim();
    var statusEl = document.getElementById('forgot-password-status');
    var btn = document.getElementById('forgot-password-send-btn');
    if (!window.mmAuth || !window.mmAuth.isConfigured()){
      statusEl.textContent = 'Backend not configured yet.';
      return;
    }
    if (!email){
      statusEl.textContent = 'Enter your email first.';
      return;
    }
    btn.disabled = true;
    statusEl.textContent = 'Sending…';
    window.mmAuth.requestPasswordReset(email).then(function(res){
      btn.disabled = false;
      if (res.error){
        statusEl.textContent = res.error.message;
        return;
      }
      // Supabase doesn't reveal whether the email exists (avoids leaking
      // which addresses have accounts) — same neutral message either way.
      statusEl.textContent = 'If an account exists for that email, a reset link is on its way.';
    }).catch(function(err){
      btn.disabled = false;
      statusEl.textContent = (err && err.message) || 'Something went wrong sending the reset link.';
    });
  });

  // ===== set new password (after following the emailed link) =====
  function openSetNewPassword(){
    document.getElementById('new-password').value = '';
    document.getElementById('set-new-password-status').textContent = '';
    var modal = document.getElementById('set-new-password-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  }
  window.openSetNewPassword = openSetNewPassword;

  function closeSetNewPassword(){
    var modal = document.getElementById('set-new-password-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  document.getElementById('set-new-password-close-btn').addEventListener('click', closeSetNewPassword);
  document.getElementById('set-new-password-modal').addEventListener('click', function(e){
    if (e.target.id === 'set-new-password-modal') closeSetNewPassword();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('set-new-password-modal').classList.contains('open')) closeSetNewPassword();
  });

  document.getElementById('set-new-password-btn').addEventListener('click', function(){
    var password = document.getElementById('new-password').value;
    var statusEl = document.getElementById('set-new-password-status');
    var btn = document.getElementById('set-new-password-btn');
    if (password.length < 6){
      statusEl.textContent = 'Password must be at least 6 characters.';
      return;
    }
    btn.disabled = true;
    statusEl.textContent = 'Saving…';
    window.mmAuth.updatePassword(password).then(function(res){
      btn.disabled = false;
      if (res.error){
        statusEl.textContent = res.error.message;
        return;
      }
      statusEl.textContent = '';
      closeSetNewPassword();
      alert('Password updated — you\'re signed in with your new password.');
    }).catch(function(err){
      btn.disabled = false;
      statusEl.textContent = (err && err.message) || 'Something went wrong saving the new password.';
    });
  });
})();
