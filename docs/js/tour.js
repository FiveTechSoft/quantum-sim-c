/**
 * Tour guiado con bocadillos paso a paso
 */
(function () {
  "use strict";

  var STEPS = [
    {
      sel: "#playground",
      title: "Bienvenido al simulador",
      text:
        "Aquí usas el mismo modelo que en C (statevector). Un circuito es una lista de puertas sobre qubits. Vamos paso a paso.",
    },
    {
      sel: "#pg-examples",
      title: "1 · Elige un ejemplo",
      text:
        "Empieza con «Bell Φ+». Carga un circuito ya escrito para no pelearte con la sintaxis al principio.",
      action: function () {
        var s = document.getElementById("pg-examples");
        if (s) {
          s.value = "bell";
          s.dispatchEvent(new Event("change"));
        }
      },
    },
    {
      sel: "#pg-load-ex",
      title: "2 · Cargar y ejecutar",
      text:
        "Este botón pone el ejemplo en el editor y lo corre. Equivale a escribir el código y pulsar Ejecutar.",
    },
    {
      sel: "#pg-code",
      title: "3 · El circuito (texto)",
      text:
        "Cada línea es una operación: qubits N crea el registro |0…0⟩; H 0 aplica Hadamard al qubit 0; CNOT 0 1 entrelaza. En C sería gate_h(qs,0); gate_cnot(qs,0,1);",
    },
    {
      sel: ".pg-gate-panel",
      title: "4 · Paleta de puertas",
      text:
        "Los botones insertan líneas en el editor. H = superposición, X = NOT, CNOT = controlado, MEASURE colapsa el estado.",
    },
    {
      sel: "#pg-run",
      title: "5 · Ejecutar el motor",
      text:
        "Pulsa Ejecutar (o Ctrl+Enter). El motor aplica las puertas en orden sobre el vector de amplitudes — igual que quantum_sim.c.",
      action: function () {
        if (window.__pgRun) window.__pgRun();
      },
    },
    {
      sel: "#pg-log",
      title: "6 · Log del motor",
      text:
        "Aquí ves el equivalente a printf del C: cada gate_*, el estado y las probabilidades. Si hay error de sintaxis, también aparece aquí.",
    },
    {
      sel: "#pg-amps",
      title: "7 · Amplitudes",
      text:
        "Cada barra es |amplitud|² de un estado base (|00⟩, |01⟩…). En Bell ideal solo brillan |00⟩ y |11⟩ al 50%.",
    },
    {
      sel: "#pg-hist",
      title: "8 · Histograma",
      text:
        "Misma información en forma de histograma de probabilidades. Si midieras muchas veces, obtendrías frecuencias parecidas.",
    },
    {
      sel: "#lab-1q",
      title: "Lab 1 · Superposición",
      text:
        "Un solo qubit: parte de |0⟩, aplica H y mide. Verás el 50/50 y la esfera de Bloch en el ecuador.",
    },
    {
      sel: "#btn-h-1q",
      title: "Prueba Hadamard",
      text:
        "Pulsa H: el estado pasa de «seguro 0» a superposición. Luego «Medir 1 vez» y observa el histograma.",
    },
    {
      sel: "#lab-bell",
      title: "Lab 2 · Entrelazamiento",
      text:
        "H en q0 + CNOT crea el par de Bell. Cada qubit por separado es aleatorio, pero ambos miden siempre igual.",
    },
    {
      sel: "#btn-bell-build",
      title: "Crear Bell y medir",
      text:
        "Crea Φ+, luego haz 40 tiros. Solo deberían aparecer |00⟩ y |11⟩ — esa es la firma del entrelazamiento.",
    },
    {
      sel: "#lab-noise",
      title: "Lab 3 · Ruido NISQ",
      text:
        "Mueve el deslizador p: la correlación ⟨ZZ⟩ cae. En hardware real el ruido limita la profundidad del circuito.",
    },
    {
      sel: "#lab-grover",
      title: "Lab 4 · Grover",
      text:
        "Algoritmo de búsqueda: idealmente P(|11⟩)≈100%. Con ruido tras cada capa, el éxito se degrada.",
    },
    {
      sel: "#qml",
      title: "QML vs IA clásica",
      text:
        "Un VQC puede ganar a un modelo lineal (XOR), pero el MLP es el baseline serio. No hay magia cuántica automática.",
    },
    {
      sel: "#motores",
      title: "Dos motores en C",
      text:
        "Statevector: cualquier puerta, ~12 qubits. Estabilizadores: solo Clifford, cientos de qubits (GHZ, códigos de error).",
    },
  ];

  var idx = 0;
  var backdrop, bubble, highlightEl;

  function $(sel) {
    return document.querySelector(sel);
  }

  function clearHighlight() {
    if (highlightEl) {
      highlightEl.classList.remove("tour-highlight");
      highlightEl = null;
    }
  }

  function placeBubble(target) {
    if (!bubble || !target) return;
    var rect = target.getBoundingClientRect();
    var bw = Math.min(340, window.innerWidth - 24);
    var left = rect.left + rect.width / 2 - bw / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - bw - 12));

    var top = rect.bottom + 14;
    bubble.style.width = bw + "px";
    bubble.style.left = left + "px";
    // si no cabe abajo, poner arriba
    bubble.classList.add("visible");
    var bh = bubble.offsetHeight || 180;
    if (top + bh > window.innerHeight - 12) {
      top = Math.max(12, rect.top - bh - 14);
    }
    bubble.style.top = top + "px";
  }

  function showStep(i) {
    idx = i;
    if (idx < 0) idx = 0;
    if (idx >= STEPS.length) {
      stopTour();
      return;
    }
    var step = STEPS[idx];
    clearHighlight();

    var el = $(step.sel);
    if (!el) {
      // saltar pasos sin elemento
      showStep(idx + 1);
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function () {
      el.classList.add("tour-highlight");
      highlightEl = el;
      if (typeof step.action === "function") {
        try {
          step.action();
        } catch (e) {
          console.warn(e);
        }
      }
      bubble.querySelector(".tour-kicker").textContent =
        "Paso " + (idx + 1) + " / " + STEPS.length;
      bubble.querySelector("h3").textContent = step.title;
      bubble.querySelector("p").textContent = step.text;
      bubble.querySelector(".tour-progress").textContent =
        idx + 1 + " · " + STEPS.length;
      placeBubble(el);
    }, 280);
  }

  function startTour(from) {
    if (!backdrop) buildUI();
    backdrop.classList.add("active");
    bubble.classList.add("visible");
    showStep(typeof from === "number" ? from : 0);
  }

  function stopTour() {
    clearHighlight();
    if (backdrop) backdrop.classList.remove("active");
    if (bubble) bubble.classList.remove("visible");
  }

  function next() {
    showStep(idx + 1);
  }
  function prev() {
    showStep(idx - 1);
  }

  function buildUI() {
    backdrop = document.createElement("div");
    backdrop.className = "tour-backdrop";
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) stopTour();
    });

    bubble = document.createElement("div");
    bubble.className = "tour-bubble";
    bubble.innerHTML =
      '<div class="tour-kicker">Paso</div>' +
      "<h3></h3>" +
      "<p></p>" +
      '<div class="tour-actions">' +
      '<button type="button" class="btn btn-sm" data-tour="prev">← Anterior</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-tour="next">Siguiente →</button>' +
      '<span class="spacer"></span>' +
      '<span class="tour-progress"></span>' +
      '<button type="button" class="btn btn-sm" data-tour="close">Cerrar</button>' +
      "</div>";

    bubble.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tour]");
      if (!t) return;
      var a = t.getAttribute("data-tour");
      if (a === "next") next();
      else if (a === "prev") prev();
      else if (a === "close") stopTour();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(bubble);

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "tour-fab";
    fab.id = "tour-fab";
    fab.textContent = "Guía paso a paso";
    fab.title = "Recorrido con bocadillos didácticos";
    fab.addEventListener("click", function () {
      startTour(0);
    });
    document.body.appendChild(fab);

    window.addEventListener(
      "resize",
      function () {
        if (highlightEl && bubble && bubble.classList.contains("visible")) {
          placeBubble(highlightEl);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "scroll",
      function () {
        if (highlightEl && bubble && bubble.classList.contains("visible")) {
          placeBubble(highlightEl);
        }
      },
      { passive: true }
    );
  }

  function wireStartButtons() {
    document.querySelectorAll("[data-start-tour]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var n = parseInt(btn.getAttribute("data-start-tour"), 10);
        startTour(isNaN(n) ? 0 : n);
      });
    });
  }

  function init() {
    buildUI();
    wireStartButtons();
    window.startQuantumTour = startTour;
    window.stopQuantumTour = stopTour;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
