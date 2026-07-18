(function(){
  var burger = document.getElementById('nav-burger');
  var mobileMenu = document.getElementById('mobile-menu');

  function openMobileMenu(){
    mobileMenu.classList.add('open');
    burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
  }
  function closeMobileMenu(){
    mobileMenu.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }
  window.closeMobileMenu = closeMobileMenu;

  burger.addEventListener('click', function(){
    if (mobileMenu.classList.contains('open')) closeMobileMenu();
    else openMobileMenu();
  });
  mobileMenu.querySelectorAll('a:not(.mobile-cta)').forEach(function(a){
    a.addEventListener('click', closeMobileMenu);
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeMobileMenu();
  });
})();
