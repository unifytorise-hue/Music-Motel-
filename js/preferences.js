(function(){
  function configured(){ return !!(window.mmSupabaseConfigured && window.mmSupabase); }
  function currentUser(){ return window.mmAuth && window.mmAuth.getUser && window.mmAuth.getUser(); }
  function isSignedIn(){ return !!(configured() && currentUser()); }
  var authReady = window.mmAuthReady || Promise.resolve();
  var siteStorage = window.siteStorage;

  // Indicative rates only (1 USD = N of currency) — this sandbox has no
  // route to a live FX API (every CDN/API call from here is blocked, the
  // same limitation already disclosed for Supabase/Google Fonts/Leaflet).
  // Swap this for a real FX provider before relying on it for anything
  // beyond "roughly how much is that in my currency."
  var CURRENCIES = {
    USD: { symbol: '$', rate: 1, label: 'US Dollar' },
    EUR: { symbol: '€', rate: 0.92, label: 'Euro' },
    GBP: { symbol: '£', rate: 0.79, label: 'British Pound' },
    ZAR: { symbol: 'R', rate: 18.5, label: 'South African Rand' },
    NGN: { symbol: '₦', rate: 1550, label: 'Nigerian Naira' },
    KES: { symbol: 'KSh', rate: 129, label: 'Kenyan Shilling' },
    GHS: { symbol: 'GH₵', rate: 15.5, label: 'Ghanaian Cedi' },
    INR: { symbol: '₹', rate: 83.5, label: 'Indian Rupee' },
    AUD: { symbol: 'A$', rate: 1.52, label: 'Australian Dollar' },
    CAD: { symbol: 'C$', rate: 1.36, label: 'Canadian Dollar' }
  };
  var CURRENCY_CODES = Object.keys(CURRENCIES);

  function convert(amountUsd, toCode){
    var c = CURRENCIES[toCode] || CURRENCIES.USD;
    return amountUsd * c.rate;
  }

  function formatCurrency(amount, code){
    var c = CURRENCIES[code] || CURRENCIES.USD;
    var decimals = amount >= 1000 ? 0 : 2;
    return c.symbol + amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  // All prices are stored/entered in USD everywhere on the site (rate
  // cards, quotes, budgets) — this converts just for display, the same
  // "one canonical unit, convert at the edge" approach used for distance.
  window.mmFormatMoney = function(amountUsd){
    if (amountUsd == null || isNaN(amountUsd)) return '';
    var code = (myPrefs && myPrefs.currency) || 'USD';
    if (code === 'USD') return formatCurrency(amountUsd, 'USD');
    return formatCurrency(convert(amountUsd, code), code) + ' (' + formatCurrency(amountUsd, 'USD') + ')';
  };

  window.mmFormatDistanceKm = function(km){
    var unit = (myPrefs && myPrefs.distance_unit) || 'km';
    if (unit === 'mi'){
      var mi = km * 0.621371;
      if (mi < 1) return '<1 mi away';
      if (mi < 10) return Math.round(mi) + ' mi away';
      return Math.round(mi / 10) * 10 + ' mi away';
    }
    if (km < 1) return '<1 km away';
    if (km < 10) return Math.round(km) + ' km away';
    return Math.round(km / 10) * 10 + ' km away';
  };

  var PREFS_KEY = 'my-prefs';
  var myPrefs = { distance_unit: 'km', currency: 'USD' };

  function loadPrefsLocal(){
    return siteStorage.get(PREFS_KEY)
      .then(function(val){ return val ? JSON.parse(val) : null; })
      .catch(function(){ return null; });
  }
  function savePrefsLocal(prefs){
    return siteStorage.set(PREFS_KEY, JSON.stringify(prefs));
  }
  function loadPrefsRemote(){
    return window.mmSupabase.from('profiles').select('distance_unit,currency').eq('id', currentUser().id).maybeSingle()
      .then(function(res){ return (res.error || !res.data) ? null : res.data; })
      .catch(function(){ return null; });
  }
  function savePrefsRemote(prefs){
    return window.mmSupabase.from('profiles').update(prefs).eq('id', currentUser().id).then(function(){});
  }

  function populateCurrencySelects(){
    ['pref-currency', 'converter-from', 'converter-to'].forEach(function(id){
      var sel = document.getElementById(id);
      if (!sel || sel.children.length) return;
      CURRENCY_CODES.forEach(function(code){
        var opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code + ' — ' + CURRENCIES[code].label;
        sel.appendChild(opt);
      });
    });
  }

  function applyPrefsToForm(){
    document.getElementById('pref-distance-unit').value = myPrefs.distance_unit;
    document.getElementById('pref-currency').value = myPrefs.currency;
    document.getElementById('converter-from').value = 'USD';
    document.getElementById('converter-to').value = myPrefs.currency === 'USD' ? 'ZAR' : myPrefs.currency;
  }

  function initPrefs(){
    populateCurrencySelects();
    document.getElementById('prefs-signed-out-note').style.display = isSignedIn() ? 'none' : 'block';
    var loader = isSignedIn() ? loadPrefsRemote() : loadPrefsLocal();
    loader.then(function(saved){
      if (saved) myPrefs = { distance_unit: saved.distance_unit || 'km', currency: saved.currency || 'USD' };
      applyPrefsToForm();
      runConverter();
      if (window.refreshRealArtistDirectory) window.refreshRealArtistDirectory();
      if (window.refreshNearbyPlayers) window.refreshNearbyPlayers();
    });
  }

  function savePrefs(){
    myPrefs.distance_unit = document.getElementById('pref-distance-unit').value;
    myPrefs.currency = document.getElementById('pref-currency').value;
    var statusEl = document.getElementById('prefs-status');
    if (isSignedIn()){
      statusEl.textContent = 'Saving…';
      savePrefsRemote({ distance_unit: myPrefs.distance_unit, currency: myPrefs.currency }).then(function(){
        statusEl.textContent = 'Saved.';
      });
    } else {
      savePrefsLocal(myPrefs);
      statusEl.textContent = 'Saved on this device.';
    }
    runConverter();
    if (window.refreshRealArtistDirectory) window.refreshRealArtistDirectory();
  };
  document.getElementById('pref-distance-unit').addEventListener('change', savePrefs);
  document.getElementById('pref-currency').addEventListener('change', savePrefs);

  // ===== standalone converter (independent of the saved preference —
  // convert between any two of the listed currencies) =====
  function runConverter(){
    var amount = parseFloat(document.getElementById('converter-amount').value);
    var from = document.getElementById('converter-from').value;
    var to = document.getElementById('converter-to').value;
    var resultEl = document.getElementById('converter-result');
    if (isNaN(amount)){
      resultEl.textContent = '';
      return;
    }
    var usd = amount / (CURRENCIES[from] || CURRENCIES.USD).rate;
    var result = convert(usd, to);
    resultEl.textContent = formatCurrency(amount, from) + ' ≈ ' + formatCurrency(result, to);
  }
  ['converter-amount', 'converter-from', 'converter-to'].forEach(function(id){
    document.getElementById(id).addEventListener('input', runConverter);
  });

  authReady.then(initPrefs);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ initPrefs(); });
  }
})();
