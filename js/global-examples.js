(function(){
  // Illustrative sample profiles for the homepage "How it works" demo card
  // — same honesty pattern as the old single "Naledi K." card (see the
  // .profile-fake-note caption above the tabs in index.html), just spread
  // across a few continents instead of one, to show the directory works
  // the same way everywhere rather than claiming any founding country.
  var EXAMPLES = [
    {
      tab: 'South Africa',
      name: 'Naledi K.',
      role: 'Session Bassist · Midrand, South Africa',
      color: '#FF2D78',
      strength: 82,
      badges: [
        { cls: 'b-verified', label: '✓ Verified' },
        { cls: 'b-touring', label: '★ Touring' },
        { cls: 'b-gigs', label: '♪ 40+ Gigs' }
      ],
      feed: [
        { color: 'var(--pink)', title: 'Backline support — Joburg Jazz Fest', detail: 'Three-night residency, full live recording linked on profile.', xp: 50 },
        { color: 'var(--cyan)', title: 'Studio session — "Skylines" EP', detail: 'Bass tracking for an independent R&B release, credited.', xp: 30 },
        { color: 'var(--yellow)', title: 'Touring bassist — regional support act', detail: '14-date run, available for similar bookings on request.', xp: 80 }
      ]
    },
    {
      tab: 'Japan',
      name: 'Kenji T.',
      role: 'Mixing Engineer · Osaka, Japan',
      color: '#2BE8D9',
      strength: 76,
      badges: [
        { cls: 'b-verified', label: '✓ Verified' },
        { cls: 'b-touring', label: '★ Remote Ready' },
        { cls: 'b-gigs', label: '♪ 25+ Projects' }
      ],
      feed: [
        { color: 'var(--cyan)', title: 'Remote mix — city-pop revival single', detail: 'Full mix and stem delivery within 5 days, credited on release.', xp: 40 },
        { color: 'var(--purple)', title: 'Live-to-tape session — jazz trio', detail: 'On-site mixing for a one-take studio recording.', xp: 35 },
        { color: 'var(--green)', title: 'Mastering pass — indie EP', detail: 'Final master delivered in three loudness variants.', xp: 25 }
      ]
    },
    {
      tab: 'Brazil',
      name: 'Sofia R.',
      role: 'Vocalist · São Paulo, Brazil',
      color: '#FFD319',
      strength: 88,
      badges: [
        { cls: 'b-verified', label: '✓ Verified' },
        { cls: 'b-touring', label: '★ Touring' },
        { cls: 'b-gigs', label: '♪ 60+ Gigs' }
      ],
      feed: [
        { color: 'var(--yellow)', title: 'Headline set — Bar Brahma showcase', detail: 'Sold-out 90-minute set with a five-piece backing band.', xp: 70 },
        { color: 'var(--pink)', title: 'Feature vocals — samba-fusion single', detail: 'Lead vocal take for an independent producer\'s release.', xp: 45 },
        { color: 'var(--cyan)', title: 'Regional tour — support act', detail: '10-date run across three states, available for more.', xp: 90 }
      ]
    },
    {
      tab: 'Nigeria',
      name: 'Amara O.',
      role: 'Music Educator · Lagos, Nigeria',
      color: '#4ADE80',
      strength: 71,
      badges: [
        { cls: 'b-verified', label: '✓ Verified' },
        { cls: 'b-touring', label: '★ Mentor' },
        { cls: 'b-gigs', label: '♪ 15+ Students' }
      ],
      feed: [
        { color: 'var(--green)', title: 'Weekend vocal workshop — youth choir', detail: 'Ran a 12-student workshop on breath control and harmony.', xp: 30 },
        { color: 'var(--yellow)', title: 'One-on-one coaching — audition prep', detail: 'Six-week coaching program ahead of a conservatory audition.', xp: 40 },
        { color: 'var(--purple)', title: 'Guest lecture — music theory basics', detail: 'Invited session at a community arts center.', xp: 20 }
      ]
    },
    {
      tab: 'United Kingdom',
      name: 'Liam H.',
      role: 'Tour Manager · Manchester, UK',
      color: '#A66BFF',
      strength: 79,
      badges: [
        { cls: 'b-verified', label: '✓ Verified' },
        { cls: 'b-touring', label: '★ Logistics' },
        { cls: 'b-gigs', label: '♪ 12+ Tours' }
      ],
      feed: [
        { color: 'var(--purple)', title: 'European support tour — 18 dates', detail: 'Full routing, advancing, and settlement across 6 countries.', xp: 90 },
        { color: 'var(--cyan)', title: 'Festival day management — main stage', detail: 'Coordinated changeovers for a 6-act single-day lineup.', xp: 50 },
        { color: 'var(--pink)', title: 'Van tour — UK club circuit', detail: '9-date run, budget and merch settlement handled on the road.', xp: 60 }
      ]
    }
  ];

  var escapeHtml = window.mmEscapeHtml;

  var tabsEl = document.getElementById('global-example-tabs');
  if (!tabsEl) return;

  var activeIndex = 0;

  function render(){
    var ex = EXAMPLES[activeIndex];

    tabsEl.querySelectorAll('.patch-tab').forEach(function(btn, i){
      btn.classList.toggle('active', i === activeIndex);
    });

    document.getElementById('global-example-name').textContent = ex.name;
    document.getElementById('global-example-role').textContent = ex.role;
    document.getElementById('global-example-strength-pct').textContent = ex.strength + '%';
    document.getElementById('global-example-strength-fill').style.width = ex.strength + '%';

    document.getElementById('global-example-badges').innerHTML = ex.badges.map(function(b){
      return '<span class="badge ' + b.cls + '">' + escapeHtml(b.label) + '</span>';
    }).join('');

    document.getElementById('global-example-feed').innerHTML = ex.feed.map(function(f){
      return '<div class="feed-item">' +
        '<span class="feed-dot" style="background:' + f.color + ';"></span>' +
        '<div><h5>' + escapeHtml(f.title) + '</h5><p>' + escapeHtml(f.detail) + '</p></div>' +
        '<span class="feed-xp">+' + f.xp + 'XP</span>' +
      '</div>';
    }).join('');

    var avatarEl = document.getElementById('demo-avatar-block');
    if (avatarEl && window.mmRenderAvatar) window.mmRenderAvatar(avatarEl, null, ex.color, ex.name);
  }

  tabsEl.innerHTML = EXAMPLES.map(function(ex, i){
    return '<button type="button" class="patch-tab" data-idx="' + i + '">' + escapeHtml(ex.tab) + '</button>';
  }).join('');
  tabsEl.querySelectorAll('.patch-tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      activeIndex = parseInt(btn.getAttribute('data-idx'), 10);
      render();
    });
  });

  render();
})();
