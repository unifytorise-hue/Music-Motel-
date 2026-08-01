(function(){
  var hotspots = document.querySelectorAll('.ecosystem-hotspot');
  if (!hotspots.length) return;

  hotspots.forEach(function(btn){
    btn.addEventListener('click', function(){
      hotspots.forEach(function(h){ h.classList.remove('glow'); });
      btn.classList.add('glow');

      if (window.mmSetPatchCategory) window.mmSetPatchCategory(btn.getAttribute('data-cat'));

      var searchBox = document.querySelector('.hero-search-box');
      if (searchBox) searchBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (window.showToast){
        var num = btn.getAttribute('data-num');
        var label = btn.getAttribute('data-label');
        window.showToast('Showing ' + num + ' — ' + label);
      }
    });
  });
})();
