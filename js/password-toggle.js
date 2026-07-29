(function(){
  function wire(){
    document.querySelectorAll('.password-toggle-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var input = document.getElementById(btn.getAttribute('data-target'));
        if (!input) return;
        var willShow = input.type === 'password';
        input.type = willShow ? 'text' : 'password';
        btn.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
        var iconSlot = btn.querySelector('[data-icon]');
        var iconName = willShow ? 'eye-off' : 'eye';
        if (iconSlot){
          iconSlot.setAttribute('data-icon', iconName);
          if (window.mmIcon) iconSlot.innerHTML = window.mmIcon(iconName);
        }
      });
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
