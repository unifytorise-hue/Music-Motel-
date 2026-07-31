(function(){
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }

  if (!document.getElementById('id-liveness-modal')) return;

  // ===== SIMULATION NOTICE =====
  // Nothing captured by this flow is ever uploaded, stored, or sent
  // anywhere — every video frame lives only in the browser's <video>
  // element and is discarded the moment the modal closes. The "result"
  // below (session id, confidence score, pass/fail) is generated locally
  // with Math.random(), not computed from any real face/ID analysis. A
  // real production launch would replace this entire module with a
  // handoff to a certified identity provider — e.g. AWS Rekognition Face
  // Liveness, Persona, Onfido, Jumio, or iProov — which would own the
  // actual capture, biometric matching, anti-spoofing, and retention
  // policy. Building real biometric anti-spoofing is explicitly out of
  // scope here; see the consent screen in profile.html for the same
  // disclosure shown to users.
  var LIVENESS_STEPS = [
    'Hold your ID up to the camera',
    'Look straight at the camera',
    'Turn your head left',
    'Turn your head right',
    'Smile'
  ];
  var STEP_DURATION_MS = 1800;
  var SUCCESS_PROBABILITY = 0.8;
  var FAILURE_REASONS = [
    'Liveness confidence was too low — try again in brighter, even lighting.',
    "We couldn't get a clear view of your ID — hold it flatter and closer to the camera.",
    'The face in the liveness check and the ID photo didn\'t match closely enough.'
  ];

  var modal = document.getElementById('id-liveness-modal');
  var stream = null;
  var stepTimer = null;
  var stepIndex = 0;

  function stopCamera(){
    if (stream){
      stream.getTracks().forEach(function(t){ t.stop(); });
      stream = null;
    }
    if (stepTimer){ clearTimeout(stepTimer); stepTimer = null; }
  }

  function showStep(stepId){
    ['liveness-step-consent', 'liveness-step-camera', 'liveness-step-processing', 'liveness-step-result'].forEach(function(id){
      document.getElementById(id).style.display = (id === stepId) ? 'block' : 'none';
    });
  }

  function resetConsentStep(){
    document.getElementById('liveness-consent-check').checked = false;
    document.getElementById('liveness-consent-continue-btn').disabled = true;
    document.getElementById('liveness-consent-status').textContent = '';
  }

  document.getElementById('liveness-consent-check').addEventListener('change', function(e){
    document.getElementById('liveness-consent-continue-btn').disabled = !e.target.checked;
  });

  function renderProgress(){
    var wrap = document.getElementById('liveness-progress');
    wrap.innerHTML = LIVENESS_STEPS.map(function(_, i){
      var cls = 'liveness-dot' + (i < stepIndex ? ' done' : (i === stepIndex ? ' active' : ''));
      return '<span class="' + cls + '"></span>';
    }).join('');
  }

  function runStep(){
    if (stepIndex >= LIVENESS_STEPS.length){
      stopCamera();
      runProcessing();
      return;
    }
    document.getElementById('liveness-prompt').textContent = LIVENESS_STEPS[stepIndex];
    renderProgress();
    stepTimer = setTimeout(function(){
      stepIndex++;
      runStep();
    }, STEP_DURATION_MS);
  }

  function startCameraStep(){
    stepIndex = 0;
    document.getElementById('liveness-camera-error').style.display = 'none';
    showStep('liveness-step-camera');
    var video = document.getElementById('liveness-video');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function(s){
      stream = s;
      video.srcObject = s;
      runStep();
    }).catch(function(err){
      var errorEl = document.getElementById('liveness-camera-error');
      errorEl.style.display = 'block';
      errorEl.textContent = 'Could not access your camera (' + (err && err.name || 'unknown error') + '). Check your browser/site camera permission and try again.';
    });
  }

  function runProcessing(){
    showStep('liveness-step-processing');
    setTimeout(function(){
      var success = Math.random() < SUCCESS_PROBABILITY;
      showResult(success);
    }, 1400);
  }

  function showResult(success){
    showStep('liveness-step-result');
    var iconEl = document.getElementById('liveness-result-icon');
    var headingEl = document.getElementById('liveness-result-heading');
    var detailEl = document.getElementById('liveness-result-detail');
    var metaEl = document.getElementById('liveness-result-meta');
    var retryBtn = document.getElementById('liveness-retry-btn');
    var doneBtn = document.getElementById('liveness-done-btn');
    var sessionId = 'sim_' + Math.random().toString(36).slice(2, 10);

    if (success){
      var confidence = 82 + Math.random() * 17;
      iconEl.textContent = '✓';
      iconEl.style.color = 'var(--green)';
      headingEl.textContent = "You're ID Verified!";
      detailEl.textContent = 'Your liveness check passed — the badge now shows on your profile.';
      metaEl.textContent = 'Simulated session ' + sessionId + ' · confidence ' + confidence.toFixed(1) + '%';
      retryBtn.style.display = 'none';
      doneBtn.style.display = 'block';
      doneBtn.textContent = 'Done';
      var user = currentUser();
      if (user && window.mmSupabase){
        window.mmSupabase.from('profiles').update({
          id_verified_at: new Date().toISOString(),
          id_verification_confidence: confidence
        }).eq('id', user.id).then(function(){
          if (window.mmRefreshVerification) window.mmRefreshVerification();
        });
      }
    } else {
      var reason = FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)];
      iconEl.textContent = '✕';
      iconEl.style.color = 'var(--pink)';
      headingEl.textContent = "We couldn't verify that scan";
      detailEl.textContent = reason;
      metaEl.textContent = 'Simulated session ' + sessionId + ' · no charge, retry anytime';
      retryBtn.style.display = 'block';
      doneBtn.style.display = 'none';
    }
  }

  function closeModal(){
    stopCamera();
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }

  window.mmOpenIdLiveness = function(){
    resetConsentStep();
    showStep('liveness-step-consent');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  };

  document.getElementById('liveness-consent-continue-btn').addEventListener('click', function(){
    if (!document.getElementById('liveness-consent-check').checked) return;
    startCameraStep();
  });
  document.getElementById('liveness-retry-btn').addEventListener('click', function(){
    startCameraStep();
  });
  document.getElementById('liveness-done-btn').addEventListener('click', closeModal);
  document.getElementById('id-liveness-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', function(e){
    if (e.target.id === 'id-liveness-modal') closeModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
})();
