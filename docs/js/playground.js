/**
 * Playground del simulador — cableado robusto del botón Ejecutar
 */
(function () {
  "use strict";

  var runCount = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function engine() {
    return window.QuantumSim || null;
  }

  function setStatus(msg, isErr) {
    var el = $("pg-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? "#f87171" : "#34d399";
    el.style.fontWeight = "600";
  }

  function flash(el) {
    if (!el) return;
    el.style.outline = "2px solid #3ee0ff";
    el.style.transition = "outline 0.2s";
    setTimeout(function () {
      el.style.outline = "none";
    }, 400);
  }

  var EXAMPLES = {
    bell: {
      name: "Bell Φ+",
      code:
        "# Bell |00>+|11>\n" +
        "qubits 2\n" +
        "H 0\n" +
        "CNOT 0 1\n" +
        "PRINT\n" +
        "PROBS\n",
    },
    ghz: {
      name: "GHZ 3 qubits",
      code:
        "qubits 3\n" +
        "H 0\n" +
        "CNOT 0 1\n" +
        "CNOT 1 2\n" +
        "PRINT\n" +
        "PROBS\n",
    },
    grover: {
      name: "Grover |11>",
      code:
        "# Grover 1 iteracion, marca |11>\n" +
        "qubits 2\n" +
        "H_ALL\n" +
        "CZ 0 1\n" +
        "H 0\n" +
        "H 1\n" +
        "X 0\n" +
        "X 1\n" +
        "CZ 0 1\n" +
        "X 0\n" +
        "X 1\n" +
        "H 0\n" +
        "H 1\n" +
        "PROBS\n",
    },
    teleport: {
      name: "Teleportacion (prep.)",
      code:
        "qubits 3\n" +
        "RY 0 pi/3\n" +
        "H 1\n" +
        "CNOT 1 2\n" +
        "CNOT 0 1\n" +
        "H 0\n" +
        "PRINT\n" +
        "MEASURE 0\n" +
        "MEASURE 1\n" +
        "PROBS\n",
    },
    deutsch: {
      name: "Deutsch (f=x)",
      code:
        "qubits 2\n" +
        "X 1\n" +
        "H 0\n" +
        "H 1\n" +
        "CNOT 0 1\n" +
        "H 0\n" +
        "MEASURE 0\n" +
        "PROBS\n",
    },
    noise: {
      name: "Bell + ruido",
      code:
        "qubits 2\n" +
        "SEED 42\n" +
        "H 0\n" +
        "CNOT 0 1\n" +
        "NOISE_DEP 0 0.15\n" +
        "NOISE_DEP 1 0.15\n" +
        "PRINT\n" +
        "PROBS\n",
    },
    toffoli: {
      name: "Toffoli CCX",
      code:
        "qubits 3\n" +
        "X 0\n" +
        "X 1\n" +
        "TOFFOLI 0 1 2\n" +
        "PRINT\n" +
        "PROBS\n",
    },
    empty: {
      name: "Vacio",
      code: "# Tu circuito\nqubits 2\nH 0\nPRINT\n",
    },
  };

  function renderAmps(container, qs, QS) {
    if (!container || !qs) return;
    var p = QS.probs(qs);
    var html = "";
    for (var i = 0; i < qs.dim; i++) {
      if (p[i] < 1e-10 && qs.dim > 8) continue;
      var pct = (p[i] * 100).toFixed(1);
      html +=
        '<div class="amp-row"><span class="ket">' +
        QS.ketStr(i, qs.n_qubits) +
        '</span><div class="amp-bar-bg"><div class="amp-bar" style="width:' +
        pct +
        '%"></div></div><span>' +
        pct +
        "%</span></div>";
    }
    container.innerHTML = html || "<p class='muted small'>Sin amplitudes</p>";
  }

  function renderHist(container, qs, QS) {
    if (!container || !qs) return;
    var p = QS.probs(qs);
    var html = "";
    var maxShow = Math.min(qs.dim, 16);
    for (var i = 0; i < maxShow; i++) {
      var pct = p[i] * 100;
      var h = Math.max(2, (pct / 100) * 110);
      html +=
        '<div class="hist-col"><div class="hist-pct">' +
        pct.toFixed(0) +
        '%</div><div class="hist-bar" style="height:' +
        h +
        'px"></div><div class="hist-label">' +
        QS.ketStr(i, qs.n_qubits) +
        "</div></div>";
    }
    container.innerHTML = html;
  }

  /** Punto de entrada global — también lo usa el onclick inline del HTML */
  function runCircuitFromUI() {
    runCount += 1;
    var QS = engine();
    var codeEl = $("pg-code");
    var logEl = $("pg-log");

    if (!QS || typeof QS.runCircuit !== "function") {
      var msg =
        "ERROR: motor QuantumSim no cargado. Recarga con Ctrl+F5. " +
        "URL correcta: https://fivetechsoft.github.io/quantum-sim-c/";
      setStatus(msg, true);
      if (logEl) logEl.textContent = msg;
      console.error(msg, "QuantumSim=", window.QuantumSim);
      return false;
    }
    if (!codeEl) {
      setStatus("ERROR: no hay textarea #pg-code", true);
      return false;
    }

    var code = codeEl.value;
    try {
      var result = QS.runCircuit(code);
      if (logEl) {
        logEl.textContent =
          "[run #" +
          runCount +
          "]\n" +
          (result.log.join("\n") || "(sin log)");
      }
      renderAmps($("pg-amps"), result.state, QS);
      renderHist($("pg-hist"), result.state, QS);

      var mtxt = (result.measures || [])
        .map(function (m) {
          if (m.all)
            return (
              "measure_all=" +
              m.value +
              " " +
              QS.ketStr(m.value, result.state.n_qubits)
            );
          return "measure(" + m.qubit + ")=" + m.value;
        })
        .join(" · ");

      setStatus(
        "OK run #" +
          runCount +
          " · " +
          result.state.n_qubits +
          "q · ||ψ||²=" +
          result.norm2.toFixed(6) +
          (mtxt ? " · " + mtxt : ""),
        false
      );

      var nq = $("pg-nqubits");
      if (nq) nq.value = String(result.state.n_qubits);

      flash(logEl);
      flash($("pg-amps"));
      return true;
    } catch (e) {
      var err = e && e.message ? e.message : String(e);
      setStatus("ERROR: " + err, true);
      if (logEl) logEl.textContent = "[run #" + runCount + "]\n" + err;
      console.error(e);
      return false;
    }
  }

  window.__pgRun = runCircuitFromUI;
  window.runQuantumCircuit = runCircuitFromUI;

  function insertGate(line) {
    var ta = $("pg-code");
    if (!ta) return;
    var start = ta.selectionStart || ta.value.length;
    var end = ta.selectionEnd || start;
    var v = ta.value;
    var prefix = start > 0 && v.charAt(start - 1) !== "\n" ? "\n" : "";
    var text = prefix + line + "\n";
    ta.value = v.slice(0, start) + text + v.slice(end);
    ta.focus();
    var pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
  }

  function loadExample(key) {
    var ex = EXAMPLES[key];
    if (!ex || !$("pg-code")) return;
    $("pg-code").value = ex.code;
    setStatus("Ejemplo: " + ex.name + " — pulsa Ejecutar", false);
  }

  function wire() {
    // Delegación: funciona aunque se reemplace el botón
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t) return;
      // subir por si el clic es en un hijo del botón
      var el = t.id ? t : t.closest ? t.closest("button, [data-gate], #pg-run") : t;
      if (!el) return;

      if (el.id === "pg-run" || el.getAttribute("data-action") === "run") {
        ev.preventDefault();
        runCircuitFromUI();
        return;
      }
      if (el.id === "pg-load-ex") {
        ev.preventDefault();
        var sel = $("pg-examples");
        loadExample(sel ? sel.value : "bell");
        runCircuitFromUI();
        return;
      }
      if (el.id === "pg-clear-log") {
        ev.preventDefault();
        if ($("pg-log")) $("pg-log").textContent = "";
        setStatus("Log limpio", false);
        return;
      }
      var g = el.getAttribute && el.getAttribute("data-gate");
      if (g) {
        ev.preventDefault();
        var q = ($("pg-q") && $("pg-q").value) || "0";
        var q2 = ($("pg-q2") && $("pg-q2").value) || "1";
        var q3 = ($("pg-q3") && $("pg-q3").value) || "2";
        var ang = ($("pg-ang") && $("pg-ang").value) || "pi/2";
        var p = ($("pg-noise-p") && $("pg-noise-p").value) || "0.1";
        var map = {
          H: "H " + q,
          X: "X " + q,
          Y: "Y " + q,
          Z: "Z " + q,
          S: "S " + q,
          T: "T " + q,
          RX: "RX " + q + " " + ang,
          RY: "RY " + q + " " + ang,
          RZ: "RZ " + q + " " + ang,
          CNOT: "CNOT " + q + " " + q2,
          CZ: "CZ " + q + " " + q2,
          SWAP: "SWAP " + q + " " + q2,
          TOFFOLI: "TOFFOLI " + q + " " + q2 + " " + q3,
          H_ALL: "H_ALL",
          MEASURE: "MEASURE " + q,
          MEASURE_ALL: "MEASURE_ALL",
          PRINT: "PRINT",
          PROBS: "PROBS",
          RESET: "RESET",
          NOISE_DEP: "NOISE_DEP " + q + " " + p,
        };
        if (map[g]) insertGate(map[g]);
      }
    });

    var sel = $("pg-examples");
    if (sel && !sel.options.length) {
      Object.keys(EXAMPLES).forEach(function (k) {
        var opt = document.createElement("option");
        opt.value = k;
        opt.textContent = EXAMPLES[k].name;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function () {
        loadExample(sel.value);
      });
    }

    var nq = $("pg-nqubits");
    if (nq) {
      nq.addEventListener("change", function () {
        insertGate("qubits " + (parseInt(nq.value, 10) || 2));
      });
    }

    var code = $("pg-code");
    if (code) {
      code.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          runCircuitFromUI();
        }
      });
    }

    // Asignación directa por si la delegación fallara
    var btn = $("pg-run");
    if (btn) {
      btn.onclick = function (e) {
        if (e) e.preventDefault();
        runCircuitFromUI();
        return false;
      };
    }

    // Estado del motor
    var QS = engine();
    if (!QS) {
      setStatus(
        "Motor no cargado todavía — espera un segundo o Ctrl+F5",
        true
      );
    } else {
      setStatus("Motor listo. Pulsa Ejecutar o Ctrl+Enter.", false);
    }

    // Cargar ejemplo y auto-ejecutar
    if ($("pg-code") && !$("pg-code").value.trim()) {
      loadExample("bell");
    }
    // Ejecutar cuando el motor esté listo (reintentos)
    var tries = 0;
    (function tryRun() {
      tries += 1;
      if (engine()) {
        runCircuitFromUI();
        return;
      }
      if (tries < 20) setTimeout(tryRun, 100);
      else
        setStatus(
          "No se pudo cargar quantum_sim.js — revisa la consola (F12)",
          true
        );
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
