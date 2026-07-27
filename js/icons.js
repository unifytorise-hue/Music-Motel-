(function(){
  // Small inline-SVG icon set replacing the pictographic emoji that used
  // to live directly in markup/data (🎮🎙🎓🏆🎤💳🎧🎸🏛🔊🔍📍🗺️📅). Using
  // currentColor + stroke means these inherit whatever text color they're
  // dropped into, unlike emoji (which render as fixed-color bitmap glyphs
  // and clash with the site's neon palette). Plain symbol characters that
  // already render in the surrounding text color (✓ ✕ ★ → ♪) are left as
  // text — they aren't emoji in the pictographic sense and swapping them
  // for SVGs wouldn't change anything visually.
  var ICONS = {
    gamepad: '<rect x="2" y="7" width="20" height="10" rx="5"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1" fill="currentColor" stroke="none"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    graduation: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/><line x1="22" y1="10" x2="22" y2="16"/>',
    trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a1 1 0 0 0 0 2 4 4 0 0 0 3 3.87"/><path d="M17 5h3a1 1 0 0 1 0 2 4 4 0 0 1-3 3.87"/><line x1="12" y1="13" x2="12" y2="17"/><path d="M8 21h8"/><path d="M10 21v-2.5a2 2 0 0 1 4 0V21"/>',
    'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="1" y="15" width="6" height="7" rx="2"/><rect x="17" y="15" width="6" height="7" rx="2"/>',
    guitar: '<circle cx="9" cy="16" r="4.5"/><path d="M11 12.5L17 3"/><circle cx="17" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="16" r="1.4" fill="currentColor" stroke="none"/>',
    building: '<polygon points="12,2 21,7 3,7"/><line x1="5" y1="7" x2="5" y2="21"/><line x1="19" y1="7" x2="19" y2="21"/><line x1="3" y1="21" x2="21" y2="21"/><line x1="9" y1="10.5" x2="9" y2="18"/><line x1="15" y1="10.5" x2="15" y2="18"/>',
    speaker: '<polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    'map-pin': '<path d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    map: '<polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
  };

  window.mmIcon = function(name, cls){
    var body = ICONS[name];
    if (!body) return null;
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  };

  // Static markup can't call mmIcon() directly, so a `<span data-icon="name">`
  // placeholder is hydrated here once the rest of the page exists — same
  // "defer DOM work to DOMContentLoaded" reasoning as js/auth.js.
  function hydrate(){
    var slots = document.querySelectorAll('[data-icon]');
    for (var i = 0; i < slots.length; i++){
      var el = slots[i];
      var svg = window.mmIcon(el.getAttribute('data-icon'));
      if (svg) el.innerHTML = svg;
    }
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
