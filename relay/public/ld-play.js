(function () {
  function replay(root) {
    if (!root) return;
    root.setAttribute("data-play", "0");
    // force style recalc so CSS animations can restart
    void root.offsetWidth;
    root.setAttribute("data-play", "1");
    root.querySelectorAll("[data-play]").forEach(function (child) {
      if (child === root) return;
      child.setAttribute("data-play", "0");
      void child.offsetWidth;
      child.setAttribute("data-play", "1");
    });
  }

  function boot() {
    var sections = document.querySelectorAll(".ld-screen, .ld-play-slot");
    if (!sections.length) return;

    // Also mark nested demo roots when a slot plays
    function playTree(el) {
      replay(el);
      el.querySelectorAll(".ld-app, .ld-cplay, .ld-eplay, .ld-bplay").forEach(function (demo) {
        demo.setAttribute("data-play", "0");
        void demo.offsetWidth;
        demo.setAttribute("data-play", "1");
      });
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (el.getAttribute("data-armed") === "1") return;
          el.setAttribute("data-armed", "1");
          playTree(el);
          var loops = 0;
          var timer = window.setInterval(function () {
            var r = el.getBoundingClientRect();
            var vh = window.innerHeight || 1;
            if (r.bottom < 0 || r.top > vh || loops > 6) {
              window.clearInterval(timer);
              return;
            }
            loops += 1;
            playTree(el);
          }, 8200);
        });
      },
      { threshold: 0.28, rootMargin: "0px 0px -8% 0px" },
    );

    sections.forEach(function (el) {
      io.observe(el);
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      if (r.top < vh * 0.85 && r.bottom > vh * 0.1) {
        el.setAttribute("data-armed", "1");
        playTree(el);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
