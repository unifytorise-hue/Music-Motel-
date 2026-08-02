(function(){
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

  function buildGlyph(item){
    var glyph = document.createElement('span');
    if (item.note){
      glyph.className = 'neon-loop-glyph note';
      glyph.textContent = item.note;
    } else {
      glyph.className = 'neon-loop-glyph';
      glyph.innerHTML = window.mmIcon ? (window.mmIcon(item.icon) || '') : '';
    }
    return glyph;
  }

  // ===== footer loop: closed rectangle traced around the footer itself
  // (see css — position:absolute inside a position:relative footer), so it
  // only exists at the very bottom of the document, not the viewport. =====
  var footerContainer = document.getElementById('neon-border-loop');
  if (footerContainer){
    var FOOTER_DURATION = 22;
    ITEMS.forEach(function(item, i){
      var rider = document.createElement('div');
      rider.className = 'neon-loop-item';
      rider.style.color = item.color;
      rider.style.setProperty('--loop-duration', FOOTER_DURATION + 's');
      rider.style.setProperty('--loop-delay', (-(i * FOOTER_DURATION / ITEMS.length)) + 's');
      rider.appendChild(buildGlyph(item));
      footerContainer.appendChild(rider);
    });
  }

  // ===== edge loop: open path tracing only the top/left/right edges of the
  // viewport (position:fixed, always visible while scrolling) — the bottom
  // edge is deliberately left out, since a closed viewport-fixed rectangle
  // used to drag its bottom edge across whatever page content was
  // currently at the bottom of the screen while scrolling. The footer loop
  // above is what covers "the bottom," anchored to the real page bottom
  // instead of the scrolling viewport. Built with a JS-computed SVG path
  // (offset-path:path(...) needs literal pixel numbers, not viewport
  // units) recalculated on resize; each rider fades in/out near the two
  // ends of the path so restarting the lap (jumping from bottom-right back
  // to bottom-left) is never visible mid-fade. =====
  var edgeContainer = document.getElementById('neon-border-edge-loop');
  if (edgeContainer){
    var EDGE_DURATION = 34;
    var EDGE_MARGIN = 10;
    var edgeRiders = [];

    ITEMS.forEach(function(item, i){
      var rider = document.createElement('div');
      rider.className = 'neon-loop-item-edge';
      rider.style.color = item.color;
      rider.style.setProperty('--loop-duration', EDGE_DURATION + 's');
      rider.style.setProperty('--loop-delay', (-(i * EDGE_DURATION / ITEMS.length)) + 's');
      rider.appendChild(buildGlyph(item));
      edgeContainer.appendChild(rider);
      edgeRiders.push(rider);
    });

    function edgePathString(){
      var w = window.innerWidth;
      var h = window.innerHeight;
      var m = EDGE_MARGIN;
      // bottom-left -> top-left (up) -> top-right (right along top) -> bottom-right (down)
      return 'path("M ' + m + ' ' + (h - m) + ' L ' + m + ' ' + m + ' L ' + (w - m) + ' ' + m + ' L ' + (w - m) + ' ' + (h - m) + '")';
    }

    function applyEdgePath(){
      var p = edgePathString();
      edgeRiders.forEach(function(r){ r.style.offsetPath = p; });
    }
    applyEdgePath();

    var resizeTimer;
    window.addEventListener('resize', function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyEdgePath, 150);
    });
  }
})();
