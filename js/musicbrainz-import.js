(function(){
  var currentUser = window.mmCurrentUser;

  if (!document.getElementById('mb-search-btn')) return;

  var escapeHtml = window.mmEscapeHtml;

  // ===== MusicBrainz credit import =====
  // Real, live calls to the public MusicBrainz API
  // (https://musicbrainz.org/doc/MusicBrainz_API) — unlike Discogs (see
  // the note next to this section in profile.html for why that one isn't
  // wired up the same way), MusicBrainz needs no API key or account, so
  // there's nothing unsafe about calling it straight from the browser.
  //
  // Two disclosed limitations of calling it directly rather than through
  // a server-side proxy:
  //   1. MusicBrainz's API etiquette asks clients to send a descriptive
  //      User-Agent identifying the application — the Fetch API does not
  //      let scripts set that header, so this necessarily sends whatever
  //      User-Agent the visitor's browser sets by default instead.
  //   2. MusicBrainz asks for at most ~1 request/second from a given
  //      source. Every fetch here only ever runs in direct response to a
  //      single button click, so normal use can't exceed that.
  var MB_BASE = 'https://musicbrainz.org/ws/2';
  var currentReleaseGroups = [];

  function mbFetch(path){
    return fetch(MB_BASE + path, { headers: { 'Accept': 'application/json' } }).then(function(res){
      if (!res.ok) throw new Error('MusicBrainz returned ' + res.status);
      return res.json();
    });
  }

  function renderArtistResults(artists){
    var wrap = document.getElementById('mb-artist-results');
    var list = document.getElementById('mb-artist-list');
    document.getElementById('mb-release-results').style.display = 'none';
    if (!artists.length){
      wrap.style.display = 'none';
      document.getElementById('mb-search-status').textContent = 'No matching artists found on MusicBrainz.';
      return;
    }
    wrap.style.display = 'block';
    list.innerHTML = '';
    artists.forEach(function(a){
      var bits = [a.type, a.country, a.disambiguation].filter(Boolean);
      var item = document.createElement('div');
      item.className = 'gig-log-item tappable';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', 'Select artist ' + a.name);
      item.innerHTML =
        '<span class="gig-log-dot"></span>' +
        '<div style="flex:1;"><h5>' + escapeHtml(a.name) + '</h5><p>' + escapeHtml(bits.join(' · ')) + '</p></div>' +
        '<span class="gig-log-chevron">→</span>';
      function activate(){ selectArtist(a); }
      item.addEventListener('click', activate);
      item.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activate(); } });
      list.appendChild(item);
    });
  }

  function selectArtist(artist){
    var statusEl = document.getElementById('mb-search-status');
    statusEl.textContent = 'Loading releases for ' + artist.name + '…';
    mbFetch('/release-group?artist=' + encodeURIComponent(artist.id) + '&fmt=json&limit=40').then(function(data){
      statusEl.textContent = '';
      renderReleaseResults(data['release-groups'] || []);
    }).catch(function(err){
      statusEl.textContent = "Couldn't load releases (" + err.message + '). Try again in a moment.';
    });
  }

  function renderReleaseResults(releaseGroups){
    currentReleaseGroups = releaseGroups;
    var wrap = document.getElementById('mb-release-results');
    var list = document.getElementById('mb-release-list');
    if (!releaseGroups.length){
      wrap.style.display = 'none';
      document.getElementById('mb-search-status').textContent = 'No releases found for that artist on MusicBrainz.';
      return;
    }
    wrap.style.display = 'block';
    document.getElementById('mb-import-status').textContent = '';
    list.innerHTML = releaseGroups.map(function(rg, i){
      var year = (rg['first-release-date'] || '').slice(0, 4);
      var typeLabel = rg['primary-type'] || 'Release';
      return '<label class="terms-check"><input type="checkbox" class="mb-release-check" data-idx="' + i + '"><span>' +
        escapeHtml(rg.title) + (year ? ' (' + year + ')' : '') + ' — ' + escapeHtml(typeLabel) + '</span></label>';
    }).join('');
  }

  document.getElementById('mb-search-btn').addEventListener('click', function(){
    var name = document.getElementById('mb-search-input').value.trim();
    var statusEl = document.getElementById('mb-search-status');
    if (!name){ statusEl.textContent = 'Enter an artist name first.'; return; }
    statusEl.textContent = 'Searching MusicBrainz…';
    document.getElementById('mb-artist-results').style.display = 'none';
    document.getElementById('mb-release-results').style.display = 'none';
    mbFetch('/artist/?query=' + encodeURIComponent('artist:"' + name + '"') + '&fmt=json&limit=10').then(function(data){
      statusEl.textContent = '';
      renderArtistResults(data.artists || []);
    }).catch(function(err){
      statusEl.textContent = "Couldn't reach MusicBrainz (" + err.message + '). Check your connection and try again.';
    });
  });

  document.getElementById('mb-import-btn').addEventListener('click', function(){
    var user = currentUser();
    if (!user) return;
    var checked = Array.prototype.slice.call(document.querySelectorAll('.mb-release-check:checked'));
    var statusEl = document.getElementById('mb-import-status');
    if (!checked.length){ statusEl.textContent = 'Select at least one release to import.'; return; }
    statusEl.textContent = 'Importing…';
    var rows = checked.map(function(cb){
      var rg = currentReleaseGroups[parseInt(cb.getAttribute('data-idx'), 10)];
      var year = (rg['first-release-date'] || '').slice(0, 4);
      return {
        user_id: user.id,
        title: rg.title,
        credit_role: 'Artist',
        year: year ? parseInt(year, 10) : null,
        link: 'https://musicbrainz.org/release-group/' + rg.id
      };
    });
    Promise.all(rows.map(function(row){
      return window.mmSupabase.from('profile_credits').insert(row).select();
    })).then(function(results){
      var failed = results.filter(function(r){ return r.error; });
      statusEl.textContent = failed.length
        ? (failed.length + ' of ' + rows.length + " couldn't be imported.")
        : ('Imported ' + rows.length + (rows.length === 1 ? ' credit!' : ' credits!'));
      if (window.mmRefreshCredits) window.mmRefreshCredits();
    });
  });
})();
