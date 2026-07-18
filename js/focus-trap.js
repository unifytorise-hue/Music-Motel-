(function(){
  // ===== shared focus trap for role="dialog" overlays =====
  // All six modals in this file declare aria-modal="true", which tells
  // assistive tech the background is inert — but that's only true if Tab
  // actually stays inside the dialog. This utility does that: call
  // window.trapFocus(modalEl) on open (after the modal is visible) and
  // window.releaseFocusTrap() on close, restoring focus to whatever
  // triggered the modal.
  var activeTrapEl = null;
  var activeKeydownHandler = null;
  var lastFocusedBeforeTrap = null;

  function getFocusable(container){
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(sel)).filter(function(el){
      return el.offsetParent !== null; // skip hidden elements
    });
  }

  window.trapFocus = function(modalEl){
    if (!modalEl) return;
    lastFocusedBeforeTrap = document.activeElement;
    activeTrapEl = modalEl;
    activeKeydownHandler = function(e){
      if (e.key !== 'Tab') return;
      var focusable = getFocusable(activeTrapEl);
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first){
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', activeKeydownHandler);
    // If nothing inside the modal already has focus (e.g. a caller didn't
    // explicitly focus a field), move focus to the first focusable element
    // so Tab/Shift+Tab has a sane starting point.
    if (!modalEl.contains(document.activeElement)){
      var focusable = getFocusable(modalEl);
      if (focusable.length) focusable[0].focus();
    }
  };

  window.releaseFocusTrap = function(){
    if (activeKeydownHandler) document.removeEventListener('keydown', activeKeydownHandler);
    activeKeydownHandler = null;
    activeTrapEl = null;
    if (lastFocusedBeforeTrap && typeof lastFocusedBeforeTrap.focus === 'function'){
      lastFocusedBeforeTrap.focus();
    }
    lastFocusedBeforeTrap = null;
  };
})();
