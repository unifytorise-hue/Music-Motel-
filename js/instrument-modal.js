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
          pill.setAttribute('data-search', item.toLowerCase());
          pills.appendChild(pill);
        });
        sub.appendChild(pills);
        catEl.appendChild(sub);
      });

      body.appendChild(catEl);
    });
    document.getElementById('instrument-count').textContent = total;
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

  document.getElementById('open-instruments-btn').addEventListener('click', openModal);
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
})();
