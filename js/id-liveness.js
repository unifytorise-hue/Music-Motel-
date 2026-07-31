(function(){
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }

  if (!document.getElementById('id-liveness-modal')) return;

  // ===== SIMULATION NOTICE =====
  // Nothing captured by this flow is ever uploaded, stored, or sent
  // anywhere — the ID photo is a data: URI held only in the <img> preview
  // element (for the retake/confirm step) and camera video only ever
  // touches the <video> elements below; both are discarded the moment this
  // modal closes or a retry starts. The "result" below (session id,
  // confidence score, pass/fail, failure reason) is generated locally with
  // Math.random() in the exact shape a real provider API would return —
  // not computed from any real face/ID analysis. A real production launch
  // would replace this entire module with a handoff to a certified
  // identity provider — e.g. AWS Rekognition Face Liveness, Persona,
  // Onfido, Jumio, or iProov — which would own the actual capture,
  // biometric matching, anti-spoofing, encryption, and retention policy.
  // Building real biometric anti-spoofing is explicitly out of scope here.
  //
  // ===== COMPLIANCE NOTES (POPIA / GDPR / BIPA / CPRA) =====
  // See the consent screen's expandable legal notice in profile.html for
  // the user-facing version of this. Summary for developers touching this
  // file: (1) verification stays fully optional everywhere else on the
  // site — never gate booking, messaging, or any core feature on it; (2)
  // consent is captured on its own dedicated screen, before camera access,
  // never inferred from general Terms acceptance; (3) the only data
  // written to Postgres on success is id_verified_at, a 0–1 confidence
  // score, a provider session id, and the consent timestamp — never a raw
  // image, video, or biometric template; (4) js/verification.js exposes a
  // one-click "delete my ID verification data" control that clears all of
  // the above; (5) a real launch needs a signed data processing agreement
  // with the chosen provider, a published retention/destruction schedule
  // (BIPA requires this in writing), and privacy-lawyer review before
  // going live to any jurisdiction.
  var LIVENESS_STEPS = [
    'Look straight at the camera',
    'Slowly turn your head left',
    'Turn your head right',
    'Look straight and smile'
  ];
  var STEP_DURATION_MS = 1800;
  var SUCCESS_PROBABILITY = 0.8;
  var FAILURE_REASON_TEXT = {
    FACE_OUT_OF_FRAME: 'Your face moved out of frame during the check — keep your whole face visible and try again.',
    INSUFFICIENT_MOTION: "We couldn't detect enough natural movement between prompts — make sure to actually turn your head and smile when asked."
  };

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
    ['liveness-step-consent', 'liveness-step-id-capture', 'liveness-step-camera', 'liveness-step-processing', 'liveness-step-result'].forEach(function(id){
      document.getElementById(id).style.display = (id === stepId) ? 'block' : 'none';
    });
  }

  function resetConsentStep(){
    document.getElementById('liveness-consent-check').checked = false;
    document.getElementById('liveness-consent-continue-btn').disabled = true;
    document.getElementById('liveness-consent-status').textContent = '';
    var details = document.querySelector('.consent-legal-details');
    if (details) details.open = false;
  }

  document.getElementById('liveness-consent-check').addEventListener('change', function(e){
    document.getElementById('liveness-consent-continue-btn').disabled = !e.target.checked;
  });

  function recordConsent(){
    var user = currentUser();
    if (!user || !window.mmSupabase) return;
    // Fire-and-forget audit record — BIPA's "written release" and GDPR's
    // "unambiguous consent" both require proof consent happened before
    // collection started, not just that it was theoretically shown.
    window.mmSupabase.from('profiles').update({ id_verification_consent_at: new Date().toISOString() }).eq('id', user.id).then(function(){}, function(){});
  }

  // ===== ID capture =====
  function resetIdCaptureStep(){
    document.getElementById('liveness-id-video').style.display = 'block';
    document.getElementById('liveness-id-preview').style.display = 'none';
    document.getElementById('liveness-id-preview').src = '';
    document.getElementById('liveness-frame-guide').style.display = 'block';
    document.getElementById('liveness-id-capture-btn').style.display = 'block';
    document.getElementById('liveness-id-review-actions').style.display = 'none';
    document.getElementById('liveness-id-camera-error').style.display = 'none';
  }

  function startIdCaptureStep(){
    resetIdCaptureStep();
    showStep('liveness-step-id-capture');
    var video = document.getElementById('liveness-id-video');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function(s){
      stream = s;
      video.srcObject = s;
    }).catch(function(err){
      var errorEl = document.getElementById('liveness-id-camera-error');
      errorEl.style.display = 'block';
      errorEl.textContent = 'Could not access your camera (' + (err && err.name || 'unknown error') + '). Check your browser/site camera permission and try again.';
    });
  }

  document.getElementById('liveness-id-capture-btn').addEventListener('click', function(){
    var video = document.getElementById('liveness-id-video');
    var canvas = document.getElementById('liveness-canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // toDataURL keeps the still frame in memory only (a data: URI assigned
    // straight to the <img> below) — it's never sent anywhere, and is
    // cleared again the moment Retake, Use this photo, or the modal close
    // handler runs.
    var dataUrl = canvas.toDataURL('image/png');
    document.getElementById('liveness-id-preview').src = dataUrl;
    document.getElementById('liveness-id-preview').style.display = 'block';
    document.getElementById('liveness-id-video').style.display = 'none';
    document.getElementById('liveness-frame-guide').style.display = 'none';
    document.getElementById('liveness-id-capture-btn').style.display = 'none';
    document.getElementById('liveness-id-review-actions').style.display = 'flex';
  });

  document.getElementById('liveness-id-retake-btn').addEventListener('click', function(){
    resetIdCaptureStep();
  });

  document.getElementById('liveness-id-use-btn').addEventListener('click', function(){
    document.getElementById('liveness-id-preview').src = '';
    startLivenessStep();
  });

  // ===== liveness challenge =====
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

  function startLivenessStep(){
    stepIndex = 0;
    document.getElementById('liveness-camera-error').style.display = 'none';
    showStep('liveness-step-camera');
    var video = document.getElementById('liveness-video');
    if (stream){
      // Same MediaStream already granted for ID capture — a stream can
      // feed more than one <video> element, so no second permission
      // prompt is needed for this step.
      video.srcObject = stream;
      runStep();
    } else {
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
  }

  function runProcessing(){
    showStep('liveness-step-processing');
    setTimeout(function(){
      showResult(buildSimulatedResult(Math.random() < SUCCESS_PROBABILITY));
    }, 1400);
  }

  // Matches the demo API contract exactly:
  // { sessionId, status, confidence, failureReason, auditImageCount, provider, processedAt }
  function buildSimulatedResult(success){
    var reasons = ['FACE_OUT_OF_FRAME', 'INSUFFICIENT_MOTION'];
    return {
      sessionId: 'mm_live_' + Math.random().toString(36).slice(2, 10),
      status: success ? 'SUCCEEDED' : 'FAILED',
      confidence: Number((success ? (0.82 + Math.random() * 0.17) : (0.2 + Math.random() * 0.4)).toFixed(3)),
      failureReason: success ? null : reasons[Math.floor(Math.random() * reasons.length)],
      auditImageCount: LIVENESS_STEPS.length,
      provider: 'demo-simulator',
      processedAt: new Date().toISOString()
    };
  }

  function showResult(result){
    showStep('liveness-step-result');
    var iconEl = document.getElementById('liveness-result-icon');
    var headingEl = document.getElementById('liveness-result-heading');
    var detailEl = document.getElementById('liveness-result-detail');
    var metaEl = document.getElementById('liveness-result-meta');
    var retryBtn = document.getElementById('liveness-retry-btn');
    var doneBtn = document.getElementById('liveness-done-btn');
    var confidencePct = (result.confidence * 100).toFixed(1) + '%';

    if (result.status === 'SUCCEEDED'){
      iconEl.textContent = '✓';
      iconEl.style.color = 'var(--green)';
      headingEl.textContent = "You're ID Verified!";
      detailEl.textContent = 'Your liveness check passed — the badge now shows on your profile.';
      metaEl.textContent = 'Session ' + result.sessionId + ' · confidence ' + confidencePct + ' · provider: ' + result.provider;
      retryBtn.style.display = 'none';
      doneBtn.style.display = 'block';
      doneBtn.textContent = 'Done';
      var user = currentUser();
      if (user && window.mmSupabase){
        window.mmSupabase.from('profiles').update({
          id_verified_at: result.processedAt,
          id_verification_confidence: result.confidence,
          id_verification_session_id: result.sessionId,
          id_verification_provider: result.provider
        }).eq('id', user.id).then(function(){
          if (window.mmRefreshVerification) window.mmRefreshVerification();
        });
      }
    } else {
      iconEl.textContent = '✕';
      iconEl.style.color = 'var(--pink)';
      headingEl.textContent = "We couldn't verify that scan";
      detailEl.textContent = FAILURE_REASON_TEXT[result.failureReason] || 'The check did not pass — please try again.';
      metaEl.textContent = 'Session ' + result.sessionId + ' · no charge, retry anytime';
      retryBtn.style.display = 'block';
      doneBtn.style.display = 'none';
    }
  }

  function closeModal(){
    stopCamera();
    document.getElementById('liveness-id-preview').src = '';
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
    recordConsent();
    startIdCaptureStep();
  });
  document.getElementById('liveness-consent-skip-btn').addEventListener('click', closeModal);
  document.getElementById('liveness-retry-btn').addEventListener('click', function(){
    startIdCaptureStep();
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
