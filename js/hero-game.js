(function(){
  // ===== data =====
  var COLORS = ['#FF2D78','#2BE8D9','#FFD319','#4ADE80','#A66BFF','#FF9A3D','#FF4D4D'];

  // ===== storage abstraction =====
  // Shared module defined once, near the top of the file (see the script
  // block right after the focus-trap utility).
  var storageGet = window.siteStorage.get;
  var storageSet = window.siteStorage.set;
  var configured = window.mmConfigured;
  var escapeHtmlMatch = window.mmEscapeHtml;

  // Referral-code generation, the invite link, and incoming-referral
  // detection now live in js/referral.js, loaded on every page — the
  // "Invite & earn XP" card that displays/copies the link lives on
  // profile.html now, not here. This file keeps only the parts that are
  // only ever triggered from index.html's own signup flow.
  var REFERRAL_COUNT_KEY = 'referral-signup-count';
  var REFERRED_BY_KEY = 'referred-by-code';

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

  // Maps each (performer-title) ROLES name to the real instrument-picker
  // vocabulary used in js/instrument-modal.js (e.g. "Guitarist" ->
  // "Guitar"), plus a couple of extra terms for roles that live in
  // role_label free text rather than the instruments list (Vocalist,
  // Producer, Sound Engineer, etc. — nobody picks "Vocals" from an
  // instrument picker). Used by loadRealMatchesForBand() below to turn a
  // tapped role into an actual search against real profiles.
  var ROLE_SEARCH_TERMS = {
    'Vocalist': ['vocal', 'singer', 'vocalist'],
    'Guitarist': ['guitar'],
    'Bassist': ['bass guitar', 'electric bass', 'bass'],
    'Drummer': ['drum', 'percussion'],
    'Keyboardist': ['piano', 'keyboard', 'synth', 'organ'],
    'Violinist': ['violin'],
    'Cellist': ['cello'],
    'Double Bassist': ['double bass'],
    'Harpist': ['harp'],
    'Banjo Player': ['banjo'],
    'Mandolinist': ['mandolin'],
    'Ukulele Player': ['ukulele'],
    'Sitar Player': ['sitar'],
    'Saxophonist': ['saxophone'],
    'Flutist': ['flute'],
    'Clarinetist': ['clarinet'],
    'Oboist': ['oboe'],
    'Bassoonist': ['bassoon'],
    'Bagpiper': ['bagpipe'],
    'Trumpeter': ['trumpet'],
    'Trombonist': ['trombone'],
    'French Horn Player': ['french horn'],
    'Tuba Player': ['tuba'],
    'Percussionist': ['percussion', 'drum'],
    'Djembe Player': ['djembe'],
    'Vibraphonist': ['vibraphone'],
    'Marimba Player': ['marimba'],
    'DJ': ['turntable', 'dj'],
    'Synth Player': ['synth'],
    'Turntablist': ['turntable'],
    'Producer': ['producer'],
    'Sound Engineer': ['sound engineer', 'engineer'],
    'Accordionist': ['accordion'],
    'Harmonica Player': ['harmonica'],
    'Kora Player': ['kora'],
    'Steel Drum Player': ['steel drum'],
    'Songwriter': ['songwriter', 'writer'],
    'Composer': ['composer'],
    'Tour Manager': ['tour manager'],
    'A&R': ['a&r', 'a and r']
  };

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
          {title:'Backing vocals — Brooklyn Steel headline show', detail:'Three-night run, two original songs co-written on the spot.', xp:60, date:'Jun 2026'},
          {title:'Studio feature — "Quiet Static" single', detail:'Lead vocal feature for an independent electronic producer.', xp:40, date:'Feb 2026'},
          {title:'Wedding & private event singer', detail:'Solo acoustic sets, 30+ bookings over the past year.', xp:25, date:'Ongoing since 2024'}
        ]}},
    {name:'Bassists', loc:'Midrand, ZA', cat:'perform', color:'#FF2D78', lat:-25.9992, lng:28.1267,
      person:{ name:'Naledi Khumalo', role:'Session Bassist', strength:82,
        bio:'Session and touring bassist with a background in jazz and Afrobeat. Comfortable with upright and electric, reads charts on first pass.',
        badges:[{label:'Verified', icon:'✓'},{label:'Touring', icon:'★'},{label:'40+ Gigs', icon:'♪'}],
        gigs:[
          {title:'Backline support — Joburg Jazz Fest', detail:'Three-night residency, full live recording linked on profile.', xp:50, date:'Apr 2026'},
          {title:'Studio session — "Skylines" EP', detail:'Bass tracking for an independent R&B release, credited.', xp:30, date:'Jan 2026'},
          {title:'Touring bassist — regional support act', detail:'14-date run, available for similar bookings on request.', xp:80, date:'Oct 2025'}
        ]}},
    {name:'Guitarists', loc:'Austin, US', cat:'perform', color:'#FF2D78', lat:30.2672, lng:-97.7431,
      person:{ name:'Jonah Reyes', role:'Guitarist / Multi-instrumentalist', strength:71,
        bio:'Texas blues-rock guitarist doubling on pedal steel. Plays weekly residencies around East Austin and takes select touring offers.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Weekly residency — Continental Club', detail:'Standing Tuesday slot, house band plus rotating guests.', xp:45, date:'Ongoing since 2025'},
          {title:'Session work — local Americana releases', detail:'Pedal steel and lead guitar on three EPs this year.', xp:35, date:'2025'}
        ]}},
    {name:'Session Drummers', loc:'London, UK', cat:'perform', color:'#FF2D78', lat:51.5074, lng:-0.1278,
      person:{ name:'Priya Anand', role:'Session Drummer', strength:74,
        bio:'Session drummer across pop, soul, and broken beat. Owns a fully mic\'d kit and home studio for remote tracking.',
        badges:[{label:'Verified', icon:'✓'},{label:'Remote Ready', icon:'mic'}],
        gigs:[
          {title:'Remote tracking — three-track EP', detail:'Drums recorded and stems delivered within 48 hours.', xp:30, date:'May 2026'},
          {title:'Live support — UK club tour', detail:'8-date run backing a touring soul artist.', xp:55, date:'Nov 2025'}
        ]}},
    {name:'Sound Engineers', loc:'Mumbai, IN', cat:'production', color:'#2BE8D9', lat:19.0760, lng:72.8777,
      person:{ name:'Arjun Mehta', role:'Live Sound Engineer', strength:69,
        bio:'FOH and monitor engineer for mid-size venues and festivals across Maharashtra. Comfortable with both analog and digital consoles.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'FOH — regional music festival', detail:'Three-stage festival, managed front-of-house for the main stage.', xp:60, date:'Jul 2026'},
          {title:'Monitor engineer — touring act', detail:'12-date support tour across western India.', xp:45, date:'Mar 2026'}
        ]}},
    {name:'Mixing Engineers', loc:'Lagos, NG', cat:'production', color:'#2BE8D9', lat:6.5244, lng:3.3792,
      person:{ name:'Chidi Okafor', role:'Mixing Engineer', strength:80,
        bio:'Afrobeats and amapiano mixing engineer. Worked on tracks that charted regionally; open to remote mixing for international artists.',
        badges:[{label:'Verified', icon:'✓'},{label:'Remote Ready', icon:'mic'}],
        gigs:[
          {title:'Mix credit — regional chart single', detail:'Full mix and light mastering for an Afrobeats single.', xp:70, date:'May 2026'},
          {title:'EP mixing — independent artist', detail:'Five-track EP, turnaround within two weeks.', xp:40, date:'Feb 2026'}
        ]}},
    {name:'Producers', loc:'Atlanta, US', cat:'production', color:'#2BE8D9', lat:33.7490, lng:-84.3880,
      person:{ name:'Marcus Bell', role:'Music Producer', strength:76,
        bio:'Trap and R&B producer running a home studio in Atlanta. Built beats for independent rappers and is opening up session slots.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Production — independent rap EP', detail:'Produced and mixed a six-track project, released independently.', xp:50, date:'Dec 2025'},
          {title:'Beat placement — regional artist single', detail:'One placement on a single with regional radio play.', xp:35, date:'Sep 2025'}
        ]}},
    {name:'Mastering Engineers', loc:'Berlin, DE', cat:'production', color:'#2BE8D9', lat:52.5200, lng:13.4050,
      person:{ name:'Lena Vogel', role:'Mastering Engineer', strength:85,
        bio:'Mastering engineer for electronic and techno labels across Berlin. Vinyl-aware mastering, fast turnaround for label deadlines.',
        badges:[{label:'Verified', icon:'✓'},{label:'Remote Ready', icon:'mic'}],
        gigs:[
          {title:'Label mastering — techno EP series', detail:'Ongoing mastering relationship with a Berlin techno label.', xp:55, date:'Ongoing since 2025'},
          {title:'Vinyl pre-master — independent release', detail:'Prepared masters specifically for vinyl cut.', xp:30, date:'Apr 2026'}
        ]}},
    {name:'Tour Managers', loc:'Berlin, DE', cat:'business', color:'#FFD319', lat:52.5200, lng:13.4050,
      person:{ name:'Felix Hartmann', role:'Tour Manager', strength:73,
        bio:'Tour manager for mid-size touring acts across the EU. Handles logistics, advancing, and budgets from a single point of contact.',
        badges:[{label:'Verified', icon:'✓'},{label:'Touring', icon:'★'}],
        gigs:[
          {title:'EU tour management — 22 dates', detail:'Full logistics and advancing for a six-week European tour.', xp:90, date:'Jun 2026'},
          {title:'Festival routing — summer run', detail:'Coordinated routing for five festival appearances.', xp:40, date:'Jul 2026'}
        ]}},
    {name:'Artist Managers', loc:'Los Angeles, US', cat:'business', color:'#FFD319', lat:34.0522, lng:-118.2437,
      person:{ name:'Simone Carter', role:'Artist Manager', strength:77,
        bio:'Manages a small, intentional roster of independent artists. Focused on sync placements and sustainable touring, not overnight hype.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Sync placement — streaming series', detail:'Landed a placement for a client track in a streaming original.', xp:65, date:'Mar 2026'},
          {title:'Roster development — independent artist', detail:'Guided release strategy for a debut EP rollout.', xp:35, date:'Jan 2026'}
        ]}},
    {name:'Booking Agents', loc:'Toronto, CA', cat:'business', color:'#FFD319', lat:43.6532, lng:-79.3832,
      person:{ name:'Owen Fraser', role:'Booking Agent', strength:70,
        bio:'Books club and mid-size venue shows across Ontario and Quebec for indie and emerging acts.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Regional tour booking — 10 dates', detail:'Booked a club tour across Ontario and Quebec.', xp:50, date:'May 2026'},
          {title:'Festival slot booking', detail:'Secured a mid-stage slot at a regional summer festival.', xp:30, date:'Jul 2026'}
        ]}},
    {name:'Music Publishers', loc:'Paris, FR', cat:'business', color:'#FFD319', lat:48.8566, lng:2.3522,
      person:{ name:'Camille Dubois', role:'Music Publisher', strength:81,
        bio:'Independent publisher representing songwriters across pop and film/TV sync. Based in Paris, works internationally.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Sync placement — European TV drama', detail:'Placed a catalogue track in a recurring TV series.', xp:60, date:'Feb 2026'},
          {title:'Co-publishing deal — emerging songwriter', detail:'Signed and began administering a new songwriter catalogue.', xp:40, date:'Nov 2025'}
        ]}},
    {name:'Music Therapists', loc:'Toronto, CA', cat:'support', color:'#4ADE80', lat:43.6532, lng:-79.3832,
      person:{ name:'Dr. Hannah Lee', role:'Music Therapist', strength:88,
        bio:'Registered music therapist working with both pediatric and elder-care settings. Also offers sessions for performing musicians managing performance anxiety.',
        badges:[{label:'Verified', icon:'✓'},{label:'Licensed', icon:'graduation'}],
        gigs:[
          {title:'Hospital program — pediatric ward', detail:'Weekly sessions as part of an ongoing hospital arts program.', xp:50, date:'Ongoing since 2024'},
          {title:'Performance anxiety workshop', detail:'Ran a workshop series for a local conservatory\'s performance majors.', xp:35, date:'Mar 2026'}
        ]}},
    {name:'Luthiers', loc:'Cremona, IT', cat:'support', color:'#4ADE80', lat:45.1333, lng:10.0333,
      person:{ name:'Giulia Ferrari', role:'Luthier — String Instrument Maker', strength:90,
        bio:'Third-generation luthier in Cremona\'s violin-making tradition. Builds and restores violins, violas, and cellos for working musicians and collectors.',
        badges:[{label:'Verified', icon:'✓'},{label:'Master Craft', icon:'trophy'}],
        gigs:[
          {title:'Commissioned violin build', detail:'Hand-built violin commissioned by a touring soloist.', xp:90, date:'Jan 2026'},
          {title:'Restoration — 19th century cello', detail:'Full structural restoration of a damaged antique cello.', xp:70, date:'Sep 2025'}
        ]}},
    {name:'Stage Managers', loc:'Sydney, AU', cat:'support', color:'#4ADE80', lat:-33.8688, lng:151.2093,
      person:{ name:'Liam O\'Brien', role:'Stage Manager', strength:72,
        bio:'Stage manager for theatre and live music productions across Sydney. Calm under pressure, meticulous with run-of-show docs.',
        badges:[{label:'Verified', icon:'✓'}],
        gigs:[
          {title:'Stage management — touring musical', detail:'Managed a 6-week regional run of a touring musical production.', xp:65, date:'Apr 2026'},
          {title:'Festival stage management', detail:'Ran a secondary stage across a 3-day music festival.', xp:45, date:'Jul 2026'}
        ]}},
    {name:'Piano Tuners', loc:'Vienna, AT', cat:'support', color:'#4ADE80', lat:48.2082, lng:16.3738,
      person:{ name:'Stefan Gruber', role:'Piano Tuner & Technician', strength:84,
        bio:'Trained piano technician maintaining concert hall and conservatory instruments across Vienna, including historical instrument restoration.',
        badges:[{label:'Verified', icon:'✓'},{label:'Master Craft', icon:'trophy'}],
        gigs:[
          {title:'Concert hall maintenance contract', detail:'Ongoing tuning and voicing for a chamber music venue.', xp:55, date:'Ongoing since 2023'},
          {title:'Historical instrument restoration', detail:'Restored a 1920s grand piano for a private collector.', xp:75, date:'Oct 2025'}
        ]}}
  ];

  // Lets other scripts (following) resolve a slugified id back to a
  // sample person's display info, since the follows table only stores the
  // slug/uuid, not the name/role/color needed to render a follow-list row.
  var samplePeopleBySlug = {};
  PATCH_JACKS.forEach(function(jack){
    var p = jack.person;
    if (!p) return;
    var slug = p.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    samplePeopleBySlug[slug] = { name: p.name, role: p.role, loc: jack.loc, color: jack.color };
  });
  window.getSamplePersonBySlug = function(slug){ return samplePeopleBySlug[slug]; };

  var xp = 0;
  var band = [];

  // Signed-in users see their real, server-computed XP (from js/real-xp.js)
  // in the nav pill instead — this local band-builder game is a no-stakes
  // homepage toy that shouldn't be able to overwrite that with a
  // click-as-many-times-as-you-like number.
  function realXPActive(){
    return !!(window.mmSupabaseConfigured && window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser());
  }

  function setXP(n){
    xp = n;
    if (!realXPActive()) document.getElementById('nav-xp').textContent = xp;
    storageSet('total-xp', String(xp));
  }

  // load any previously saved XP on page load
  storageGet('total-xp').then(function(saved){
    if (saved){
      xp = parseInt(saved, 10) || 0;
      if (!realXPActive()) document.getElementById('nav-xp').textContent = xp;
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
      // Someone already signed in doesn't need the signup modal — the game
      // is just for visitors deciding whether to join.
      var alreadySignedIn = !!(window.mmSupabaseConfigured && window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser());
      if (!alreadySignedIn){
        setTimeout(function(){
          if (typeof window.openSignup === 'function') window.openSignup();
        }, 1700);
      }
    }
  }

  var escapeHtmlGame = window.mmEscapeHtml;

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
  // Other modules (password-reset.js) reuse this instead of a native
  // alert() — alert()'s full-domain "site says" chrome on mobile browsers
  // is jarring, and this toast already exists on every page that needs it.
  window.showToast = showToast;

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
    loadRealMatchesForBand();
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
    loadRealMatchesForBand();
    // Look the chip up by its data-idx (set once in renderChips) rather than
    // substring-matching textContent — exact and immune to name collisions
    // (e.g. "Bassist" vs "Double Bassist") regardless of ROLES ordering.
    var chip = document.querySelector('.chip[data-idx="' + removed.roleIdx + '"]');
    if (chip) chip.classList.remove('added');
  }

  // ===== real matches: turns the fantasy "band" into an actual, live
  // search — every role recruited above queries real registered profiles
  // (not the fictional ROLES data), same as a signed-in visitor would get
  // from the nearby-players search on their dashboard, but it works for
  // signed-out visitors too (this runs on the public homepage) and needs
  // no follow-graph, since mmCanViewProfile() already handles the
  // signed-out case (public profiles only) on its own. =====
  var realMatchesReqId = 0;
  function loadRealMatchesForBand(){
    var panel = document.getElementById('band-real-matches');
    var list = document.getElementById('band-real-matches-list');
    if (!panel || !list) return;

    if (!band.length){
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';

    if (!configured() || !window.mmSupabase){
      list.innerHTML = '<p class="band-real-matches-empty">Live matches need the site\'s backend connected — this is a preview build.</p>';
      return;
    }

    var thisReq = ++realMatchesReqId;
    list.innerHTML = '<p class="band-real-matches-empty">Searching…</p>';

    var terms = [];
    band.forEach(function(member){
      (ROLE_SEARCH_TERMS[member.name] || [member.name.toLowerCase()]).forEach(function(t){
        if (terms.indexOf(t) === -1) terms.push(t);
      });
    });

    window.mmSupabase.from('profiles')
      .select('id,name,account_type,role_label,bio,location_label,lat,lng,avatar_color,avatar_url,profile_kind,instruments,availability_status,availability_until,profile_visibility,hide_exact_location,hide_rate')
      .then(function(res){
        if (thisReq !== realMatchesReqId) return; // a newer search superseded this one
        var rows = res.data || [];
        var matches = rows.filter(function(p){
          if (!window.mmCanViewProfile(p, null, null)) return false;
          var haystacks = (p.instruments || []).map(function(i){ return i.toLowerCase(); });
          if (p.role_label) haystacks.push(p.role_label.toLowerCase());
          return terms.some(function(term){
            return haystacks.some(function(h){ return h.indexOf(term) !== -1 || term.indexOf(h) !== -1; });
          });
        });
        matches.forEach(function(p){
          p._distanceKm = (userLocation && p.lat != null && p.lng != null)
            ? haversineKm(userLocation.lat, userLocation.lng, p.lat, p.lng)
            : null;
        });
        matches.sort(function(a, b){
          if (a._distanceKm == null && b._distanceKm == null) return a.name.localeCompare(b.name);
          if (a._distanceKm == null) return 1;
          if (b._distanceKm == null) return -1;
          return a._distanceKm - b._distanceKm;
        });
        renderRealMatches(matches.slice(0, 6));
      })
      .catch(function(){
        if (thisReq !== realMatchesReqId) return;
        list.innerHTML = '<p class="band-real-matches-empty">Could not load live matches right now.</p>';
      });
  }

  function renderRealMatches(matches){
    var list = document.getElementById('band-real-matches-list');
    if (!list) return;
    if (!matches.length){
      list.innerHTML = '<p class="band-real-matches-empty">No registered profiles match your recruited roles yet' +
        (userLocation ? ' near this location' : '') + ' — be the first.</p>';
      return;
    }
    list.innerHTML = '';
    if (!userLocation){
      var hint = document.createElement('p');
      hint.className = 'band-real-matches-hint';
      hint.textContent = 'Set a location in the search box → to sort these by distance.';
      list.appendChild(hint);
    }
    matches.forEach(function(p){
      var row = document.createElement('div');
      row.className = 'band-real-match-row';
      row.style.setProperty('--match-color', p.avatar_color || '#9B3FC4');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      var distanceHtml = p._distanceKm != null ? '<span class="band-real-match-distance">' + escapeHtmlMatch(formatDistance(p._distanceKm)) + '</span>' : '';
      row.innerHTML =
        '<span class="band-real-match-avatar" data-avatar></span>' +
        '<span class="band-real-match-meta">' +
          '<span class="band-real-match-name">' + escapeHtmlMatch(p.name || 'Unnamed profile') + '</span>' +
          '<span class="band-real-match-role">' + escapeHtmlMatch(p.role_label || '') + '</span>' +
        '</span>' +
        distanceHtml;
      if (window.mmRenderAvatar) window.mmRenderAvatar(row.querySelector('[data-avatar]'), p.avatar_url, p.avatar_color, p.name);
      function open(){ if (window.openRealProfile) window.openRealProfile(p, p._distanceKm); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); } });
      list.appendChild(row);
    });
  }

  // ===== patch bay =====
  var activeCat = 'all';

  // Lets other scripts (the clickable ecosystem diagram — see
  // js/ecosystem-map.js) drive the same category filter as clicking a tab
  // directly, without duplicating the tab-rendering/PATCH_JACKS filtering
  // logic that already lives here.
  window.mmSetPatchCategory = function(catId){
    if (!PATCH_CATEGORIES.some(function(c){ return c.id === catId; })) return;
    activeCat = catId;
    renderPatchTabs();
    renderPatchRow();
  };

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
      // jack.name is the plural search-category label ("Artist Managers")
      // — right for a category tile, wrong as one specific person's own
      // role, which should read as a singular job title.
      var roleSubtitle = jack.person ? '<span class="jack-role-sub">' + jack.person.role + '</span>' : '';
      el.setAttribute('aria-label', jack.person ? 'View profile for ' + jack.person.name : 'Search for ' + jack.name);
      // No profile-photo upload exists yet, so person.photoUrl is always
      // unset today — this just means every avatar falls back to the
      // silhouette icon for now, without needing a follow-up change once
      // photo uploads do exist.
      var avatarInner = (jack.person && jack.person.photoUrl)
        ? '<img src="' + jack.person.photoUrl + '" alt="">'
        : (window.mmIcon ? window.mmIcon('user') : '');
      // PATCH_JACKS is hardcoded sample data, not real registered profiles —
      // this tape marks every card here as an example so it doesn't read as
      // a real person on the platform.
      el.innerHTML = '<div class="jack-example-tape">Example</div>' +
        '<div class="jack-main"><div class="jhead"><span class="jplug"></span><div><span class="jname">' + displayName + '</span>' + roleSubtitle + '</div></div>' + distHtml + '</div>' +
        '<div class="jack-avatar">' + avatarInner + '</div>';
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
  // Tracks whether userLocation came from the GPS button or the city
  // search box, so the "Sort by distance from me" button only toggles
  // itself off — clicking it while a searched city is active should
  // request GPS and override the search, not clear it silently.
  var locationSource = null;

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
  window.mmHaversineKm = haversineKm;

  function formatDistance(km){
    if (window.mmFormatDistanceKm) return window.mmFormatDistanceKm(km);
    if (km < 1) return '<1 km away';
    if (km < 10) return Math.round(km) + ' km away';
    return Math.round(km / 10) * 10 + ' km away';
  }

  var nearMeBtn = document.getElementById('patch-nearme-btn');
  var nearMeIcon = document.getElementById('patch-nearme-icon');
  var nearMeText = document.getElementById('patch-nearme-text');
  var nearMeStatus = document.getElementById('patch-nearme-status');

  nearMeBtn.addEventListener('click', function(){
    if (userLocation && locationSource === 'me'){
      // toggle off
      userLocation = null;
      locationSource = null;
      nearMeBtn.classList.remove('active');
      nearMeText.textContent = 'Sort by distance from me';
      nearMeStatus.textContent = '';
      nearMeStatus.className = 'patch-nearme-status';
      renderPatchRow();
      loadRealMatchesForBand();
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
      locationSource = 'me';
      if (patchLocInput) patchLocInput.value = '';
      nearMeBtn.disabled = false;
      nearMeBtn.classList.add('active');
      nearMeIcon.classList.remove('pulsing');
      nearMeText.textContent = 'Sorted by distance';
      nearMeStatus.textContent = 'Showing the closest roles first ✓';
      nearMeStatus.className = 'patch-nearme-status success';
      renderPatchRow();
      loadRealMatchesForBand();
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

  // ===== search any city (reuses the shared window.mmNominatimSearch —
  // see the rate-limit note next to its definition in js/mm-utils.js) =====
  var patchLocInput = document.getElementById('patch-loc-search-input');
  var patchLocSuggestions = document.getElementById('patch-loc-suggestions');
  var patchLocDebounce;

  var escapeHtmlPatchLoc = window.mmEscapeHtml;

  if (patchLocInput && patchLocSuggestions){
    patchLocInput.addEventListener('input', function(){
      var q = patchLocInput.value.trim();
      clearTimeout(patchLocDebounce);
      if (q.length < 2){
        patchLocSuggestions.classList.remove('show');
        return;
      }
      patchLocDebounce = setTimeout(function(){ runPatchCitySearch(q); }, 350);
    });

    document.addEventListener('click', function(e){
      if (!e.target.closest('.patch-loc-search-wrap')) patchLocSuggestions.classList.remove('show');
    });
  }

  function runPatchCitySearch(query){
    window.mmNominatimSearch(query)
      .then(function(results){ renderPatchLocSuggestions(results, query); })
      .catch(function(){
        nearMeStatus.textContent = 'Could not reach the location service — check your connection and try again.';
        nearMeStatus.className = 'patch-nearme-status error';
        patchLocSuggestions.classList.remove('show');
      });
  }

  function renderPatchLocSuggestions(results, query){
    patchLocSuggestions.innerHTML = '';
    if (!results || !results.length){
      patchLocSuggestions.classList.remove('show');
      nearMeStatus.textContent = 'No matches for "' + query + '". Try a different spelling.';
      nearMeStatus.className = 'patch-nearme-status error';
      return;
    }
    results.forEach(function(r){
      var label = window.mmNominatimResultLabel(r);
      var mainName = label.mainName, region = label.region;
      var item = document.createElement('div');
      item.className = 'loc-suggestion-item';
      item.innerHTML = '<div class="city-main">' + escapeHtmlPatchLoc(mainName) + '</div><div class="city-sub">' + escapeHtmlPatchLoc(region) + '</div>';
      item.addEventListener('click', function(){
        var label = region ? (mainName + ', ' + region) : mainName;
        userLocation = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
        locationSource = 'search';
        patchLocInput.value = label;
        patchLocSuggestions.classList.remove('show');
        nearMeBtn.classList.add('active');
        nearMeText.textContent = 'Sorted by distance';
        nearMeStatus.textContent = 'Showing roles closest to ' + label + ' ✓';
        nearMeStatus.className = 'patch-nearme-status success';
        renderPatchRow();
        loadRealMatchesForBand();
      });
      patchLocSuggestions.appendChild(item);
    });
    patchLocSuggestions.classList.add('show');
  }

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
  window.getReferralCount = function(){
    return storageGet(REFERRAL_COUNT_KEY).then(function(v){ return parseInt(v, 10) || 0; });
  };

  // Called right after a real signup succeeds, so this visitor's own
  // invite code (generated locally on page load, before they had an
  // account) becomes a real referral_codes row and actually survives
  // across devices from here on — otherwise it would stay local-only for
  // the rest of this browser session, since the local/remote choice above
  // is only made once, at page load. getReferralCode/mmGenerateReferralCode/
  // mmSetReferralCode all come from js/referral.js.
  window.syncReferralCodeForUser = function(userId){
    if (!(window.mmSupabaseConfigured && window.mmSupabase)) return Promise.resolve();
    return window.mmSupabase.from('referral_codes').select('code').eq('user_id', userId).maybeSingle().then(function(res){
      if (res.data && res.data.code) return res.data.code;
      var existing = window.getReferralCode && window.getReferralCode();
      var codeToUse = existing || (window.mmGenerateReferralCode && window.mmGenerateReferralCode());
      return window.mmSupabase.from('referral_codes').insert({ user_id: userId, code: codeToUse }).then(function(insertRes){
        return insertRes.error ? existing : codeToUse;
      });
    }).then(function(code){
      if (!code) return;
      if (window.mmSetReferralCode) window.mmSetReferralCode(code);
    }).catch(function(){});
  };

  // Called right after a real signup succeeds. If this visitor arrived via
  // someone's invite link, look up the referrer's real referral_codes row
  // and record the conversion in referrals — this is the part that
  // actually works across devices, unlike the local-only XP bonus above.
  window.recordReferralIfAny = function(newUserId){
    if (!(window.mmSupabaseConfigured && window.mmSupabase)) return Promise.resolve();
    return storageGet(REFERRED_BY_KEY).then(function(code){
      if (!code) return;
      return window.mmSupabase.from('referral_codes').select('user_id').eq('code', code).maybeSingle().then(function(res){
        if (res.error || !res.data) return;
        var referrerId = res.data.user_id;
        if (referrerId === newUserId) return;
        return window.mmSupabase.from('referrals').insert({
          referred_user_id: newUserId,
          referrer_user_id: referrerId
        });
      });
    }).catch(function(){});
  };

})();
