/**
 * Tema aleatorio en cada recarga + utilidades de arranque de la web.
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
    return "hsla(" + Math.round(h) + " " + Math.round(s) + "% " + Math.round(l) + "% / " + a + ")";
  }

  /** Genera una paleta coherente (fondo oscuro + acentos) */
  function applyRandomTheme() {
    var h1 = rand(0, 360); // acento principal
    var h2 = (h1 + rand(40, 90)) % 360; // acento secundario
    var h3 = (h1 + rand(120, 200)) % 360; // acento terciario
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

    // brillos de fondo
    root.style.setProperty("--glow-a", hsla(h1, 90, 55, 0.14));
    root.style.setProperty("--glow-b", hsla(h2, 85, 55, 0.12));

    // muestra en badge si existe
    var badge = document.querySelector(".hero .badge");
    if (badge) {
      badge.textContent =
        "Tema aleatorio · H" +
        Math.round(h1) +
        "° · recarga para cambiar colores";
    }

    // indicador flotante (confirma que el JS corre)
    var chip = document.getElementById("theme-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "theme-chip";
      chip.setAttribute("aria-hidden", "true");
      document.body.appendChild(chip);
    }
    chip.textContent = "tema " + Math.round(h1) + "°/" + Math.round(h2) + "°";
    chip.style.cssText =
      "position:fixed;bottom:12px;right:12px;z-index:9999;" +
      "font:12px/1.2 ui-monospace,Consolas,monospace;" +
      "padding:6px 10px;border-radius:999px;" +
      "background:var(--card);color:var(--cyan);" +
      "border:1px solid var(--border);" +
      "box-shadow:0 4px 20px rgba(0,0,0,.35);opacity:.92;";
  }

  /**
   * GitHub Pages: sin barra final, las rutas relativas apuntan mal
   * (…/quantum-sim-c + js/x → …/js/x). Redirige a …/quantum-sim-c/
   */
  function ensureTrailingSlash() {
    var path = location.pathname;
    // …/quantum-sim-c  →  …/quantum-sim-c/  (crítico para assets relativos)
    if (/\/quantum-sim-c$/i.test(path)) {
      location.replace(path + "/" + location.search + location.hash);
      return;
    }
    if (path.slice(-1) === "/") return;
    if (/\.html?$/i.test(path)) return;
    // otros directorios sin barra final
    if (path.length > 1 && path.indexOf(".") === -1) {
      location.replace(path + "/" + location.search + location.hash);
    }
  }

  ensureTrailingSlash();

  // <base> ayuda si alguien enlaza sin barra final y el redirect no corre a tiempo
  (function setBase() {
    if (document.querySelector("base")) return;
    var path = location.pathname;
    var m = path.match(/^(.*\/quantum-sim-c)(?:\/|$)/i);
    if (!m) return;
    var b = document.createElement("base");
    b.href = m[1] + "/";
    document.head.insertBefore(b, document.head.firstChild);
  })();

  applyRandomTheme();

  // API por si se quiere otro tema sin recargar
  window.rerollTheme = applyRandomTheme;
})();
