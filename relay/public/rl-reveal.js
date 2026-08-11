(function () {
  function run() {
    try {
      document.documentElement.classList.add("rl-js");
      var nodes = document.querySelectorAll(".rl-screen");
      if (!nodes.length) return;

      var reveal = function (el) {
        if (el.getAttribute("data-inview") === "1") return;
        el.setAttribute("data-inview", "1");
      };

      var io = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e.isIntersecting || e.intersectionRatio > 0.12) {
              reveal(e.target);
              io.unobserve(e.target);
            }
          }
        },
        { threshold: [0, 0.12, 0.25, 0.4], rootMargin: "0px 0px -8% 0px" },
      );

      var vh = window.innerHeight || 1;
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.88 && r.bottom > vh * 0.12) reveal(el);
        else io.observe(el);
      }
    } catch (err) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  window.addEventListener("load", run, { once: true });
})();
