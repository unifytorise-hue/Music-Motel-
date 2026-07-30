(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();

  var MAX_BYTES = 5 * 1024 * 1024;
  var ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  var EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

  var myAvatarUrl = null;
  var myAvatarColor = null;

  function render(){
    var preview = document.getElementById('avatar-preview');
    var removeBtn = document.getElementById('avatar-remove-btn');
    if (window.mmRenderAvatar) window.mmRenderAvatar(preview, myAvatarUrl, myAvatarColor, 'your photo');
    if (removeBtn) removeBtn.style.display = myAvatarUrl ? '' : 'none';
  }

  function setStatus(text){
    var el = document.getElementById('avatar-status');
    if (el) el.textContent = text || '';
  }

  function loadMine(){
    if (!isSignedIn()) return Promise.resolve();
    return window.mmSupabase.from('profiles').select('avatar_url,avatar_color').eq('id', currentUser().id).maybeSingle()
      .then(function(res){
        if (res.error || !res.data) return;
        myAvatarUrl = res.data.avatar_url || null;
        myAvatarColor = res.data.avatar_color || null;
      }).catch(function(){});
  }

  function init(){
    var signedOutNote = document.getElementById('avatar-signed-out-note');
    var actions = document.querySelector('.avatar-upload-actions');
    var signedIn = isSignedIn();
    if (signedOutNote) signedOutNote.style.display = signedIn ? 'none' : 'block';
    if (actions) actions.style.display = signedIn ? 'flex' : 'none';
    setStatus('');
    if (!signedIn){
      myAvatarUrl = null;
      myAvatarColor = null;
      render();
      return;
    }
    loadMine().then(render);
  }

  function fileExtension(file){
    if (EXT_BY_TYPE[file.type]) return EXT_BY_TYPE[file.type];
    var m = /\.([a-z0-9]+)$/i.exec(file.name || '');
    return m ? m[1].toLowerCase() : 'jpg';
  }

  function uploadAvatar(file){
    var user = currentUser();
    if (!user) return;
    if (ALLOWED_TYPES.indexOf(file.type) === -1){
      setStatus('Please choose a PNG, JPEG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_BYTES){
      setStatus('That image is too large — please choose one under 5MB.');
      return;
    }
    var uploadBtn = document.getElementById('avatar-upload-btn');
    uploadBtn.disabled = true;
    setStatus('Uploading…');
    // Fixed key (no random suffix) so re-uploading always overwrites the
    // same object instead of leaving old photos orphaned in storage.
    var path = user.id + '/avatar.' + fileExtension(file);
    window.mmSupabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
      .then(function(res){
        if (res.error) throw res.error;
        var pub = window.mmSupabase.storage.from('avatars').getPublicUrl(path);
        // Cache-bust: the object path never changes on re-upload, so without
        // this every render everywhere on the site would keep showing the
        // old cached image until a hard refresh.
        var url = pub.data.publicUrl + '?t=' + Date.now();
        return window.mmSupabase.from('profiles').update({ avatar_url: url }).eq('id', user.id).then(function(updRes){
          if (updRes.error) throw updRes.error;
          myAvatarUrl = url;
          render();
          setStatus('Photo updated.');
          if (window.mmAuth && window.mmAuth.refreshOwnProfile) window.mmAuth.refreshOwnProfile();
          if (window.refreshNearbyPlayers) window.refreshNearbyPlayers();
        });
      })
      .catch(function(err){
        setStatus((err && err.message) || 'Could not upload that photo.');
      })
      .then(function(){ uploadBtn.disabled = false; });
  }

  var signinBtnEl = document.getElementById('avatar-open-signin-btn');
  if (signinBtnEl) signinBtnEl.addEventListener('click', function(){ if (window.openSignin) window.openSignin(); });
  var signupBtnEl = document.getElementById('avatar-open-signup-btn');
  if (signupBtnEl) signupBtnEl.addEventListener('click', function(){ if (window.openSignup) window.openSignup(); });

  var uploadBtnEl = document.getElementById('avatar-upload-btn');
  var fileInputEl = document.getElementById('avatar-file-input');
  if (uploadBtnEl && fileInputEl){
    uploadBtnEl.addEventListener('click', function(){ fileInputEl.click(); });
    fileInputEl.addEventListener('change', function(){
      var file = fileInputEl.files && fileInputEl.files[0];
      fileInputEl.value = '';
      if (file) uploadAvatar(file);
    });
  }

  var removeBtnEl = document.getElementById('avatar-remove-btn');
  if (removeBtnEl){
    removeBtnEl.addEventListener('click', function(){
      var user = currentUser();
      if (!user) return;
      removeBtnEl.disabled = true;
      setStatus('Removing…');
      window.mmSupabase.from('profiles').update({ avatar_url: null }).eq('id', user.id).then(function(res){
        removeBtnEl.disabled = false;
        if (res.error){ setStatus(res.error.message); return; }
        myAvatarUrl = null;
        render();
        setStatus('Photo removed.');
        if (window.mmAuth && window.mmAuth.refreshOwnProfile) window.mmAuth.refreshOwnProfile();
        if (window.refreshNearbyPlayers) window.refreshNearbyPlayers();
      }).catch(function(err){
        removeBtnEl.disabled = false;
        setStatus((err && err.message) || 'Could not remove photo.');
      });
    });
  }

  authReady.then(init);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ init(); });
  }
})();
