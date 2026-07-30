(function(){
  // Shared by the dashboard media-portfolio editor and the public profile
  // page renderer — turns a pasted share URL from a supported platform into
  // an embeddable player, entirely client-side (no API keys, no server
  // round-trip). Returns null for anything unrecognized so callers can show
  // a clear "couldn't recognize that link" message instead of a broken embed.
  //
  // Bandcamp is deliberately NOT true-embedded: Bandcamp's iframe embeds
  // require a numeric track/album ID that only exists in that page's HTML
  // (via Bandcamp's own "Share/Embed" generator), which can't be derived
  // from the public URL alone without a server-side fetch this static site
  // doesn't have. A Bandcamp link is instead rendered as a styled external
  // link card — real, working, just not an inline player.
  function parseMediaUrl(url){
    var u = (url || '').trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;

    var m;
    if ((m = u.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i))){
      return { type: 'spotify', embedUrl: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2], sourceUrl: u };
    }
    if ((m = u.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]+)/i))){
      return { type: 'youtube', embedUrl: 'https://www.youtube.com/embed/' + m[1], sourceUrl: u };
    }
    if ((m = u.match(/vimeo\.com\/(\d+)/i))){
      return { type: 'vimeo', embedUrl: 'https://player.vimeo.com/video/' + m[1], sourceUrl: u };
    }
    if (/soundcloud\.com\//i.test(u)){
      return { type: 'soundcloud', embedUrl: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u) + '&color=%23ff5500&auto_play=false&show_teaser=false', sourceUrl: u };
    }
    if (/music\.apple\.com\//i.test(u)){
      return { type: 'apple_music', embedUrl: u.replace('music.apple.com', 'embed.music.apple.com'), sourceUrl: u };
    }
    if (/bandcamp\.com\//i.test(u)){
      return { type: 'bandcamp', embedUrl: null, sourceUrl: u };
    }
    return null;
  }

  var PLATFORM_LABELS = {
    spotify: 'Spotify', apple_music: 'Apple Music', soundcloud: 'SoundCloud',
    bandcamp: 'Bandcamp', youtube: 'YouTube', vimeo: 'Vimeo'
  };
  var EMBED_HEIGHT = {
    spotify: 152, apple_music: 175, soundcloud: 166, youtube: 220, vimeo: 220
  };

  window.mmParseMediaUrl = parseMediaUrl;
  window.mmMediaPlatformLabel = function(type){ return PLATFORM_LABELS[type] || type; };

  // Builds the actual player/link markup for one saved media row. Used by
  // both the portfolio grid and the featured-work pinned slot. embed_url is
  // recomputed from the stored url rather than persisted, since it's cheap
  // and deterministic — one less thing that can drift out of sync in the DB.
  window.mmRenderMediaEmbed = function(item){
    var label = PLATFORM_LABELS[item.media_type] || item.media_type;
    var parsed = parseMediaUrl(item.url);
    if (item.media_type === 'bandcamp' || !parsed || !parsed.embedUrl){
      var a = document.createElement('a');
      a.className = 'media-embed-linkcard';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Listen on ' + label + ' ↗';
      return a;
    }
    var wrap = document.createElement('div');
    wrap.className = 'media-embed-frame';
    var iframe = document.createElement('iframe');
    iframe.src = parsed.embedUrl;
    iframe.loading = 'lazy';
    iframe.style.height = (EMBED_HEIGHT[item.media_type] || 200) + 'px';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    wrap.appendChild(iframe);
    return wrap;
  };
})();
