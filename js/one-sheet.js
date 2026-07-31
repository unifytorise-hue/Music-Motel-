(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }

  var btn = document.getElementById('public-profile-download-onesheet-btn');
  if (!btn) return;

  function wrapText(doc, text, maxWidth){ return doc.splitTextToSize(text || '', maxWidth); }

  // jsPDF is vendored locally (js/vendor/jspdf.umd.min.js, MIT licensed —
  // see the license banner at the top of that file) rather than loaded
  // from a third-party CDN at runtime, so this works the same way this
  // sandbox's blocked egress or a visitor's ad/script blocker wouldn't
  // otherwise affect it.
  function buildPdf(profile, extras){
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor){
      alert('Could not load the PDF generator. Please try again.');
      return;
    }
    var doc = new jsPDFCtor();
    var margin = 15;
    var y = 22;
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var maxWidth = pageWidth - margin * 2;

    function ensureRoom(lineHeight){
      if (y > pageHeight - 25){
        doc.addPage();
        y = 20;
      }
    }
    function heading(text){
      ensureRoom();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20);
      doc.text(text, margin, y);
      y += 6;
    }
    function paragraph(text, size){
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size || 10.5);
      doc.setTextColor(50);
      var lines = wrapText(doc, text, maxWidth);
      lines.forEach(function(line){
        ensureRoom();
        doc.text(line, margin, y);
        y += (size || 10.5) * 0.55;
      });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(20);
    doc.text(profile.name || 'Unnamed profile', margin, y);
    y += 9;

    var roleLine = window.mmRoleAndTypeLabel ? window.mmRoleAndTypeLabel(profile) : (profile.role_label || '');
    var locLine = (!profile.hide_exact_location && profile.location_label) ? profile.location_label : '';
    var subLine = [roleLine, locLine].filter(Boolean).join('  ·  ');
    if (subLine){
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12.5);
      doc.setTextColor(90);
      doc.text(subLine, margin, y);
      y += 9;
    }

    if (extras.badges && extras.badges.length){
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 140, 120);
      doc.text(extras.badges.join('   ·   '), margin, y);
      y += 9;
    }

    if (profile.bio){
      paragraph(profile.bio, 11);
    }

    if (profile.genres && profile.genres.length){
      heading('Genres');
      paragraph(profile.genres.join(', '));
    }
    if (profile.instruments && profile.instruments.length){
      heading('Instruments');
      paragraph(profile.instruments.join(', '));
    }
    if (profile.languages && profile.languages.length){
      heading('Languages');
      paragraph(profile.languages.join(', '));
    }

    if (extras.rateText){
      heading('Standard rate');
      paragraph(extras.rateText + ', apart from travel');
    }

    if (extras.credits && extras.credits.length){
      heading('Credits');
      extras.credits.forEach(function(c){
        var line = c.title + ' — ' + c.credit_role + (c.year ? ' (' + c.year + ')' : '');
        paragraph('•  ' + line);
      });
    }

    y = pageHeight - 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(140);
    var shareUrl = window.mmProfileShareUrl ? window.mmProfileShareUrl(profile.id) : '';
    doc.text('Music Motel — Since 2014' + (shareUrl ? '  ·  ' + shareUrl : ''), margin, y);

    var fileName = (profile.name || 'profile').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'profile';
    doc.save(fileName + '-one-sheet.pdf');
  }

  btn.addEventListener('click', function(){
    var profile = window.mmCurrentProfile;
    if (!profile) return;
    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating…';

    var creditsFetch = configured()
      ? window.mmSupabase.from('profile_credits').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] });
    var rateFetch = (configured() && !profile.hide_rate)
      ? window.mmSupabase.from('artist_rate_cards').select('*').eq('user_id', profile.id).maybeSingle()
      : Promise.resolve({ data: null });

    Promise.all([creditsFetch, rateFetch]).then(function(results){
      var credits = results[0].data || [];
      var rateCard = results[1].data;
      var rateText = (rateCard && rateCard.rate_amount != null && rateCard.booking_agent_terms_accepted_at && window.formatRateCardShort)
        ? window.formatRateCardShort(rateCard)
        : null;

      // Reuses whatever js/share-profile.js has already rendered into the
      // verification badge row rather than re-running that same four-table
      // signal fetch a second time just for this button.
      var badgeEls = document.querySelectorAll('#public-profile-verification-badges .verification-tier-pill');
      var badges = Array.prototype.map.call(badgeEls, function(el){ return el.textContent.trim(); });

      buildPdf(profile, { credits: credits, rateText: rateText, badges: badges });
    }).catch(function(){
      alert("Couldn't generate the one-sheet right now — try again.");
    }).then(function(){
      btn.disabled = false;
      btn.textContent = origText;
    });
  });
})();
