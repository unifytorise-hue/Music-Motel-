(function(){
  // Intercept same-page anchor links (#about, #how, etc.) and scroll manually.
  // Some embedded/in-app browsers treat a bare `#hash` href as leaving the
  // current document (because the page is served from a wrapper URL) and
  // pop an "open external link" confirmation instead of just jumping down
  // the page. Handling the scroll ourselves avoids that entirely.
  //
  // Note: we deliberately do NOT call history.replaceState/pushState here —
  // some sandboxed/wrapped preview origins throw a SecurityError on any
  // history mutation, which is worse than just not updating the URL bar.
  document.addEventListener('click', function(e){
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute('href');
    if (!hash || hash === '#') return; // these are JS-driven buttons (signup etc.), not real anchors

    var target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    try{
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch(err){
      target.scrollIntoView();
    }
  });
})();
