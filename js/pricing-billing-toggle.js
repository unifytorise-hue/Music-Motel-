(function(){
  var toggleBtns = document.querySelectorAll('.billing-toggle-btn');
  toggleBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      var cycle = btn.getAttribute('data-cycle');
      toggleBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.price-num').forEach(function(el){
        var monthly = el.getAttribute('data-monthly');
        var yearly = el.getAttribute('data-yearly');
        if (!monthly) return; // the free tier has no data attrs
        if (cycle === 'yearly'){
          el.textContent = '$' + (parseFloat(yearly) / 12).toFixed(0);
        } else {
          el.textContent = '$' + monthly;
        }
      });
      document.querySelectorAll('.price-period').forEach(function(el){
        if (el.closest('.price-card').querySelector('.price-num[data-monthly]')){
          el.textContent = '/mo';
        }
      });
      document.querySelectorAll('.price-yearly-note').forEach(function(el){
        el.style.display = cycle === 'yearly' ? 'block' : 'none';
      });
    });
  });

  document.getElementById('pricing-fan-btn').addEventListener('click', function(){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('fan');
    }
  });
  document.getElementById('pricing-educator-btn').addEventListener('click', function(){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('educator');
    }
  });
  document.getElementById('pricing-venue-btn').addEventListener('click', function(){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('venue');
    }
  });
  document.getElementById('pricing-publicspace-btn').addEventListener('click', function(){
    if (typeof window.openSignup === 'function'){
      window.openSignup();
      if (window.setSignupAccountType) window.setSignupAccountType('publicspace');
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
