/**
 * Navegación por pestañas — evita una página interminable
 */
(function () {
  "use strict";

  /** Mapa hash / id de sección → id de pestaña */
  var HASH_TO_TAB = {
    top: "simulador",
    playground: "simulador",
    simulador: "simulador",
    aprender: "aprender",
    "lab-1q": "lab-1q",
    "lab-bell": "lab-bell",
    "lab-noise": "lab-noise",
    "lab-grover": "lab-grover",
    qml: "qml",
    motores: "motores",
    codigo: "motores",
  };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function switchTab(tabId, opts) {
    opts = opts || {};
    if (!tabId) tabId = "simulador";

    var buttons = qsa("[data-tab]");
    var panels = qsa("[data-tab-panel]");
    var found = false;

    panels.forEach(function (p) {
      var on = p.getAttribute("data-tab-panel") === tabId;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
      if (on) found = true;
    });

    if (!found) {
      tabId = "simulador";
      panels.forEach(function (p) {
        var on = p.getAttribute("data-tab-panel") === tabId;
        p.classList.toggle("is-active", on);
        p.hidden = !on;
      });
    }

    buttons.forEach(function (b) {
      var on = b.getAttribute("data-tab") === tabId;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });

    // Actualizar hash sin saltar de forma brusca
    if (!opts.skipHash) {
      var hash = opts.hash || tabId;
      if (history.replaceState) {
        history.replaceState(null, "", "#" + hash);
      } else {
        location.hash = hash;
      }
    }

    // Disparar resize por si canvas/labs necesitan repintar
    try {
      window.dispatchEvent(new Event("resize"));
    } catch (e) {}

    window.currentTab = tabId;
    return tabId;
  }

  function tabForHash(hash) {
    if (!hash) return "simulador";
    hash = String(hash).replace(/^#/, "");
    return HASH_TO_TAB[hash] || hash || "simulador";
  }

  /** Abre la pestaña que contiene un selector (para el tour) */
  function switchTabForSelector(sel) {
    if (!sel) return switchTab("simulador");
    var el = qs(sel);
    if (!el) return switchTab("simulador");
    var panel = el.closest("[data-tab-panel]");
    if (panel) {
      return switchTab(panel.getAttribute("data-tab-panel"), {
        hash: el.id || panel.getAttribute("data-tab-panel"),
      });
    }
    return switchTab("simulador");
  }

  function init() {
    var root = qs("#tabs-root");
    if (!root) return;

    // Clicks en pestañas
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tab]");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      switchTab(btn.getAttribute("data-tab"));
    });

    // Teclado en la barra
    var bar = qs(".tabs-bar", root);
    if (bar) {
      bar.addEventListener("keydown", function (e) {
        var tabs = qsa("[data-tab]", bar);
        var i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        var next = i;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[next].focus();
        switchTab(tabs[next].getAttribute("data-tab"));
      });
    }

    // Enlaces internos con hash → cambiar pestaña
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href === "#") return;
      var id = href.slice(1);
      if (HASH_TO_TAB[id] || qs('[data-tab-panel="' + id + '"]') || qs("#" + id)) {
        var tab = tabForHash(id);
        // solo interceptar si el destino está en un panel
        var target = qs("#" + id);
        if (target && target.closest("[data-tab-panel]")) {
          e.preventDefault();
          switchTab(tab, { hash: id });
          setTimeout(function () {
            var el = qs("#" + id);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        } else if (qs('[data-tab-panel="' + id + '"]')) {
          e.preventDefault();
          switchTab(id);
        }
      }
    });

    window.addEventListener("hashchange", function () {
      switchTab(tabForHash(location.hash), { skipHash: true });
    });

    // Estado inicial
    switchTab(tabForHash(location.hash), { skipHash: !location.hash });
  }

  window.switchTab = switchTab;
  window.switchTabForSelector = switchTabForSelector;
  window.tabForHash = tabForHash;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
