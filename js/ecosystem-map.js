(function(){
  // Two separate displays of the same 11 categories exist on the homepage —
  // the ecosystem diagram near the bottom and the "Who's on the platform"
  // roles-grid higher up — so clicking either one glows BOTH (matched by
  // data-num) and drives the same search-widget filter, rather than only
  // wiring up the diagram and leaving the roles-grid inert.
  var clickable = document.querySelectorAll('.ecosystem-hotspot, .role-cell');
  if (!clickable.length) return;

  function activate(el){
    var num = el.getAttribute('data-num');
    clickable.forEach(function(c){
      c.classList.toggle('glow', c.getAttribute('data-num') === num);
    });

    if (window.mmSetPatchCategory) window.mmSetPatchCategory(el.getAttribute('data-cat'));

    var searchBox = document.querySelector('.hero-search-box');
    if (searchBox) searchBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (window.showToast){
      var label = el.getAttribute('data-label') || (el.querySelector('h4') && el.querySelector('h4').textContent);
      window.showToast('Showing ' + num + ' — ' + label);
    }
  }

  clickable.forEach(function(el){
    el.addEventListener('click', function(){ activate(el); });
    el.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activate(el); }
    });
  });
})();
