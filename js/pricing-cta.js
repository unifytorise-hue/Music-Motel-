(function(){
  // With a single free tier, this just wires the two CTAs that used to
  // live alongside a whole grid of paid-plan buttons: the pricing card's
  // own "Create your free profile", and the Public Space section's
  // separate CTA (unrelated to pricing — it just also opens signup with
  // account type preset).
  document.getElementById('pricing-fan-btn').addEventListener('click', function(){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('fan');
    }
  });
  var pubspaceCtaBtn = document.getElementById('pubspace-cta-btn');
  if (pubspaceCtaBtn) pubspaceCtaBtn.addEventListener('click', function(e){
    e.preventDefault();
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('publicspace');
    }
  });
})();
