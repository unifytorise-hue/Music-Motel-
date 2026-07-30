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
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    user: '<circle cx="12" cy="7.5" r="4"/><path d="M20 21v-1.5a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6V21"/>',
    drum: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v11a8 3 0 0 0 16 0V6"/><line x1="4" y1="6" x2="4" y2="17"/><line x1="20" y1="6" x2="20" y2="17"/>',
    piano: '<rect x="2" y="6" width="20" height="12" rx="1"/><line x1="6.5" y1="6" x2="6.5" y2="14"/><line x1="11" y1="6" x2="11" y2="14"/><line x1="15.5" y1="6" x2="15.5" y2="14"/><line x1="20" y1="6" x2="20" y2="14"/>',
    saxophone: '<path d="M8 3c2 0 3 1 3 3v7.5c0 2.2 1.3 3.5 3.5 3.5S18 15.7 18 13.5s-1.3-3.5-3.5-3.5"/><circle cx="8" cy="3" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="17" r="2"/>',
    trumpet: '<path d="M1 9.5h6l3-2.3 3.5 2.3v4l-3.5 2.3-3-2.3H1z"/><rect x="10.5" y="8" width="2" height="5" rx="0.6"/><rect x="13.3" y="8" width="2" height="5" rx="0.6"/><rect x="16.1" y="8" width="2" height="5" rx="0.6"/><path d="M19 8.5l4 2-4 2z"/>',
    flute: '<path d="M3 21L20 4"/><path d="M17 3.5l3.5 3.5"/><circle cx="13.5" cy="9" r="0.75" fill="currentColor" stroke="none"/><circle cx="11" cy="11.5" r="0.75" fill="currentColor" stroke="none"/><circle cx="8.5" cy="14" r="0.75" fill="currentColor" stroke="none"/>'
  };

  window.mmIcon = function(name, cls){
    var body = ICONS[name];
    if (!body) return null;
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  };

  // Shared by every place that shows a profile picture (nav, nearby-players
  // list, follow list, profile modal, the upload preview itself) — avatarUrl
  // is remote, other-user-controlled data, so it's only ever assigned via
  // the img.src DOM property (never string-concatenated into innerHTML/CSS),
  // which the browser treats strictly as a URL, not markup or a style value.
  // "Plain" = no click-to-enlarge wiring, used by the lightbox itself to
  // render the enlarged photo without recursively wiring another lightbox.
  window.mmRenderAvatarPlain = function(container, avatarUrl, colorHex){
    if (!container) return;
    var safeColor = /^#[0-9a-f]{3,8}$/i.test(colorHex || '') ? colorHex : '#2BE8D9';
    container.style.background = 'linear-gradient(135deg, ' + safeColor + ', var(--yellow))';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.innerHTML = '';
    if (avatarUrl && /^https:\/\//i.test(avatarUrl)){
      var img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;';
      container.appendChild(img);
    } else if (window.mmIcon){
      // Without this, a profile that hasn't uploaded a photo yet just shows
      // a blank gradient square — reads as broken rather than "no photo
      // set". A silhouette placeholder (same icon the sample directory
      // already falls back to) makes it read as an empty avatar slot.
      container.innerHTML = window.mmIcon('user', 'avatar-fallback-icon');
    }
  };

  // Every avatar rendered this way is tappable to view larger — assigning
  // .onclick/.onkeydown (rather than addEventListener) means a re-render
  // safely replaces the previous handler instead of stacking duplicates.
  window.mmRenderAvatar = function(container, avatarUrl, colorHex, label){
    if (!container) return;
    window.mmRenderAvatarPlain(container, avatarUrl, colorHex);
    container.style.cursor = 'pointer';
    container.setAttribute('role', 'button');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-label', label ? ('View larger photo of ' + label) : 'View larger photo');
    container.onclick = function(e){
      // Several call sites (e.g. the nearby-players row) put the avatar
      // inside a larger element that's itself clickable to open a full
      // profile — without this, tapping the avatar would open the
      // lightbox AND that other click handler underneath it.
      if (e && e.stopPropagation) e.stopPropagation();
      if (window.openAvatarLightbox) window.openAvatarLightbox(avatarUrl, colorHex, label);
    };
    container.onkeydown = function(e){
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); container.click(); }
    };
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
