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
})();
