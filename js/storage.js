(function(){
  // ===== shared storage abstraction =====
  // window.storage only exists inside the Claude artifact preview runtime.
  // This file is meant to be downloaded and opened as a real, standalone
  // site too, so every feature (game XP, referrals, gig log, following,
  // gear board) reads/writes through this one module, which falls back to
  // localStorage wherever window.storage is unavailable.
  var hasArtifactStorage = (typeof window.storage === 'object' && window.storage !== null && typeof window.storage.get === 'function');
  window.siteStorage = {
    get: function(key){
      if (hasArtifactStorage){
        return window.storage.get(key, false).then(function(res){ return res ? res.value : null; }).catch(function(){ return null; });
      }
      try{ return Promise.resolve(localStorage.getItem('musicmotel:' + key)); }
      catch(err){ return Promise.resolve(null); }
    },
    set: function(key, value){
      if (hasArtifactStorage){
        return window.storage.set(key, value, false).catch(function(){ return null; });
      }
      try{ localStorage.setItem('musicmotel:' + key, value); return Promise.resolve(true); }
      catch(err){ return Promise.resolve(false); }
    }
  };
})();
