(function(){
  // Mobile-only tab switcher between the "Build Your Band" game and the
  // live-profile search box — see the .hero-widgets-tabs CSS for why: below
  // 900px there isn't room for both side by side, so only one shows at a
  // time. Defaults to search via the .tab-search class already present in
  // the HTML (so it's correct even before this script runs); this just
  // wires up switching away from that default.
  var grid = document.getElementById('hero-widgets-grid');
  var tabs = document.getElementById('hero-widgets-tabs');
  if (!grid || !tabs) return;

  var buttons = tabs.querySelectorAll('.hero-widgets-tab');
  buttons.forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = btn.getAttribute('data-tab');
      grid.classList.remove('tab-search', 'tab-game');
      grid.classList.add('tab-' + target);
      buttons.forEach(function(b){ b.classList.toggle('active', b === btn); });
    });
  });
})();
