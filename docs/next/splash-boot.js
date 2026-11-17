// Intro: the logo, then the name. Shown once per visit (every launch of the installed app).
(function () {
  var root = document.documentElement;
  try {
    var seen = sessionStorage.getItem('setup_splash');
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seen || calm) root.classList.add('nosplash'); else sessionStorage.setItem('setup_splash', '1');
  } catch (e) { /* storage blocked: show it */ }
  window.addEventListener('load', function () {
    setTimeout(function () { var s = document.getElementById('splash'); if (s && s.parentNode) s.parentNode.removeChild(s); }, 3400);
  });
})();
