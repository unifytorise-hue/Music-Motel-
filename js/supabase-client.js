(function(){
  // Real backend for Music Motel, in its own dedicated Supabase project
  // (separate org/account from any other product). The anon/publishable
  // key below is the public client-side key from Settings -> API in that
  // project's dashboard — never put the service_role secret key here.
  //
  // Until a real key is pasted in below, the site quietly runs in
  // local-only demo mode exactly as it always has (signup shows a preview
  // alert, gig log/following/referrals/gear board save to this browser
  // only) — every module that touches Supabase checks
  // window.mmSupabaseConfigured first and falls back automatically.
  var SUPABASE_URL = 'https://gtqnyjiqfhsxngwspkky.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_fqNJjwd1fxCDjoLHE6UUJA_XAB8V_3m';

  var hasKey = !!(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.indexOf('REPLACE_WITH_') !== 0);
  var hasLibrary = (typeof window.supabase === 'object' && window.supabase !== null && typeof window.supabase.createClient === 'function');

  window.mmSupabaseConfigured = hasKey && hasLibrary;
  window.mmSupabase = window.mmSupabaseConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
})();
