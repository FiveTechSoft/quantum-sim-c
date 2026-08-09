/**
 * Tema aleatorio en cada recarga.
 * También corrige la URL de GitHub Pages sin barra final.
 */
(function () {
  "use strict";

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function hsl(h, s, l) {
    return "hsl(" + Math.round(h) + " " + Math.round(s) + "% " + Math.round(l) + "%)";
  }

  function hsla(h, s, l, a) {
    return (
      "hsla(" +
      Math.round(h) +
      " " +
      Math.round(s) +
      "% " +
      Math.round(l) +
      "% / " +
      a +
      ")"
    );
  }

  function ensureTrailingSlash() {
    var path = location.pathname;
    // https://user.github.io/quantum-sim-c  →  .../quantum-sim-c/
    if (/\/quantum-sim-c$/i.test(path)) {
      location.replace(path + "/" + location.search + location.hash);
    }
  }

  function applyRandomTheme() {
    var h1 = rand(0, 360);
    var h2 = (h1 + rand(40, 90)) % 360;
    var h3 = (h1 + rand(120, 200)) % 360;
    var bgH = (h1 + 180) % 360;
    var root = document.documentElement;

    root.style.setProperty("--bg", hsl(bgH, 28, 7));
    root.style.setProperty("--bg2", hsl(bgH, 26, 10));
    root.style.setProperty("--bg3", hsl(bgH, 24, 14));
    root.style.setProperty("--card", hsl(bgH, 22, 12));
    root.style.setProperty("--border", hsl(bgH, 20, 24));
    root.style.setProperty("--text", hsl(bgH, 15, 93));
    root.style.setProperty("--muted", hsl(bgH, 12, 65));
    root.style.setProperty("--cyan", hsl(h1, 85, 62));
    root.style.setProperty("--violet", hsl(h2, 75, 68));
    root.style.setProperty("--pink", hsl(h3, 80, 68));
    root.style.setProperty("--green", hsl((h1 + 100) % 360, 70, 55));
    root.style.setProperty("--amber", hsl((h2 + 40) % 360, 85, 58));
    root.style.setProperty("--red", hsl((h1 + 300) % 360, 75, 62));
    root.style.setProperty("--glow-a", hsla(h1, 90, 55, 0.14));
    root.style.setProperty("--glow-b", hsla(h2, 85, 55, 0.12));

    var badge = document.querySelector(".hero .badge");
    if (badge) {
      badge.textContent =
        "Tema aleatorio · H" +
        Math.round(h1) +
        "° · recarga para cambiar colores";
    }

    var chip = document.getElementById("theme-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "theme-chip";
      document.body.appendChild(chip);
    }
    chip.textContent = "tema " + Math.round(h1) + "°/" + Math.round(h2) + "°";
    chip.style.cssText =
      "position:fixed;bottom:12px;right:12px;z-index:9999;" +
      "font:12px/1.2 ui-monospace,Consolas,monospace;" +
      "padding:6px 10px;border-radius:999px;" +
      "background:var(--card);color:var(--cyan);" +
      "border:1px solid var(--border);" +
      "box-shadow:0 4px 20px rgba(0,0,0,.35);opacity:.92;cursor:pointer;";
    chip.title = "Clic para otro tema";
    chip.onclick = applyRandomTheme;
  }

  ensureTrailingSlash();

  if (document.body) applyRandomTheme();
  else document.addEventListener("DOMContentLoaded", applyRandomTheme);

  window.rerollTheme = applyRandomTheme;
})();
