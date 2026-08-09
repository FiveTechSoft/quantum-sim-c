/**
 * Playground: usar el simulador (API quantum_sim) desde la web
 */
(function () {
  "use strict";
  var QS = window.QuantumSim;
  if (!QS) {
    console.error("QuantumSim no cargado");
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }

  var EXAMPLES = {
    bell: {
      name: "Bell Φ+",
      code:
        "# Estado de Bell |Φ+⟩ = (|00⟩+|11⟩)/√2\n" +
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
      name: "Grover |11⟩",
      code:
        "# 1 iteración de Grover, marca |11⟩\n" +
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
      name: "Teleportación (prep.)",
      code:
        "# q0 = mensaje, q1-q2 = Bell; mide Alice\n" +
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
        "# Oráculo f(x)=x → CNOT; resultado q0=1 → balanceada\n" +
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
      name: "Vacío",
      code:
        "# Escribe tu circuito (qubit 0 = LSB)\n" +
        "qubits 2\n" +
        "H 0\n" +
        "PRINT\n",
    },
  };

  function renderAmps(container, qs) {
    var p = QS.probs(qs);
    var html = "";
    for (var i = 0; i < qs.dim; i++) {
      if (p[i] < 1e-10 && qs.dim > 8) continue;
      var pct = (p[i] * 100).toFixed(1);
      html +=
        '<div class="amp-row">' +
        '<span class="ket">' +
        QS.ketStr(i, qs.n_qubits) +
        "</span>" +
        '<div class="amp-bar-bg"><div class="amp-bar" style="width:' +
        pct +
        '%"></div></div>' +
        "<span>" +
        pct +
        "%</span></div>";
    }
    container.innerHTML = html || "<p class='muted small'>Sin amplitudes</p>";
  }

  function renderHist(container, qs) {
    var p = QS.probs(qs);
    var html = "";
    var maxShow = Math.min(qs.dim, 16);
    for (var i = 0; i < maxShow; i++) {
      var pct = p[i] * 100;
      var h = Math.max(2, (pct / 100) * 110);
      html +=
        '<div class="hist-col">' +
        '<div class="hist-pct">' +
        pct.toFixed(0) +
        "%</div>" +
        '<div class="hist-bar" style="height:' +
        h +
        'px"></div>' +
        '<div class="hist-label">' +
        QS.ketStr(i, qs.n_qubits) +
        "</div></div>";
    }
    if (qs.dim > 16)
      html +=
        "<p class='muted small'>Mostrando 16/" + qs.dim + " basestates</p>";
    container.innerHTML = html;
  }

  function setStatus(msg, isErr) {
    var el = $("pg-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? "var(--red)" : "var(--green)";
  }

  function run() {
    var code = $("pg-code").value;
    try {
      var result = QS.runCircuit(code);
      $("pg-log").textContent = result.log.join("\n") || "(sin log)";
      renderAmps($("pg-amps"), result.state);
      renderHist($("pg-hist"), result.state);
      var mtxt = result.measures
        .map(function (m) {
          if (m.all)
            return (
              "measure_all → " +
              m.value +
              " " +
              QS.ketStr(m.value, result.state.n_qubits)
            );
          return "measure_qubit(" + m.qubit + ") → " + m.value;
        })
        .join(" · ");
      setStatus(
        "OK · " +
          result.state.n_qubits +
          " qubits · ||ψ||²=" +
          result.norm2.toFixed(6) +
          (mtxt ? " · " + mtxt : ""),
        false
      );
      $("pg-nqubits").value = String(result.state.n_qubits);
    } catch (e) {
      setStatus(e.message, true);
      $("pg-log").textContent = e.message;
    }
  }

  function insertGate(line) {
    var ta = $("pg-code");
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var v = ta.value;
    var prefix = start > 0 && v[start - 1] !== "\n" ? "\n" : "";
    var text = prefix + line + "\n";
    ta.value = v.slice(0, start) + text + v.slice(end);
    ta.focus();
    var pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
  }

  function loadExample(key) {
    var ex = EXAMPLES[key];
    if (!ex) return;
    $("pg-code").value = ex.code;
    setStatus("Ejemplo cargado: " + ex.name + " — pulsa Ejecutar", false);
  }

  function wire() {
    if (!$("pg-code")) return;

    $("pg-run").onclick = run;
    $("pg-clear-log").onclick = function () {
      $("pg-log").textContent = "";
      setStatus("Log limpio", false);
    };

    // examples
    var sel = $("pg-examples");
    if (sel) {
      Object.keys(EXAMPLES).forEach(function (k) {
        var opt = document.createElement("option");
        opt.value = k;
        opt.textContent = EXAMPLES[k].name;
        sel.appendChild(opt);
      });
      sel.onchange = function () {
        loadExample(sel.value);
      };
    }

    $("pg-load-ex").onclick = function () {
      loadExample($("pg-examples").value);
      run();
    };

    // gate buttons
    document.querySelectorAll("[data-gate]").forEach(function (btn) {
      btn.onclick = function () {
        var g = btn.getAttribute("data-gate");
        var q = $("pg-q").value || "0";
        var q2 = $("pg-q2").value || "1";
        var q3 = $("pg-q3").value || "2";
        var ang = $("pg-ang").value || "pi/2";
        var p = $("pg-noise-p").value || "0.1";
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
      };
    });

    $("pg-nqubits").onchange = function () {
      var n = parseInt($("pg-nqubits").value, 10) || 2;
      insertGate("qubits " + n);
    };

    // Ctrl+Enter to run
    $("pg-code").addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });

    loadExample("bell");
    run();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
