/* ===================================================================
   Portfolio interactions — Phạm Trần Thủy Hường
   =================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---- current year ---- */
  const yearEl = $("#year");
  // Avoid Date in some sandboxed contexts gracefully:
  try { yearEl.textContent = new Date().getFullYear(); } catch (e) { yearEl.textContent = "2026"; }

  /* ---- sticky nav shadow ---- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- mobile menu ---- */
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  const closeMenu = () => {
    links.classList.remove("open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", closeMenu));

  /* ---- scroll reveal ---- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---- active section highlight in nav ---- */
  const navAnchors = $$("#navLinks a");
  const sections = navAnchors
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = e.target.id;
            navAnchors.forEach((a) =>
              a.classList.toggle("active", a.getAttribute("href") === "#" + id)
            );
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => spy.observe(s));
  }
})();
