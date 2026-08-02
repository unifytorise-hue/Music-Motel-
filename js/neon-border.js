(function(){
  var container = document.getElementById('neon-border-loop');
  if (!container) return;

  // Musical notes + a spread of the instrument icons already defined in
  // js/icons.js, alternating colors from the site's existing neon palette.
  var ITEMS = [
    { note: '♪', color: '#FF2D78' },
    { icon: 'guitar', color: '#2BE8D9' },
    { note: '♫', color: '#E8B93D' },
    { icon: 'drum', color: '#4ADE80' },
    { note: '♬', color: '#9B3FC4' },
    { icon: 'piano', color: '#FF9A3D' },
    { note: '♪', color: '#FF4D4D' },
    { icon: 'saxophone', color: '#FF2D78' },
    { icon: 'mic', color: '#2BE8D9' },
    { note: '♫', color: '#E8B93D' },
    { icon: 'trumpet', color: '#4ADE80' },
    { icon: 'flute', color: '#9B3FC4' }
  ];
  var DURATION = 22; // seconds for one full lap around the footer frame

  ITEMS.forEach(function(item, i){
    var rider = document.createElement('div');
    rider.className = 'neon-loop-item';
    rider.style.color = item.color;
    rider.style.setProperty('--loop-duration', DURATION + 's');
    // Negative delays spread items evenly around the loop from the very
    // first frame, instead of all starting bunched at the top-left corner
    // and taking a full lap to spread out.
    rider.style.setProperty('--loop-delay', (-(i * DURATION / ITEMS.length)) + 's');

    var glyph = document.createElement('span');
    if (item.note){
      glyph.className = 'neon-loop-glyph note';
      glyph.textContent = item.note;
    } else {
      glyph.className = 'neon-loop-glyph';
      glyph.innerHTML = window.mmIcon ? (window.mmIcon(item.icon) || '') : '';
    }
    rider.appendChild(glyph);
    container.appendChild(rider);
  });
})();
