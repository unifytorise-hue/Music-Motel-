(function(){
  function openLightbox(avatarUrl, colorHex, label){
    var modal = document.getElementById('avatar-lightbox');
    if (!modal) return;
    var photo = document.getElementById('avatar-lightbox-photo');
    var nameEl = document.getElementById('avatar-lightbox-name');
    // "Plain" render — no click-to-enlarge wiring, this element already is
    // the enlarged view.
    if (window.mmRenderAvatarPlain) window.mmRenderAvatarPlain(photo, avatarUrl, colorHex);
    nameEl.textContent = label || '';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trapFocus) window.trapFocus(modal);
  }
  function closeLightbox(){
    var modal = document.getElementById('avatar-lightbox');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }
  window.openAvatarLightbox = openLightbox;

  document.getElementById('avatar-lightbox-close-btn').addEventListener('click', closeLightbox);
  document.getElementById('avatar-lightbox').addEventListener('click', function(e){
    if (e.target.id === 'avatar-lightbox') closeLightbox();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('avatar-lightbox').classList.contains('open')) closeLightbox();
  });

  // The "Naledi K." card in the how-it-works demo is static sample markup,
  // not real profile data — wire it through the same tappable-avatar path
  // for a consistent "tap any profile pic to enlarge" experience, using its
  // existing pink gradient (no real photo to show).
  var demoAvatar = document.getElementById('demo-avatar-block');
  if (demoAvatar && window.mmRenderAvatar) window.mmRenderAvatar(demoAvatar, null, '#FF2D78', 'Naledi K.');
})();
