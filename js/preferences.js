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
    EGP: { symbol: 'E£', rate: 49, label: 'Egyptian Pound' },
    MAD: { symbol: 'DH', rate: 10, label: 'Moroccan Dirham' },
    TZS: { symbol: 'TSh', rate: 2600, label: 'Tanzanian Shilling' },
    UGX: { symbol: 'USh', rate: 3750, label: 'Ugandan Shilling' },
    ZMW: { symbol: 'ZK', rate: 26, label: 'Zambian Kwacha' },
    INR: { symbol: '₹', rate: 83.5, label: 'Indian Rupee' },
    PKR: { symbol: 'Rs', rate: 278, label: 'Pakistani Rupee' },
    BDT: { symbol: '৳', rate: 110, label: 'Bangladeshi Taka' },
    CNY: { symbol: '¥', rate: 7.24, label: 'Chinese Yuan' },
    JPY: { symbol: '¥', rate: 151, label: 'Japanese Yen' },
    KRW: { symbol: '₩', rate: 1330, label: 'South Korean Won' },
    IDR: { symbol: 'Rp', rate: 15700, label: 'Indonesian Rupiah' },
    PHP: { symbol: '₱', rate: 56, label: 'Philippine Peso' },
    VND: { symbol: '₫', rate: 24500, label: 'Vietnamese Dong' },
    THB: { symbol: '฿', rate: 36, label: 'Thai Baht' },
    MYR: { symbol: 'RM', rate: 4.7, label: 'Malaysian Ringgit' },
    SGD: { symbol: 'S$', rate: 1.34, label: 'Singapore Dollar' },
    HKD: { symbol: 'HK$', rate: 7.82, label: 'Hong Kong Dollar' },
    AUD: { symbol: 'A$', rate: 1.52, label: 'Australian Dollar' },
    NZD: { symbol: 'NZ$', rate: 1.64, label: 'New Zealand Dollar' },
    CAD: { symbol: 'C$', rate: 1.36, label: 'Canadian Dollar' },
    MXN: { symbol: 'MX$', rate: 17, label: 'Mexican Peso' },
    BRL: { symbol: 'R$', rate: 5, label: 'Brazilian Real' },
    ARS: { symbol: 'AR$', rate: 880, label: 'Argentine Peso' },
    COP: { symbol: 'COL$', rate: 3900, label: 'Colombian Peso' },
    CLP: { symbol: 'CL$', rate: 940, label: 'Chilean Peso' },
    CHF: { symbol: 'CHF', rate: 0.88, label: 'Swiss Franc' },
    SEK: { symbol: 'kr', rate: 10.4, label: 'Swedish Krona' },
    NOK: { symbol: 'kr', rate: 10.6, label: 'Norwegian Krone' },
    DKK: { symbol: 'kr', rate: 6.9, label: 'Danish Krone' },
    PLN: { symbol: 'zł', rate: 4, label: 'Polish Złoty' },
    TRY: { symbol: '₺', rate: 32, label: 'Turkish Lira' },
    AED: { symbol: 'AED', rate: 3.67, label: 'UAE Dirham' },
    SAR: { symbol: 'SR', rate: 3.75, label: 'Saudi Riyal' },
    ILS: { symbol: '₪', rate: 3.7, label: 'Israeli Shekel' }
  };
  var CURRENCY_CODES = Object.keys(CURRENCIES);
  window.mmCurrencyCodes = CURRENCY_CODES;
  window.mmCurrencyLabel = function(code){
    var c = CURRENCIES[code];
    return c ? (code + ' — ' + c.label) : code;
  };

  function convert(amountUsd, toCode){
    var c = CURRENCIES[toCode] || CURRENCIES.USD;
    return amountUsd * c.rate;
  }

  // Inverse of convert() — for entry points where someone types an amount
  // in their own currency (a campaign goal, a pledge, a rate) rather than
  // just viewing a USD amount converted for display. Everything is still
  // stored in USD, matching the "one canonical unit" approach used
  // everywhere else on the site — this only converts at the edge, on the
  // way in instead of on the way out.
  window.mmConvertToUsd = function(amount, fromCode){
    var c = CURRENCIES[fromCode] || CURRENCIES.USD;
    return amount / c.rate;
  };

  // Forward direction of the same conversion — for quick-amount presets
  // that are defined in USD (e.g. "$10") but need to be dropped into an
  // input field that's currently in some other currency.
  window.mmConvertFromUsd = function(amountUsd, toCode){
    return convert(amountUsd, toCode);
  };
  window.mmGetPreferredCurrency = function(){
    return (myPrefs && myPrefs.currency) || 'USD';
  };

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

  // Distance/currency pickers appear in more than one place now — the
  // Preferences card, and again next to the nearby-players radius filter
  // (the "search bar where location radius is") since that's where
  // someone is most likely to want to flip units mid-search. All of them
  // mirror the same myPrefs state rather than being independent settings.
  var DISTANCE_UNIT_IDS = ['pref-distance-unit', 'nearby-distance-unit'];
  var CURRENCY_SELECT_IDS = ['pref-currency', 'nearby-currency'];

  function populateCurrencySelects(){
    CURRENCY_SELECT_IDS.forEach(function(id){
      var sel = document.getElementById(id);
      if (!sel || sel.children.length) return;
      CURRENCY_CODES.forEach(function(code){
        var opt = document.createElement('option');
        opt.value = code;
        opt.textContent = window.mmCurrencyLabel(code);
        sel.appendChild(opt);
      });
    });
  }

  function applyPrefsToForm(){
    DISTANCE_UNIT_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = myPrefs.distance_unit;
    });
    CURRENCY_SELECT_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = myPrefs.currency;
    });
  }

  function initPrefs(){
    populateCurrencySelects();
    var signedOutNote = document.getElementById('prefs-signed-out-note');
    if (signedOutNote) signedOutNote.style.display = isSignedIn() ? 'none' : 'block';
    var loader = isSignedIn() ? loadPrefsRemote() : loadPrefsLocal();
    loader.then(function(saved){
      if (saved) myPrefs = { distance_unit: saved.distance_unit || 'km', currency: saved.currency || 'USD' };
      applyPrefsToForm();
      if (window.refreshRealArtistDirectory) window.refreshRealArtistDirectory();
      if (window.refreshNearbyPlayers) window.refreshNearbyPlayers();
    });
  }

  function savePrefs(e){
    var target = e && e.target;
    if (target && DISTANCE_UNIT_IDS.indexOf(target.id) > -1) myPrefs.distance_unit = target.value;
    else if (target && CURRENCY_SELECT_IDS.indexOf(target.id) > -1) myPrefs.currency = target.value;
    applyPrefsToForm(); // mirror the change across every copy of these selects
    var statusEl = document.getElementById('prefs-status');
    if (isSignedIn()){
      if (statusEl) statusEl.textContent = 'Saving…';
      savePrefsRemote({ distance_unit: myPrefs.distance_unit, currency: myPrefs.currency }).then(function(){
        if (statusEl) statusEl.textContent = 'Saved.';
      });
    } else {
      savePrefsLocal(myPrefs);
      if (statusEl) statusEl.textContent = 'Saved on this device.';
    }
    if (window.refreshRealArtistDirectory) window.refreshRealArtistDirectory();
    if (window.refreshNearbyPlayers) window.refreshNearbyPlayers();
  };
  DISTANCE_UNIT_IDS.concat(CURRENCY_SELECT_IDS).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', savePrefs);
  });

  authReady.then(initPrefs);
  if (configured()){
    window.mmSupabase.auth.onAuthStateChange(function(){ initPrefs(); });
  }
})();
