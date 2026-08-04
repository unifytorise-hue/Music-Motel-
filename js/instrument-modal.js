(function(){
  var INSTRUMENT_DATA = [
    {
      id:1, name:'String Instruments', color:'#FF2D78',
      groups:[
        {label:'Bowed Strings', items:['Violin','Viola','Cello','Double Bass','Erhu (China)','Sarangi (India)','Nyckelharpa (Sweden)']},
        {label:'Plucked Strings', items:['Guitar','Bass Guitar','Harp','Banjo','Mandolin','Ukulele','Lute','Sitar (India)','Kora (West Africa)','Zither']},
        {label:'Struck Strings', items:['Piano','Harpsichord','Dulcimer (Hammered)','Cimbalom (Hungary)']}
      ]
    },
    {
      id:2, name:'Wind Instruments', color:'#2BE8D9',
      groups:[
        {label:'Woodwinds', items:['Flute','Piccolo','Clarinet','Oboe','Bassoon','English Horn','Recorder','Saxophone','Shakuhachi (Japan)','Duduk (Armenia)','Pan Flute','Bagpipes']},
        {label:'Brass', items:['Trumpet','Trombone','French Horn','Tuba','Cornet','Flugelhorn','Euphonium','Sousaphone','Bugle']},
        {label:'Free-Reed Instruments', items:['Harmonica','Accordion','Concertina','Sheng (China)','Melodica']},
        {label:'Other Wind Instruments', items:['Didgeridoo (Australia)','Alphorn (Switzerland)','Vuvuzela (South Africa)']}
      ]
    },
    {
      id:3, name:'Percussion Instruments', color:'#FFD319',
      groups:[
        {label:'Pitched Percussion', items:['Xylophone','Marimba','Vibraphone','Glockenspiel','Steel Drums','Timpani','Celesta','Toy Piano']},
        {label:'Unpitched Percussion', items:['Snare Drum','Bass Drum','Tambourine','Triangle','Cymbals','Maracas','Djembe (West Africa)','Congas','Bongo Drums','Cajón (Peru)']},
        {label:'Other Percussion', items:['Tabla (India)','Bodhrán (Ireland)','Claves','Castanets','Gongs']}
      ]
    },
    {
      id:4, name:'Keyboard Instruments', color:'#4ADE80',
      groups:[
        {label:'Acoustic Keyboards', items:['Piano','Organ (Pipe, Electronic)','Harpsichord','Clavichord']},
        {label:'Electronic Keyboards', items:['Synthesizer','Electric Piano','Digital Piano']}
      ]
    },
    {
      id:5, name:'Electronic Instruments', color:'#A66BFF',
      groups:[
        {label:'Electronic', items:['Synthesizers','Drum Machines','Theremin','Electric Guitar','Electric Bass','Sampler','Turntables','MIDI Controllers']}
      ]
    },
    {
      id:6, name:'Other Instruments', color:'#FF9A3D',
      groups:[
        {label:'World & Specialty', items:['Theremin','Glass Harmonica','Hang Drum (Hand-pan)','Hurdy-Gurdy','Kalimba (Mbira)','Didgeridoo',"Jew's Harp",'Ocarina','Baglama (Turkey)','Charango (Andes)']}
      ]
    }
  ];

  var escapeHtml = window.mmEscapeHtml;

  // ===== "instruments I play" persistence — same local/remote split used
  // everywhere else on the site (gig log, following, gear board) =====
  var INSTRUMENTS_KEY = 'my-instruments';
  var siteStorage = window.siteStorage;
  var authReady = window.mmAuthReady || Promise.resolve();

  function isSignedIn(){
    return !!(window.mmSupabaseConfigured && window.mmAuth && window.mmAuth.getUser());
  }

  function loadMyInstrumentsLocal(){
    return siteStorage.get(INSTRUMENTS_KEY)
      .then(function(val){ return val ? JSON.parse(val) : []; })
      .catch(function(){ return []; });
  }
  function saveMyInstrumentsLocal(list){
    return siteStorage.set(INSTRUMENTS_KEY, JSON.stringify(list));
  }
  function loadMyInstrumentsRemote(){
    return window.mmSupabase.from('profiles').select('instruments').eq('id', window.mmAuth.getUser().id).maybeSingle()
      .then(function(res){
        if (res.error || !res.data) return [];
        return res.data.instruments || [];
      })
      .catch(function(){ return []; });
  }
  function saveMyInstrumentsRemote(list){
    return window.mmSupabase.from('profiles').update({ instruments: list }).eq('id', window.mmAuth.getUser().id).then(function(){});
  }

  var myInstruments = [];

  function toggleInstrument(name){
    var idx = myInstruments.indexOf(name);
    if (idx > -1) myInstruments.splice(idx, 1);
    else myInstruments.push(name);

    if (isSignedIn()) saveMyInstrumentsRemote(myInstruments);
    else saveMyInstrumentsLocal(myInstruments);

    applySelectedState();
    renderMyInstrumentsCard();
  }

  function applySelectedState(){
    document.querySelectorAll('.instr-pill').forEach(function(pill){
      pill.classList.toggle('selected', myInstruments.indexOf(pill.getAttribute('data-name')) > -1);
    });
  }

  // Captured once — this placeholder is a child of the list it describes,
  // so re-querying it by id after the first non-empty render would return
  // null (same bug class already fixed elsewhere: js/invite-gig-follow.js,
  // js/booking-requests.js).
  var myInstrumentsEmptyEl = document.getElementById('my-instruments-empty');

  function renderMyInstrumentsCard(){
    var list = document.getElementById('my-instruments-list');
    var countEl = document.getElementById('my-instruments-count');
    if (!list) return;
    if (countEl) countEl.textContent = myInstruments.length + (myInstruments.length === 1 ? ' instrument' : ' instruments');
    if (!myInstruments.length){
      list.innerHTML = '';
      list.appendChild(myInstrumentsEmptyEl);
      return;
    }
    list.innerHTML = '';
    myInstruments.forEach(function(name){
      var tag = document.createElement('span');
      tag.className = 'instr-tag';
      tag.innerHTML = escapeHtml(name) + '<button class="instr-tag-remove" aria-label="Remove ' + escapeHtml(name) + '">✕</button>';
      tag.querySelector('.instr-tag-remove').addEventListener('click', function(){
        toggleInstrument(name);
      });
      list.appendChild(tag);
    });
  }

  authReady.then(function(){
    var loader = isSignedIn() ? loadMyInstrumentsRemote() : loadMyInstrumentsLocal();
    return loader.then(function(list){
      myInstruments = list;
      renderMyInstrumentsCard();
      applySelectedState();
    });
  });

  // ===== instrument directory modal =====
  function renderInstruments(){
    var body = document.getElementById('instrument-body');
    body.innerHTML = '';
    var total = 0;
    INSTRUMENT_DATA.forEach(function(cat){
      total += cat.groups.reduce(function(sum, g){ return sum + g.items.length; }, 0);
      var catEl = document.createElement('div');
      catEl.className = 'instr-category';
      catEl.setAttribute('data-cat-id', cat.id);
      catEl.style.setProperty('--cat-color', cat.color);

      var head = document.createElement('div');
      head.className = 'instr-cat-head';
      var groupItemCount = cat.groups.reduce(function(s,g){return s+g.items.length;}, 0);
      head.innerHTML = '<span class="instr-cat-num">' + cat.id + '</span><h3>' + cat.name + '</h3><span class="icount">' + groupItemCount + ' total</span>';
      catEl.appendChild(head);

      cat.groups.forEach(function(group){
        var sub = document.createElement('div');
        sub.className = 'instr-subgroup';
        var label = document.createElement('div');
        label.className = 'instr-sub-label';
        label.textContent = group.label;
        sub.appendChild(label);
        var pills = document.createElement('div');
        pills.className = 'instr-pills';
        group.items.forEach(function(item){
          var pill = document.createElement('span');
          pill.className = 'instr-pill';
          pill.textContent = item;
          pill.setAttribute('data-name', item);
          // Includes the category/subgroup names, not just the item itself
          // — otherwise searching "keyboard" finds nothing, since no
          // individual instrument in the Keyboard Instruments category is
          // literally named "Keyboard" (Piano, Organ, Synthesizer, etc.).
          pill.setAttribute('data-search', (cat.name + ' ' + group.label + ' ' + item).toLowerCase());
          pill.setAttribute('role', 'button');
          pill.setAttribute('tabindex', '0');
          pills.appendChild(pill);
        });
        sub.appendChild(pills);
        catEl.appendChild(sub);
      });

      body.appendChild(catEl);
    });
    document.getElementById('instrument-count').textContent = total;
    applySelectedState();
  }

  function filterInstruments(query){
    var q = query.trim().toLowerCase();
    var anyVisible = false;
    document.querySelectorAll('.instr-category').forEach(function(catEl){
      var catHasMatch = false;
      catEl.querySelectorAll('.instr-subgroup').forEach(function(subEl){
        var subHasMatch = false;
        subEl.querySelectorAll('.instr-pill').forEach(function(pill){
          var matches = q === '' || pill.getAttribute('data-search').indexOf(q) > -1;
          pill.classList.toggle('hidden', !matches);
          if (matches) subHasMatch = true;
        });
        subEl.classList.toggle('hidden', !subHasMatch);
        if (subHasMatch) catHasMatch = true;
      });
      catEl.classList.toggle('hidden', !catHasMatch);
      if (catHasMatch) anyVisible = true;
    });
    document.getElementById('modal-empty').classList.toggle('show', !anyVisible);
  }

  function openModal(){
    document.getElementById('instrument-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    var input = document.getElementById('instrument-search');
    input.value = '';
    filterInstruments('');
    setTimeout(function(){
      input.focus();
      if (window.trapFocus) window.trapFocus(document.getElementById('instrument-modal'));
    }, 50);
  }

  function closeModal(){
    document.getElementById('instrument-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window.releaseFocusTrap) window.releaseFocusTrap();
  }

  renderInstruments();

  // The roles/categories section used to have its own "see all 100+
  // instruments" entry point into this same modal — removed since it read
  // as an unrelated reference tool out there, when this has always
  // actually been the personal "pick what you play" picker (see
  // toggleInstrument below). #edit-instruments-btn, in the fan dashboard's
  // own "Your instruments" card, is the one real entry point now.
  var editBtn = document.getElementById('edit-instruments-btn');
  if (editBtn) editBtn.addEventListener('click', openModal);
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('instrument-modal').addEventListener('click', function(e){
    if (e.target.id === 'instrument-modal') closeModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('instrument-modal').classList.contains('open')) closeModal();
  });
  document.getElementById('instrument-search').addEventListener('input', function(e){
    filterInstruments(e.target.value);
  });

  // Pills have a hover affordance (colored border, lift) implying they're
  // clickable. Tapping one now toggles it onto the member's own profile —
  // this is the actual "select the instruments you play" flow, not just a
  // browsable reference list.
  document.getElementById('instrument-body').addEventListener('click', function(e){
    var pill = e.target.closest('.instr-pill');
    if (!pill) return;
    toggleInstrument(pill.getAttribute('data-name'));
  });
  document.getElementById('instrument-body').addEventListener('keydown', function(e){
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var pill = e.target.closest('.instr-pill');
    if (!pill) return;
    e.preventDefault();
    toggleInstrument(pill.getAttribute('data-name'));
  });
})();
