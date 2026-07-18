(function(){
  // ===== data =====
  var COLORS = ['#FF2D78','#2BE8D9','#FFD319','#4ADE80','#A66BFF','#FF9A3D','#FF4D4D'];

  // ===== storage abstraction =====
  // Shared module defined once, near the top of the file (see the script
  // block right after the focus-trap utility).
  var storageGet = window.siteStorage.get;
  var storageSet = window.siteStorage.set;

  // ===== referral code: a stable per-visitor invite code =====
  var REFERRAL_CODE_KEY = 'referral-code';
  var REFERRAL_COUNT_KEY = 'referral-signup-count';
  var REFERRED_BY_KEY = 'referred-by-code';
  var myReferralCode = null;

  function generateCode(){
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
    var code = '';
    for (var i=0;i<6;i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  function getOrCreateReferralCode(){
    return storageGet(REFERRAL_CODE_KEY).then(function(existing){
      if (existing) return existing;
      var fresh = generateCode();
      return storageSet(REFERRAL_CODE_KEY, fresh).then(function(){ return fresh; });
    });
  }

  function getReferralLink(code){
    var url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('ref', code);
    return url.toString();
  }

  // Detect if this visitor arrived via someone else's invite link.
  // We only ever record the *first* referrer we see for this browser.
  (function checkIncomingReferral(){
    var params = new URLSearchParams(window.location.search);
    var incomingCode = params.get('ref');
    if (!incomingCode) return;
    storageGet(REFERRED_BY_KEY).then(function(alreadyReferred){
      if (alreadyReferred) return; // don't overwrite an existing referral attribution
      storageSet(REFERRED_BY_KEY, incomingCode);
    });
  })();

  var ROLES = [
    {name:'Vocalist', color:'#FF2D78'},
    {name:'Guitarist', color:'#2BE8D9'},
    {name:'Bassist', color:'#FFD319'},
    {name:'Drummer', color:'#4ADE80'},
    {name:'Keyboardist', color:'#A66BFF'},
    // Strings
    {name:'Violinist', color:'#2BE8D9'},
    {name:'Cellist', color:'#FF9A3D'},
    {name:'Double Bassist', color:'#FFD319'},
    {name:'Harpist', color:'#A66BFF'},
    {name:'Banjo Player', color:'#4ADE80'},
    {name:'Mandolinist', color:'#FF4D4D'},
    {name:'Ukulele Player', color:'#2BE8D9'},
    {name:'Sitar Player', color:'#FF2D78'},
    // Woodwinds
    {name:'Saxophonist', color:'#FFD319'},
    {name:'Flutist', color:'#A66BFF'},
    {name:'Clarinetist', color:'#4ADE80'},
    {name:'Oboist', color:'#FF9A3D'},
    {name:'Bassoonist', color:'#FF4D4D'},
    {name:'Bagpiper', color:'#2BE8D9'},
    // Brass
    {name:'Trumpeter', color:'#FF2D78'},
    {name:'Trombonist', color:'#FFD319'},
    {name:'French Horn Player', color:'#A66BFF'},
    {name:'Tuba Player', color:'#4ADE80'},
    // Percussion
    {name:'Percussionist', color:'#FF9A3D'},
    {name:'Djembe Player', color:'#FF4D4D'},
    {name:'Vibraphonist', color:'#2BE8D9'},
    {name:'Marimba Player', color:'#FFD319'},
    // Electronic & production
    {name:'DJ', color:'#FF2D78'},
    {name:'Synth Player', color:'#A66BFF'},
    {name:'Turntablist', color:'#4ADE80'},
    {name:'Producer', color:'#FF4D4D'},
    {name:'Sound Engineer', color:'#FF9A3D'},
    // World & specialty instruments
    {name:'Accordionist', color:'#2BE8D9'},
    {name:'Harmonica Player', color:'#FFD319'},
    {name:'Kora Player', color:'#A66BFF'},
    {name:'Steel Drum Player', color:'#4ADE80'},
    // Writing & business roles
    {name:'Songwriter', color:'#A66BFF'},
    {name:'Composer', color:'#FF2D78'},
    {name:'Tour Manager', color:'#4ADE80'},
    {name:'A&R', color:'#FF9A3D'}
  ];

  var RANKS = [
    {min:0, name:'SOLO ACT'},
    {min:1, name:'DUO'},
    {min:2, name:'TRIO'},
    {min:3, name:'POWER FOUR'},
    {min:4, name:'FULL BAND'},
    {min:6, name:'HEADLINER'},
    {min:9, name:'ORCHESTRA'},
    {min:13, name:'FESTIVAL LINEUP'}
  ];

  var PATCH_CATEGORIES = [
    {id:'all', label:'All', color:'#F7F3EA'},
    {id:'perform', label:'Performing', color:'#FF2D78'},
    {id:'production', label:'Production', color:'#2BE8D9'},
    {id:'business', label:'Business', color:'#FFD319'},
    {id:'support', label:'Support', color:'#4ADE80'}
  ];

  var PATCH_JACKS = [
    {name:'Vocalists', loc:'New York, US', cat:'perform', color:'#FF2D78', lat:40.7128, lng:-74.0060,
      person:{ name:'Maya Ellison', role:'Vocalist / Session Singer', strength:78,
        bio:'Jazz-trained vocalist who crossed into indie pop. Available for session work, features, and live backing vocals across the tri-state area.',
        badges:[{label:'Verified', icon:'✓'},{label:'Session Ready', icon:'♪'}],
        gigs:[
          {title:'Backing vocals — Brooklyn Steel headline show', detail:'Three-night run, two original songs co-written on the spot.', xp:60},
          {title:'Studio feature — "Quiet Static" single', detail:'Lead vocal feature for an independent electronic producer.', xp:40},
          {title:'Wedding & private event singer', detail:'Solo acoustic sets, 30+ bookings over the past year.', xp:25}
        ]}},
    {name:'Bassists', loc:'Midrand, ZA', cat:'perform', color:'#FF2D78', lat:-25.9992, lng:28.1267,
      person:{ name:'Naledi Khumalo', role:'Session Bassist', strength:82,
        bio:'Session and touring bassist with a background in jazz and Afrobeat. Comfortable with upright and electric, reads charts on first pass.',
        badges:[{label:'Verified', icon:'✓'},{label:'Touring', icon:'★'},{label:'40+ Gigs', icon:'♪'}],
        gigs:[
          {title:'Backline support — Joburg Jazz Fest', detail:'Three-night residency, full live recording linked on profile.', xp:50},
          {title:'Studio session — "Skylines" EP', detail:'Bass tracking for an independent R&B release, credited.', xp:30},
          {title:'Touring bassist — regional support act', detail:'14-date run, available for similar bookings on request.', xp:80}
        ]}},
    {name:'Guitarists', loc:'Austin, US', cat:'perform', color:'#FF2D78', lat:30.2672, lng:-97.7431,
      person:{ name:'Jonah Reyes', role:'Guitarist / Multi-instrumentalist', strength:71,
        bio:'Texas blues-rock guitarist doubling on pedal steel. Plays weekly residencies around East Austin and takes select touring offers.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Weekly residency — Continental Club', detail:'Standing Tuesday slot, house band plus rotating guests.', xp:45},
          {title:'Session work — local Americana releases', detail:'Pedal steel and lead guitar on three EPs this year.', xp:35}
        ]}},
    {name:'Session Drummers', loc:'London, UK', cat:'perform', color:'#FF2D78', lat:51.5074, lng:-0.1278,
      person:{ name:'Priya Anand', role:'Session Drummer', strength:74,
        bio:'Session drummer across pop, soul, and broken beat. Owns a fully mic\'d kit and home studio for remote tracking.',
        badges:[{label:'Verified', icon:'✓'},{label:'Remote Ready', icon:'🎙'}],
        gigs:[
          {title:'Remote tracking — three-track EP', detail:'Drums recorded and stems delivered within 48 hours.', xp:30},
          {title:'Live support — UK club tour', detail:'8-date run backing a touring soul artist.', xp:55}
        ]}},
    {name:'Sound Engineers', loc:'Mumbai, IN', cat:'production', color:'#2BE8D9', lat:19.0760, lng:72.8777,
      person:{ name:'Arjun Mehta', role:'Live Sound Engineer', strength:69,
        bio:'FOH and monitor engineer for mid-size venues and festivals across Maharashtra. Comfortable with both analog and digital consoles.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'FOH — regional music festival', detail:'Three-stage festival, managed front-of-house for the main stage.', xp:60},
          {title:'Monitor engineer — touring act', detail:'12-date support tour across western India.', xp:45}
        ]}},
    {name:'Mixing Engineers', loc:'Lagos, NG', cat:'production', color:'#2BE8D9', lat:6.5244, lng:3.3792,
      person:{ name:'Chidi Okafor', role:'Mixing Engineer', strength:80,
        bio:'Afrobeats and amapiano mixing engineer. Worked on tracks that charted regionally; open to remote mixing for international artists.',
        badges:[{label:'Verified', icon:'✓'},{label:'Remote Ready', icon:'🎙'}],
        gigs:[
          {title:'Mix credit — regional chart single', detail:'Full mix and light mastering for an Afrobeats single.', xp:70},
          {title:'EP mixing — independent artist', detail:'Five-track EP, turnaround within two weeks.', xp:40}
        ]}},
    {name:'Producers', loc:'Atlanta, US', cat:'production', color:'#2BE8D9', lat:33.7490, lng:-84.3880,
      person:{ name:'Marcus Bell', role:'Music Producer', strength:76,
        bio:'Trap and R&B producer running a home studio in Atlanta. Built beats for independent rappers and is opening up session slots.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Production — independent rap EP', detail:'Produced and mixed a six-track project, released independently.', xp:50},
          {title:'Beat placement — regional artist single', detail:'One placement on a single with regional radio play.', xp:35}
        ]}},
    {name:'Mastering Engineers', loc:'Berlin, DE', cat:'production', color:'#2BE8D9', lat:52.5200, lng:13.4050,
      person:{ name:'Lena Vogel', role:'Mastering Engineer', strength:85,
        bio:'Mastering engineer for electronic and techno labels across Berlin. Vinyl-aware mastering, fast turnaround for label deadlines.',
        badges:[{label:'Verified', icon:'✓'},{label:'Remote Ready', icon:'🎙'}],
        gigs:[
          {title:'Label mastering — techno EP series', detail:'Ongoing mastering relationship with a Berlin techno label.', xp:55},
          {title:'Vinyl pre-master — independent release', detail:'Prepared masters specifically for vinyl cut.', xp:30}
        ]}},
    {name:'Tour Managers', loc:'Berlin, DE', cat:'business', color:'#FFD319', lat:52.5200, lng:13.4050,
      person:{ name:'Felix Hartmann', role:'Tour Manager', strength:73,
        bio:'Tour manager for mid-size touring acts across the EU. Handles logistics, advancing, and budgets from a single point of contact.',
        badges:[{label:'Verified', icon:'✓'},{label:'Touring', icon:'★'}],
        gigs:[
          {title:'EU tour management — 22 dates', detail:'Full logistics and advancing for a six-week European tour.', xp:90},
          {title:'Festival routing — summer run', detail:'Coordinated routing for five festival appearances.', xp:40}
        ]}},
    {name:'Artist Managers', loc:'Los Angeles, US', cat:'business', color:'#FFD319', lat:34.0522, lng:-118.2437,
      person:{ name:'Simone Carter', role:'Artist Manager', strength:77,
        bio:'Manages a small, intentional roster of independent artists. Focused on sync placements and sustainable touring, not overnight hype.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Sync placement — streaming series', detail:'Landed a placement for a client track in a streaming original.', xp:65},
          {title:'Roster development — independent artist', detail:'Guided release strategy for a debut EP rollout.', xp:35}
        ]}},
    {name:'Booking Agents', loc:'Toronto, CA', cat:'business', color:'#FFD319', lat:43.6532, lng:-79.3832,
      person:{ name:'Owen Fraser', role:'Booking Agent', strength:70,
        bio:'Books club and mid-size venue shows across Ontario and Quebec for indie and emerging acts.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Regional tour booking — 10 dates', detail:'Booked a club tour across Ontario and Quebec.', xp:50},
          {title:'Festival slot booking', detail:'Secured a mid-stage slot at a regional summer festival.', xp:30}
        ]}},
    {name:'Music Publishers', loc:'Paris, FR', cat:'business', color:'#FFD319', lat:48.8566, lng:2.3522,
      person:{ name:'Camille Dubois', role:'Music Publisher', strength:81,
        bio:'Independent publisher representing songwriters across pop and film/TV sync. Based in Paris, works internationally.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Sync placement — European TV drama', detail:'Placed a catalogue track in a recurring TV series.', xp:60},
          {title:'Co-publishing deal — emerging songwriter', detail:'Signed and began administering a new songwriter catalogue.', xp:40}
        ]}},
    {name:'Music Therapists', loc:'Toronto, CA', cat:'support', color:'#4ADE80', lat:43.6532, lng:-79.3832,
      person:{ name:'Dr. Hannah Lee', role:'Music Therapist', strength:88,
        bio:'Registered music therapist working with both pediatric and elder-care settings. Also offers sessions for performing musicians managing performance anxiety.',
        badges:[{label:'Verified', icon:'✓'},{label:'Licensed', icon:'🎓'}],
        gigs:[
          {title:'Hospital program — pediatric ward', detail:'Weekly sessions as part of an ongoing hospital arts program.', xp:50},
          {title:'Performance anxiety workshop', detail:'Ran a workshop series for a local conservatory\'s performance majors.', xp:35}
        ]}},
    {name:'Luthiers', loc:'Cremona, IT', cat:'support', color:'#4ADE80', lat:45.1333, lng:10.0333,
      person:{ name:'Giulia Ferrari', role:'Luthier — String Instrument Maker', strength:90,
        bio:'Third-generation luthier in Cremona\'s violin-making tradition. Builds and restores violins, violas, and cellos for working musicians and collectors.',
        badges:[{label:'Verified', icon:'✓'},{label:'Master Craft', icon:'🏆'}],
        gigs:[
          {title:'Commissioned violin build', detail:'Hand-built violin commissioned by a touring soloist.', xp:90},
          {title:'Restoration — 19th century cello', detail:'Full structural restoration of a damaged antique cello.', xp:70}
        ]}},
    {name:'Stage Managers', loc:'Sydney, AU', cat:'support', color:'#4ADE80', lat:-33.8688, lng:151.2093,
      person:{ name:'Liam O\'Brien', role:'Stage Manager', strength:72,
        bio:'Stage manager for theatre and live music productions across Sydney. Calm under pressure, meticulous with run-of-show docs.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Stage management — touring musical', detail:'Managed a 6-week regional run of a touring musical production.', xp:65},
          {title:'Festival stage management', detail:'Ran a secondary stage across a 3-day music festival.', xp:45}
        ]}},
    {name:'Piano Tuners', loc:'Vienna, AT', cat:'support', color:'#4ADE80', lat:48.2082, lng:16.3738,
      person:{ name:'Stefan Gruber', role:'Piano Tuner & Technician', strength:84,
        bio:'Trained piano technician maintaining concert hall and conservatory instruments across Vienna, including historical instrument restoration.',
        badges:[{label:'Verified', icon:'✓'},{label:'Master Craft', icon:'🏆'}],
        gigs:[
          {title:'Concert hall maintenance contract', detail:'Ongoing tuning and voicing for a chamber music venue.', xp:55},
          {title:'Historical instrument restoration', detail:'Restored a 1920s grand piano for a private collector.', xp:75}
        ]}}
  ];

  var xp = 0;
  var band = [];

  function setXP(n){
    xp = n;
    document.getElementById('nav-xp').textContent = xp;
    storageSet('total-xp', String(xp));
  }

  // load any previously saved XP on page load
  storageGet('total-xp').then(function(saved){
    if (saved){
      xp = parseInt(saved, 10) || 0;
      document.getElementById('nav-xp').textContent = xp;
    }
  });

  function renderChips(){
    var grid = document.getElementById('chip-grid');
    grid.innerHTML = '';
    ROLES.forEach(function(role, i){
      var chip = document.createElement('button');
      chip.className = 'chip';
      chip.style.setProperty('--chip-color', role.color);
      chip.innerHTML = '<span class="plus">+</span>' + role.name;
      chip.setAttribute('data-idx', i);
      chip.addEventListener('click', function(){ addToBand(i, chip); });
      grid.appendChild(chip);
    });
  }

  var nudged = false;
  function updateRank(){
    var rank = RANKS[0];
    for (var i=0;i<RANKS.length;i++){
      if (band.length >= RANKS[i].min) rank = RANKS[i];
    }
    var badge = document.getElementById('rank-badge');
    if (badge.textContent !== rank.name){
      badge.textContent = rank.name;
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
    var pct = Math.min(100, (band.length / 13) * 100);
    document.getElementById('meter-fill').style.width = pct + '%';

    if (!nudged && band.length >= 4){
      nudged = true;
      setTimeout(function(){
        showToast('That\'s a real lineup — create your profile to find them for real →');
      }, 700);
    }
  }

  function escapeHtmlGame(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function renderRoster(){
    var roster = document.getElementById('roster');
    if (band.length === 0){
      roster.innerHTML = '<span class="roster-empty">Your band is empty. Tap a role above to recruit your first member →</span>';
      return;
    }
    roster.innerHTML = '';
    band.forEach(function(member, pos){
      var slot = document.createElement('div');
      slot.className = 'roster-slot';
      slot.style.setProperty('--slot-color', member.color);
      slot.innerHTML = '<span class="avatar-dot"></span><span>' + escapeHtmlGame(member.name) + '</span>';
      var rm = document.createElement('button');
      rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove ' + member.name);
      rm.addEventListener('click', function(){ removeFromBand(pos); });
      slot.appendChild(rm);
      roster.appendChild(slot);
    });
    updateRank();
  }

  function showToast(text){
    var toast = document.getElementById('toast');
    document.getElementById('toast-text').textContent = text;
    toast.classList.add('show');
    clearTimeout(toast._t);
    var duration = Math.max(1800, Math.min(4200, text.length * 55));
    toast._t = setTimeout(function(){ toast.classList.remove('show'); }, duration);
  }

  function burstConfetti(x, y){
    var canvas = document.getElementById('confetti-canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var particles = [];
    for (var i=0;i<28;i++){
      particles.push({
        x:x, y:y,
        vx:(Math.random()-0.5)*9,
        vy:(Math.random()-1.6)*9,
        size:Math.random()*5+3,
        color:COLORS[Math.floor(Math.random()*COLORS.length)],
        life:1
      });
    }
    function frame(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      var alive = false;
      particles.forEach(function(p){
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.life -= 0.018;
        ctx.globalAlpha = Math.max(p.life,0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1;
      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    frame();
  }

  function addToBand(idx, chipEl){
    if (chipEl.classList.contains('added')) return;
    var role = ROLES[idx];
    band.push({ name: role.name, color: role.color, roleIdx: idx });
    setXP(xp + 25);
    renderRoster();
    chipEl.classList.add('added');
    var rect = chipEl.getBoundingClientRect();
    burstConfetti(rect.left + rect.width/2, rect.top + rect.height/2);
    showToast(role.name + ' added · +25 XP');
  }

  function removeFromBand(pos){
    var removed = band[pos];
    band.splice(pos, 1);
    setXP(Math.max(0, xp - 25));
    renderRoster();
    // Look the chip up by its data-idx (set once in renderChips) rather than
    // substring-matching textContent — exact and immune to name collisions
    // (e.g. "Bassist" vs "Double Bassist") regardless of ROLES ordering.
    var chip = document.querySelector('.chip[data-idx="' + removed.roleIdx + '"]');
    if (chip) chip.classList.remove('added');
  }

  // ===== patch bay =====
  var activeCat = 'all';
  function renderPatchTabs(){
    var tabs = document.getElementById('patch-tabs');
    tabs.innerHTML = '';
    PATCH_CATEGORIES.forEach(function(cat){
      var btn = document.createElement('button');
      btn.className = 'patch-tab' + (cat.id === activeCat ? ' active' : '');
      btn.style.setProperty('--tab-color', cat.color);
      btn.textContent = cat.label;
      btn.addEventListener('click', function(){
        activeCat = cat.id;
        renderPatchTabs();
        renderPatchRow();
      });
      tabs.appendChild(btn);
    });
  }

  function renderPatchRow(){
    var row = document.getElementById('patch-row');
    row.innerHTML = '';
    var jacks = PATCH_JACKS.slice();

    if (userLocation){
      jacks.forEach(function(jack){
        jack._distance = haversineKm(userLocation.lat, userLocation.lng, jack.lat, jack.lng);
      });
      jacks.sort(function(a,b){ return a._distance - b._distance; });
    }

    jacks.forEach(function(jack){
      var matches = activeCat === 'all' || jack.cat === activeCat;
      var el = document.createElement('div');
      el.className = 'jack' + (activeCat !== 'all' && matches ? ' match' : '') + (activeCat !== 'all' && !matches ? ' dim' : '');
      el.style.setProperty('--jack-color', jack.color);
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      var distHtml = (userLocation && jack._distance != null)
        ? '<span class="jack-distance">' + formatDistance(jack._distance) + '</span>'
        : '<span class="jcount">' + jack.loc + '</span>';
      var displayName = jack.person ? jack.person.name : jack.name;
      var roleSubtitle = jack.person ? '<span class="jack-role-sub">' + jack.name + '</span>' : '';
      el.setAttribute('aria-label', jack.person ? 'View profile for ' + jack.person.name : 'Search for ' + jack.name);
      el.innerHTML = '<div class="jhead"><span class="jplug"></span><div><span class="jname">' + displayName + '</span>' + roleSubtitle + '</div></div>' + distHtml;
      function activateJack(){
        if (jack.person && typeof window.openProfile === 'function'){
          window.openProfile(jack);
        } else if (typeof window.openSignupWithRole === 'function'){
          showToast('Opening profile search for ' + jack.name);
          window.openSignupWithRole(jack.name.replace(/s$/, ''));
        }
      }
      el.addEventListener('click', activateJack);
      el.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          activateJack();
        }
      });
      row.appendChild(el);
    });
  }

  // ===== distance from me =====
  var userLocation = null;

  function haversineKm(lat1, lng1, lat2, lng2){
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function formatDistance(km){
    if (km < 1) return '<1 km away';
    if (km < 10) return Math.round(km) + ' km away';
    return Math.round(km / 10) * 10 + ' km away';
  }

  var nearMeBtn = document.getElementById('patch-nearme-btn');
  var nearMeIcon = document.getElementById('patch-nearme-icon');
  var nearMeText = document.getElementById('patch-nearme-text');
  var nearMeStatus = document.getElementById('patch-nearme-status');

  nearMeBtn.addEventListener('click', function(){
    if (userLocation){
      // toggle off
      userLocation = null;
      nearMeBtn.classList.remove('active');
      nearMeText.textContent = 'Sort by distance from me';
      nearMeStatus.textContent = '';
      nearMeStatus.className = 'patch-nearme-status';
      renderPatchRow();
      return;
    }
    if (!('geolocation' in navigator)){
      nearMeStatus.textContent = 'Your browser does not support geolocation.';
      nearMeStatus.className = 'patch-nearme-status error';
      return;
    }
    nearMeBtn.disabled = true;
    nearMeIcon.classList.add('pulsing');
    nearMeText.textContent = 'Locating…';
    nearMeStatus.textContent = 'Waiting for location permission…';
    nearMeStatus.className = 'patch-nearme-status';

    navigator.geolocation.getCurrentPosition(function(pos){
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      nearMeBtn.disabled = false;
      nearMeBtn.classList.add('active');
      nearMeIcon.classList.remove('pulsing');
      nearMeText.textContent = 'Sorted by distance';
      nearMeStatus.textContent = 'Showing the closest roles first ✓';
      nearMeStatus.className = 'patch-nearme-status success';
      renderPatchRow();
    }, function(err){
      nearMeBtn.disabled = false;
      nearMeIcon.classList.remove('pulsing');
      nearMeText.textContent = 'Sort by distance from me';
      var msg = 'Could not get your location.';
      if (err.code === 1) msg = 'Location permission denied — enable it in your browser to sort by distance.';
      if (err.code === 2) msg = 'Your location is currently unavailable.';
      if (err.code === 3) msg = 'Location request timed out. Try again.';
      nearMeStatus.textContent = msg;
      nearMeStatus.className = 'patch-nearme-status error';
    }, { enableHighAccuracy:true, timeout:10000 });
  });

  renderChips();
  renderRoster();
  renderPatchTabs();
  renderPatchRow();

  // ===== expose globals for cross-script referral awarding =====
  window.addXP = function(amount, reasonLabel){
    setXP(xp + amount);
    if (typeof showToast === 'function' && reasonLabel){
      showToast('+' + amount + ' XP — ' + reasonLabel);
    }
  };
  window.getReferralLink = function(){
    return myReferralCode ? getReferralLink(myReferralCode) : null;
  };
  window.getReferralCode = function(){ return myReferralCode; };
  window.getReferralCount = function(){
    return storageGet(REFERRAL_COUNT_KEY).then(function(v){ return parseInt(v, 10) || 0; });
  };

  // When this visitor completes signup, if they arrived via someone's
  // invite link, credit that referrer with points the *next* time the
  // referrer's own browser loads (since we can't reach across browsers
  // without a real backend — see note in the referral panel UI).
  window.markReferralConversion = function(){
    return storageGet(REFERRED_BY_KEY);
  };

  getOrCreateReferralCode().then(function(code){
    myReferralCode = code;
  });
})();
