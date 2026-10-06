(function () {
  var root = document.documentElement;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  // Language: saved choice first, then the browser's language
  var langButtons = document.querySelectorAll("[data-set-lang]");

  function setLang(lang) {
    root.lang = lang;
    each(langButtons, function (b) { b.setAttribute("aria-pressed", String(b.dataset.setLang === lang)); });
    try { localStorage.setItem("lang", lang); } catch (e) {}
    measureBand();
    requestFrame();
  }

  // Changing language by hand: the words fade out, change, and fade back
  function switchLang(lang) {
    if (lang === root.lang) return;
    if (calm) { setLang(lang); return; }
    root.classList.add("lang-fade");
    setTimeout(function () { setLang(lang); root.classList.remove("lang-fade"); }, 230);
  }

  var saved = null;
  try { saved = localStorage.getItem("lang"); } catch (e) {}
  each(langButtons, function (b) { b.addEventListener("click", function () { switchLang(b.dataset.setLang); }); });

  // Phone and tablet menu
  var top = document.querySelector(".top");
  var menuButton = document.querySelector(".top__menu");

  function setMenu(open) {
    top.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  }

  menuButton.addEventListener("click", function () { setMenu(!top.classList.contains("is-open")); });
  each(document.querySelectorAll(".top__nav a, .top__logo"), function (a) {
    a.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  window.addEventListener("resize", function () { setMenu(false); measureBand(); requestFrame(); });

  // The paragraph under "Who we are" is split into words, which light up as it is scrolled through
  var litBlocks = [];
  if (!calm) {
    each(document.querySelectorAll("[data-lit] p"), function (p) {
      var words = p.textContent.trim().split(/\s+/);
      p.textContent = "";
      words.forEach(function (word, i) {
        var span = document.createElement("span");
        span.className = "w";
        span.textContent = word;
        p.appendChild(span);
        if (i < words.length - 1) p.appendChild(document.createTextNode(" "));
      });
      litBlocks.push({ el: p, words: p.children, lit: -1 });
    });
  }

  // The band of values drifts slowly by itself and travels with the page when it is scrolled
  var band = document.querySelector("[data-marquee]");
  var bandWidth = 0;
  var bandX = 0;
  var bandOn = false;
  var bandY = window.scrollY;
  var bandTime = 0;

  function measureBand() { if (band) bandWidth = band.firstElementChild.offsetWidth; }

  function moveBand(now) {
    if (!bandOn) return;
    var dt = Math.min(64, now - (bandTime || now));
    bandTime = now;
    var y = window.scrollY;
    bandX -= dt * 0.035 + (y - bandY) * 0.45;
    bandY = y;
    if (bandWidth) bandX = ((bandX % bandWidth) - bandWidth) % bandWidth;   // keep within one set's width
    band.style.transform = "translate3d(" + bandX.toFixed(1) + "px,0,0)";
    requestAnimationFrame(moveBand);
  }

  if (band && !calm && "IntersectionObserver" in window) {
    band.classList.add("is-driven");
    new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      if (visible && !bandOn) { bandOn = true; bandTime = 0; bandY = window.scrollY; requestAnimationFrame(moveBand); }
      if (!visible) bandOn = false;
    }, { rootMargin: "20% 0px" }).observe(band.parentElement);
  }

  // Everything tied to the scroll position happens here, once per screen refresh
  var hero = document.querySelector(".hero");
  var heroImg = document.querySelector("[data-hero]");
  var drifting = calm ? [] : Array.prototype.slice.call(document.querySelectorAll("[data-drift]"));
  var floating = calm ? [] : Array.prototype.slice.call(document.querySelectorAll("[data-float]"));
  var lastY = window.scrollY;
  var queued = false;

  function onFrame() {
    queued = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    // header: paper after the opening photo, hidden while scrolling down
    top.classList.toggle("is-solid", y > hero.offsetHeight - 90);
    if (Math.abs(y - lastY) >= 6) {
      top.classList.toggle("is-hidden", y > lastY && y > 240 && !top.classList.contains("is-open"));
      lastY = y;
    }
    if (calm) return;

    // the opening photograph falls behind slowly
    if (y < vh) heroImg.style.transform = "translate3d(0," + (y * 0.16).toFixed(1) + "px,0)";

    // full-width photographs drift inside their frames
    drifting.forEach(function (img) {
      var frame = img.parentElement.getBoundingClientRect();
      if (frame.bottom < 0 || frame.top > vh) return;
      var p = (frame.top + frame.height / 2 - vh / 2) / (vh / 2 + frame.height / 2);   // -1 above the screen, 1 below
      img.style.transform = "translate3d(0," + (-p * 5.5).toFixed(2) + "%,0)";
    });

    // the smaller photograph of each pair moves a little faster than the page
    floating.forEach(function (el) {
      var box = el.getBoundingClientRect();
      var topEdge = box.top - (el._shift || 0);
      if (topEdge > vh * 1.4 || topEdge + box.height < -vh * 0.4) return;
      el._shift = (topEdge + box.height / 2 - vh / 2) * Number(el.dataset.float);
      el.style.transform = "translate3d(0," + el._shift.toFixed(1) + "px,0)";
    });

    // words light up between the paragraph entering the lower screen and reaching the upper third
    litBlocks.forEach(function (block) {
      var box = block.el.getBoundingClientRect();
      if (!box.height) return;                                  // the other language
      var progress = (vh * 0.86 - box.top) / (box.height + vh * 0.36);
      var lit = Math.round(Math.max(0, Math.min(1, progress)) * block.words.length);
      if (lit === block.lit) return;
      block.lit = lit;
      each(block.words, function (word, i) { word.classList.toggle("on", i < lit); });
    });
  }

  function requestFrame() { if (!queued) { queued = true; requestAnimationFrame(onFrame); } }
  window.addEventListener("scroll", requestFrame, { passive: true });
  top.addEventListener("focusin", function () { top.classList.remove("is-hidden"); });

  setLang(saved || ((navigator.language || "").toLowerCase().indexOf("el") === 0 ? "el" : "en"));
  onFrame();

  // Things that happen once, when an element first comes into view
  if (!calm && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        seen.unobserve(entry.target);
        entry.target.classList.add("is-in");
        if (entry.target.hasAttribute("data-count")) countUp(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    // photographs are uncovered
    each(document.querySelectorAll("[data-cover]"), function (el) { el.classList.add("reveal"); seen.observe(el); });

    // headings rise into place
    each(document.querySelectorAll("[data-rise]"), function (el) {
      var inner = document.createElement("span");
      inner.className = "rise";
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
      el.classList.add("has-rise");
      seen.observe(el);
    });

    // hairlines and the construction-stage line draw themselves
    each(document.querySelectorAll("[data-draw]"), function (el) { el.classList.add("will-draw"); seen.observe(el); });

    // the three figures count up
    each(document.querySelectorAll("[data-count]"), function (el) { seen.observe(el); });
  }

  function countUp(el) {
    var match = el.textContent.match(/^(\d+)(.*)$/);
    if (!match) return;
    var target = Number(match[1]);
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / 1600);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + match[2];
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // The home, location and specification fold open and shut
  each(document.querySelectorAll(".fold"), function (fold) {
    var head = fold.querySelector(".fold__head");
    head.setAttribute("aria-expanded", String(fold.classList.contains("is-open")));
    head.addEventListener("click", function () {
      head.setAttribute("aria-expanded", String(fold.classList.toggle("is-open")));
    });
  });

  var finePointer = !calm && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Buttons marked data-magnet lean a little towards the pointer
  if (finePointer) {
    each(document.querySelectorAll("[data-magnet]"), function (el) {
      el.addEventListener("pointermove", function (e) {
        var box = el.getBoundingClientRect();
        var dx = e.clientX - (box.left + box.width / 2);
        var dy = e.clientY - (box.top + box.height / 2);
        el.style.transform = "translate3d(" + (dx * 0.22).toFixed(1) + "px," + (dy * 0.34).toFixed(1) + "px,0)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  // A round "View" label takes the place of the pointer over photographs
  var cursor = document.querySelector(".cursor");
  if (finePointer && cursor) {
    root.classList.add("has-cursor");
    var cAim = { x: 0, y: 0 };
    var cPos = { x: 0, y: 0 };
    var cOn = false;

    function trail() {
      cPos.x += (cAim.x - cPos.x) * 0.22;
      cPos.y += (cAim.y - cPos.y) * 0.22;
      cursor.style.transform = "translate3d(" + cPos.x.toFixed(1) + "px," + cPos.y.toFixed(1) + "px,0)";
      if (cOn) requestAnimationFrame(trail);
    }

    document.addEventListener("pointermove", function (e) {
      var over = !!(e.target.closest && e.target.closest(".shot"));
      cAim.x = e.clientX; cAim.y = e.clientY;
      if (over && !cOn) { cPos.x = cAim.x; cPos.y = cAim.y; cOn = true; requestAnimationFrame(trail); }
      if (!over) cOn = false;
      cursor.classList.toggle("is-on", over);
    }, { passive: true });
    window.addEventListener("scroll", function () { cOn = false; cursor.classList.remove("is-on"); }, { passive: true });
  }

  // On a computer, a photograph follows the pointer over the list of services
  var peek = document.querySelector(".peek");
  var list = document.querySelector(".services__list");
  if (finePointer) {
    var peekImgs = peek.querySelectorAll("img");
    var aim = { x: 0, y: 0 };
    var pos = { x: 0, y: 0 };
    var following = false;

    function follow() {
      pos.x += (aim.x - pos.x) * 0.14;
      pos.y += (aim.y - pos.y) * 0.14;
      peek.style.transform = "translate3d(" + pos.x.toFixed(1) + "px," + pos.y.toFixed(1) + "px,0)";
      if (following) requestAnimationFrame(follow);
    }

    list.addEventListener("pointermove", function (e) {
      var w = peek.offsetWidth;
      var h = peek.offsetHeight;
      aim.x = Math.min(e.clientX + 28, window.innerWidth - w - 16);
      aim.y = Math.max(16, Math.min(e.clientY - h / 2, window.innerHeight - h - 16));
      var item = e.target.closest("[data-peek]");
      each(peekImgs, function (img, i) { img.classList.toggle("is-on", !!item && i === Number(item.dataset.peek)); });
      if (!following) {
        pos.x = aim.x; pos.y = aim.y;
        following = true;
        peek.classList.add("is-on");
        requestAnimationFrame(follow);
      }
    });
    list.addEventListener("pointerleave", function () { following = false; peek.classList.remove("is-on"); });
    window.addEventListener("scroll", function () { following = false; peek.classList.remove("is-on"); }, { passive: true });
  }

  // Photo viewer: steps through the photos of the group that was opened
  var viewer = document.getElementById("viewer");
  var viewerImg = document.getElementById("viewer-img");
  var viewerCount = document.getElementById("viewer-count");
  var set = [];
  var index = 0;

  function show(i) {
    index = (i + set.length) % set.length;
    viewerImg.classList.remove("is-ready");
    viewerImg.src = set[index].dataset.full;
    viewerImg.alt = set[index].querySelector("img").alt;
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    viewerCount.textContent = two(index + 1) + " / " + two(set.length);
    if (viewerImg.complete) viewerImg.classList.add("is-ready");
  }
  viewerImg.addEventListener("load", function () { viewerImg.classList.add("is-ready"); });

  each(document.querySelectorAll(".shot"), function (shot) {
    shot.addEventListener("click", function () {
      set = Array.prototype.slice.call(shot.closest(".work, .build").querySelectorAll(".shot"));
      show(set.indexOf(shot));
      if (cursor) cursor.classList.remove("is-on");
      viewer.showModal();
    });
  });

  viewer.addEventListener("click", function (e) {
    var step = e.target.closest("[data-step]");
    if (step) { show(index + Number(step.dataset.step)); return; }
    if (e.target === viewer || e.target.closest("[data-close]") || e.target.tagName === "FIGURE") viewer.close();
  });

  // Swipe left or right on a touch screen to change photo
  var touchX = null;
  viewer.addEventListener("touchstart", function (e) { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  viewer.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  });

  viewer.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") show(index + 1);
    if (e.key === "ArrowLeft") show(index - 1);
  });
})();
