(function(){
  // Pricing accordion: tap a card header to expand it, closing whichever
  // other card was open. Tapping the open card again closes it.
  function toggleCard(header){
    var card = header.closest('.price-card');
    var wasOpen = card.classList.contains('open');
    document.querySelectorAll('#pricing-grid .price-card').forEach(function(c){
      c.classList.remove('open');
      var h = c.querySelector('.price-card-header');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen){
      card.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
    }
  }
  document.querySelectorAll('#pricing-grid .price-card-header').forEach(function(header){
    header.addEventListener('click', function(){ toggleCard(header); });
    header.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggleCard(header);
      }
    });
  });
})();
