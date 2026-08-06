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
  // only exists at the very bottom of the document, not the viewport.
  // Deliberately a SMALLER subset of ITEMS than the edge loop below — with
  // all 12, each of the 3 segments (right/bottom/left) is "in flight" for
  // about a third of the loop's duration, so roughly 12 * 1/3 = 4 riders
  // end up on the same side at once. The footer got noticeably taller
  // once the Legal links were added, and 4-deep on one side reads as
  // clutter/overlap rather than a single ring circling the footer. 4
  // riders total keeps it to about one per side. =====
  var FOOTER_ITEMS = [
    { note: '♪', color: '#FF2D78' },
    { icon: 'guitar', color: '#2BE8D9' },
    { icon: 'drum', color: '#4ADE80' },
    { icon: 'piano', color: '#FF9A3D' }
  ];
  var footerContainer = document.getElementById('neon-border-loop');
  if (footerContainer){
    var FOOTER_DURATION = 22;
    FOOTER_ITEMS.forEach(function(item, i){
      var rider = document.createElement('div');
      rider.className = 'neon-loop-item';
      rider.style.color = item.color;
      rider.style.setProperty('--loop-duration', FOOTER_DURATION + 's');
      rider.style.setProperty('--loop-delay', (-(i * FOOTER_DURATION / FOOTER_ITEMS.length)) + 's');
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
  // instead of the scrolling viewport. Driven entirely by a CSS
  // left/top keyframe animation (see styles.css) rather than a JS-computed
  // offset-path:path() string — that flavor of Motion Path didn't reliably
  // animate on mobile Safari. Each rider fades in/out near the two ends of
  // the path so restarting the lap (jumping from bottom-right back to
  // bottom-left) is never visible mid-fade. =====
  var edgeContainer = document.getElementById('neon-border-edge-loop');
  if (edgeContainer){
    var EDGE_DURATION = 34;
    ITEMS.forEach(function(item, i){
      var rider = document.createElement('div');
      rider.className = 'neon-loop-item-edge';
      rider.style.color = item.color;
      rider.style.setProperty('--loop-duration', EDGE_DURATION + 's');
      rider.style.setProperty('--loop-delay', (-(i * EDGE_DURATION / ITEMS.length)) + 's');
      rider.appendChild(buildGlyph(item));
      edgeContainer.appendChild(rider);
    });
  }
})();
