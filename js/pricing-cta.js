(function(){
  // With a single free tier, this just wires the pricing card's own
  // "Create your free profile" CTA.
  document.getElementById('pricing-fan-btn').addEventListener('click', function(){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('fan');
    }
  });

  // businesses.html's "Set up your Public Space profile" button links here
  // as index.html?signup=publicspace, rather than duplicating the whole
  // multi-step signup form (location picker, map, etc.) onto that
  // lightweight subpage — this picks the intent back up on arrival so it's
  // still a one-click flow. Not scoped to just "publicspace": any account
  // type name works, in case another subpage wants the same pattern later.
  var requestedType = new URLSearchParams(window.location.search).get('signup');
  if (requestedType && window.getAccountTypeConfig && window.getAccountTypeConfig(requestedType)){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType(requestedType);
    }
  }

  // Same handoff pattern as ?signup= above — subpages redirect "Switch
  // account"/"Sign in" here as index.html?signin=1 (they don't have a
  // sign-in modal of their own), and this picks the intent back up on
  // arrival so it opens immediately instead of landing on a signed-out
  // homepage with no visible next step. Unlike window.openSignup (assigned
  // synchronously by signup-location.js, earlier in the document),
  // window.openSignin is only assigned inside auth.js's DOMContentLoaded
  // listener — which fires *after* this script has already run during
  // parsing — so it isn't defined yet at this point. Deferring to our own
  // DOMContentLoaded listener runs this after auth.js's (registered
  // earlier in the document, so it fires first).
  document.addEventListener('DOMContentLoaded', function(){
    if (new URLSearchParams(window.location.search).get('signin') && typeof window.openSignin === 'function'){
      window.openSignin();
    }
  });
})();
