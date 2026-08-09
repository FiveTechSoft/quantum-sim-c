/**
 * Puerto fiel del simulador statevector en C (quantum_sim.c / .h)
 * Misma convención: qubit 0 = LSB. Máx. 10 qubits en web (2^10 = 1024).
 *
 * API expuesta como QuantumSim.* con nombres cercanos al C:
 *   create, free, reset, clone, print, printProbs, norm2
 *   gate_h, gate_x, ... gate_cnot, measure_qubit, measure_all, ...
 *   noise_bit_flip, noise_depolarizing, ...
 */
(function (global) {
  "use strict";

  var QC_MAX_QUBITS = 10;
  var EPS = 1e-12;
  var M_PI = Math.PI;

  /* ---------- RNG (xorshift, como en C) ---------- */
  var g_rng = 1;
  function qs_seed(seed) {
    g_rng = seed ? seed >>> 0 : 1;
  }
  function qs_rand01() {
    g_rng ^= (g_rng << 13) >>> 0;
    g_rng ^= g_rng >>> 17;
    g_rng ^= (g_rng << 5) >>> 0;
    g_rng >>>= 0;
    return g_rng / 4294967296;
  }

  /* ---------- Complejos ---------- */
  function C(re, im) {
    return { re: re, im: im || 0 };
  }
  function c_add(a, b) {
    return C(a.re + b.re, a.im + b.im);
  }
  function c_mul(a, b) {
    return C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }
  function c_scale(a, s) {
    return C(a.re * s, a.im * s);
  }
  function c_conj(a) {
    return C(a.re, -a.im);
  }
  function c_abs2(a) {
    return a.re * a.re + a.im * a.im;
  }

  /* ---------- Estado ---------- */
  function qs_create(n_qubits) {
    n_qubits = n_qubits | 0;
    if (n_qubits < 1 || n_qubits > QC_MAX_QUBITS) {
      throw new Error("n_qubits debe estar en 1.." + QC_MAX_QUBITS);
    }
    var dim = 1 << n_qubits;
    var amps = new Array(dim);
    for (var i = 0; i < dim; i++) amps[i] = C(0, 0);
    amps[0] = C(1, 0);
    return { n_qubits: n_qubits, dim: dim, amps: amps };
  }

  function qs_free(qs) {
    /* GC; API simétrica con C */
    if (qs) {
      qs.amps = null;
      qs.dim = 0;
    }
  }

  function qs_reset(qs) {
    for (var i = 0; i < qs.dim; i++) qs.amps[i] = C(0, 0);
    qs.amps[0] = C(1, 0);
  }

  function qs_clone(qs) {
    var c = qs_create(qs.n_qubits);
    for (var i = 0; i < qs.dim; i++)
      c.amps[i] = C(qs.amps[i].re, qs.amps[i].im);
    return c;
  }

  function qs_norm2(qs) {
    var s = 0;
    for (var i = 0; i < qs.dim; i++) s += c_abs2(qs.amps[i]);
    return s;
  }

  function ketStr(i, n) {
    var s = "";
    for (var b = n - 1; b >= 0; b--) s += (i >> b) & 1 ? "1" : "0";
    return "|" + s + "⟩";
  }

  function qs_print_lines(qs) {
    var lines = [];
    lines.push(
      "Estado (" +
        qs.n_qubits +
        " qubits, dim=" +
        qs.dim +
        ", ||ψ||²=" +
        qs_norm2(qs).toFixed(6) +
        "):"
    );
    for (var i = 0; i < qs.dim; i++) {
      var p = c_abs2(qs.amps[i]);
      if (p < 1e-10) continue;
      var a = qs.amps[i];
      lines.push(
        "  " +
          ketStr(i, qs.n_qubits) +
          "  amp = " +
          (a.re >= 0 ? "+" : "") +
          a.re.toFixed(6) +
          (a.im >= 0 ? "+" : "") +
          a.im.toFixed(6) +
          "i   P=" +
          p.toFixed(4)
      );
    }
    return lines;
  }

  function qs_print_probs_lines(qs) {
    var lines = ["Probabilidades:"];
    for (var i = 0; i < qs.dim; i++) {
      var p = c_abs2(qs.amps[i]);
      if (p < 1e-10) continue;
      var bars = Math.round(p * 40);
      var bar = "";
      for (var k = 0; k < bars; k++) bar += "#";
      lines.push(
        "  " + ketStr(i, qs.n_qubits) + "  " + p.toFixed(4) + "  (" + bar + ")"
      );
    }
    return lines;
  }

  function apply_1q(qs, target, u00, u01, u10, u11) {
    var bit = 1 << target;
    var step = bit << 1;
    for (var base = 0; base < qs.dim; base += step) {
      for (var offset = 0; offset < bit; offset++) {
        var i0 = base + offset;
        var i1 = i0 + bit;
        var a0 = qs.amps[i0];
        var a1 = qs.amps[i1];
        qs.amps[i0] = c_add(c_mul(u00, a0), c_mul(u01, a1));
        qs.amps[i1] = c_add(c_mul(u10, a0), c_mul(u11, a1));
      }
    }
  }

  function gate_h(qs, t) {
    var s = 1 / Math.sqrt(2);
    apply_1q(qs, t, C(s), C(s), C(s), C(-s));
  }
  function gate_x(qs, t) {
    apply_1q(qs, t, C(0), C(1), C(1), C(0));
  }
  function gate_y(qs, t) {
    apply_1q(qs, t, C(0), C(0, -1), C(0, 1), C(0));
  }
  function gate_z(qs, t) {
    apply_1q(qs, t, C(1), C(0), C(0), C(-1));
  }
  function gate_s(qs, t) {
    apply_1q(qs, t, C(1), C(0), C(0), C(0, 1));
  }
  function gate_sdg(qs, t) {
    apply_1q(qs, t, C(1), C(0), C(0), C(0, -1));
  }
  function gate_t(qs, t) {
    var a = 1 / Math.sqrt(2);
    apply_1q(qs, t, C(1), C(0), C(0), C(a, a));
  }
  function gate_tdg(qs, t) {
    var a = 1 / Math.sqrt(2);
    apply_1q(qs, t, C(1), C(0), C(0), C(a, -a));
  }
  function gate_rx(qs, t, theta) {
    var c = Math.cos(theta / 2);
    var s = Math.sin(theta / 2);
    apply_1q(qs, t, C(c), C(0, -s), C(0, -s), C(c));
  }
  function gate_ry(qs, t, theta) {
    var c = Math.cos(theta / 2);
    var s = Math.sin(theta / 2);
    apply_1q(qs, t, C(c), C(-s), C(s), C(c));
  }
  function gate_rz(qs, t, theta) {
    var c = Math.cos(theta / 2);
    var s = Math.sin(theta / 2);
    apply_1q(qs, t, C(c, -s), C(0), C(0), C(c, s));
  }
  function gate_p(qs, t, phi) {
    apply_1q(qs, t, C(1), C(0), C(0), C(Math.cos(phi), Math.sin(phi)));
  }

  function gate_cnot(qs, control, target) {
    if (control === target) return;
    var cbit = 1 << control;
    var tbit = 1 << target;
    for (var i = 0; i < qs.dim; i++) {
      if (i & cbit && !(i & tbit)) {
        var j = i | tbit;
        var tmp = qs.amps[i];
        qs.amps[i] = qs.amps[j];
        qs.amps[j] = tmp;
      }
    }
  }

  function gate_cz(qs, control, target) {
    if (control === target) return;
    var mask = (1 << control) | (1 << target);
    for (var i = 0; i < qs.dim; i++) {
      if ((i & mask) === mask) qs.amps[i] = c_scale(qs.amps[i], -1);
    }
  }

  function gate_swap(qs, a, b) {
    if (a === b) return;
    var abit = 1 << a;
    var bbit = 1 << b;
    for (var i = 0; i < qs.dim; i++) {
      var has_a = (i & abit) !== 0;
      var has_b = (i & bbit) !== 0;
      if (has_a && !has_b) {
        var j = (i & ~abit) | bbit;
        if (i < j) {
          var tmp = qs.amps[i];
          qs.amps[i] = qs.amps[j];
          qs.amps[j] = tmp;
        }
      }
    }
  }

  function gate_cp(qs, control, target, phi) {
    if (control === target) return;
    var mask = (1 << control) | (1 << target);
    var phase = C(Math.cos(phi), Math.sin(phi));
    for (var i = 0; i < qs.dim; i++) {
      if ((i & mask) === mask) qs.amps[i] = c_mul(qs.amps[i], phase);
    }
  }

  function gate_toffoli(qs, c1, c2, target) {
    var b1 = 1 << c1;
    var b2 = 1 << c2;
    var bt = 1 << target;
    for (var i = 0; i < qs.dim; i++) {
      if (i & b1 && i & b2 && !(i & bt)) {
        var j = i | bt;
        var tmp = qs.amps[i];
        qs.amps[i] = qs.amps[j];
        qs.amps[j] = tmp;
      }
    }
  }

  function gate_cswap(qs, control, a, b) {
    var cb = 1 << control;
    var ab = 1 << a;
    var bb = 1 << b;
    for (var i = 0; i < qs.dim; i++) {
      if (!(i & cb)) continue;
      var has_a = (i & ab) !== 0;
      var has_b = (i & bb) !== 0;
      if (has_a && !has_b) {
        var j = (i & ~ab) | bb;
        if (i < j) {
          var tmp = qs.amps[i];
          qs.amps[i] = qs.amps[j];
          qs.amps[j] = tmp;
        }
      }
    }
  }

  function prob_qubit_one(qs, target) {
    var bit = 1 << target;
    var p = 0;
    for (var i = 0; i < qs.dim; i++) if (i & bit) p += c_abs2(qs.amps[i]);
    return p;
  }

  function measure_qubit(qs, target) {
    var p1 = prob_qubit_one(qs, target);
    var outcome = qs_rand01() < p1 ? 1 : 0;
    var bit = 1 << target;
    var norm = 0;
    for (var i = 0; i < qs.dim; i++) {
      var set = (i & bit) !== 0 ? 1 : 0;
      if (set !== outcome) qs.amps[i] = C(0, 0);
      else norm += c_abs2(qs.amps[i]);
    }
    if (norm > EPS) {
      var inv = 1 / Math.sqrt(norm);
      for (var j = 0; j < qs.dim; j++) qs.amps[j] = c_scale(qs.amps[j], inv);
    }
    return outcome;
  }

  function measure_all(qs) {
    var r = qs_rand01();
    var cum = 0;
    var chosen = qs.dim - 1;
    for (var i = 0; i < qs.dim; i++) {
      cum += c_abs2(qs.amps[i]);
      if (r < cum) {
        chosen = i;
        break;
      }
    }
    for (var j = 0; j < qs.dim; j++) qs.amps[j] = C(0, 0);
    qs.amps[chosen] = C(1, 0);
    return chosen;
  }

  function qs_hadamard_all(qs) {
    for (var q = 0; q < qs.n_qubits; q++) gate_h(qs, q);
  }

  function qs_fidelity(a, b) {
    if (!a || !b || a.dim !== b.dim) return 0;
    var ov = C(0, 0);
    for (var i = 0; i < a.dim; i++)
      ov = c_add(ov, c_mul(c_conj(a.amps[i]), b.amps[i]));
    return c_abs2(ov);
  }

  function qs_zz_correlation(qs, q0, q1) {
    var b0 = 1 << q0;
    var b1 = 1 << q1;
    var corr = 0;
    for (var i = 0; i < qs.dim; i++) {
      var z0 = i & b0 ? -1 : 1;
      var z1 = i & b1 ? -1 : 1;
      corr += c_abs2(qs.amps[i]) * z0 * z1;
    }
    return corr;
  }

  function qs_renormalize(qs) {
    var n2 = qs_norm2(qs);
    if (n2 < EPS) {
      qs_reset(qs);
      return;
    }
    var inv = 1 / Math.sqrt(n2);
    for (var i = 0; i < qs.dim; i++) qs.amps[i] = c_scale(qs.amps[i], inv);
  }

  function noise_bit_flip(qs, target, p) {
    if (p <= 0) return;
    if (p >= 1 || qs_rand01() < p) gate_x(qs, target);
  }
  function noise_phase_flip(qs, target, p) {
    if (p <= 0) return;
    if (p >= 1 || qs_rand01() < p) gate_z(qs, target);
  }
  function noise_depolarizing(qs, target, p) {
    if (p <= 0) return;
    if (qs_rand01() >= p && p < 1) return;
    var r = qs_rand01();
    if (r < 1 / 3) gate_x(qs, target);
    else if (r < 2 / 3) gate_y(qs, target);
    else gate_z(qs, target);
  }
  function noise_amplitude_damping(qs, target, gamma) {
    if (gamma <= 0) return;
    if (gamma > 1) gamma = 1;
    var p1 = prob_qubit_one(qs, target);
    var p_jump = gamma * p1;
    var bit = 1 << target;
    if (qs_rand01() < p_jump && p1 > EPS) {
      var tmp = new Array(qs.dim);
      for (var i = 0; i < qs.dim; i++) tmp[i] = C(0, 0);
      for (var j = 0; j < qs.dim; j++) {
        if (j & bit) {
          var k = j & ~bit;
          tmp[k] = c_add(tmp[k], qs.amps[j]);
        }
      }
      qs.amps = tmp;
      qs_renormalize(qs);
    } else {
      var s = Math.sqrt(1 - gamma);
      for (var m = 0; m < qs.dim; m++) {
        if (m & bit) qs.amps[m] = c_scale(qs.amps[m], s);
      }
      qs_renormalize(qs);
    }
  }
  function noise_depolarizing_all(qs, p) {
    for (var q = 0; q < qs.n_qubits; q++) noise_depolarizing(qs, q, p);
  }

  function probs(qs) {
    var p = [];
    for (var i = 0; i < qs.dim; i++) p.push(c_abs2(qs.amps[i]));
    return p;
  }

  /* ---------- Intérprete de circuitos (DSL del playground) ---------- */
  /*
   * Líneas (case-insensitive, # comentario):
   *   qubits N | reset
   *   H q | X q | Y q | Z q | S q | SDG q | T q | TDG q
   *   RX q theta | RY q theta | RZ q theta | P q phi
   *   CNOT c t | CX c t | CZ c t | SWAP a b | CP c t phi
   *   TOFFOLI c1 c2 t | CCX c1 c2 t | CSWAP c a b
   *   MEASURE [q] | MEASURE_ALL
   *   NOISE_BF q p | NOISE_PF q p | NOISE_DEP q p | NOISE_AD q g | NOISE_DEP_ALL p
   *   H_ALL | PRINT | PROBS | SEED n
   * Ángulos: grados si se escribe 90deg / 90° ; si no, radianes (o pi, pi/2).
   */
  function parseAngle(tok) {
    if (!tok) return 0;
    tok = String(tok).trim().toLowerCase();
    var deg = false;
    if (tok.indexOf("deg") >= 0 || tok.indexOf("°") >= 0) {
      deg = true;
      tok = tok.replace("deg", "").replace("°", "");
    }
    tok = tok.replace(/π/g, "pi");
    var v;
    if (tok === "pi") v = M_PI;
    else if (tok === "pi/2" || tok === "pi/2.0") v = M_PI / 2;
    else if (tok === "pi/4") v = M_PI / 4;
    else if (tok === "pi/3") v = M_PI / 3;
    else if (tok === "pi/6") v = M_PI / 6;
    else if (tok === "2*pi" || tok === "2pi") v = 2 * M_PI;
    else v = parseFloat(tok);
    if (isNaN(v)) throw new Error("Ángulo inválido: " + tok);
    return deg ? (v * M_PI) / 180 : v;
  }

  function runCircuit(source, options) {
    options = options || {};
    var log = [];
    var measures = [];
    var qs = null;
    var nDefault = options.qubits || 2;
    var lines = String(source).split(/\r?\n/);

    function ensure() {
      if (!qs) qs = qs_create(nDefault);
      return qs;
    }

    function needQ(q) {
      q = q | 0;
      var st = ensure();
      if (q < 0 || q >= st.n_qubits)
        throw new Error("Qubit fuera de rango: " + q);
      return q;
    }

    for (var li = 0; li < lines.length; li++) {
      var raw = lines[li];
      var line = raw.replace(/#.*$/, "").trim();
      if (!line) continue;
      var parts = line.split(/[\s,]+/).filter(Boolean);
      var op = parts[0].toUpperCase();
      var a1 = parts[1];
      var a2 = parts[2];
      var a3 = parts[3];
      var a4 = parts[4];

      try {
        switch (op) {
          case "QUBITS":
          case "QS_CREATE":
            qs = qs_create(parseInt(a1, 10));
            log.push("→ qs_create(" + qs.n_qubits + ")");
            break;
          case "RESET":
          case "QS_RESET":
            qs_reset(ensure());
            log.push("→ qs_reset()");
            break;
          case "SEED":
          case "QS_SEED":
            qs_seed(parseInt(a1, 10) || 1);
            log.push("→ qs_seed(" + (parseInt(a1, 10) || 1) + ")");
            break;
          case "H":
          case "GATE_H":
            gate_h(ensure(), needQ(a1));
            log.push("→ gate_h(q" + needQ(a1) + ")");
            break;
          case "X":
          case "GATE_X":
            gate_x(ensure(), needQ(a1));
            log.push("→ gate_x(q" + needQ(a1) + ")");
            break;
          case "Y":
          case "GATE_Y":
            gate_y(ensure(), needQ(a1));
            log.push("→ gate_y(q" + needQ(a1) + ")");
            break;
          case "Z":
          case "GATE_Z":
            gate_z(ensure(), needQ(a1));
            log.push("→ gate_z(q" + needQ(a1) + ")");
            break;
          case "S":
          case "GATE_S":
            gate_s(ensure(), needQ(a1));
            break;
          case "SDG":
          case "S_DAG":
          case "GATE_SDG":
            gate_sdg(ensure(), needQ(a1));
            break;
          case "T":
          case "GATE_T":
            gate_t(ensure(), needQ(a1));
            break;
          case "TDG":
          case "T_DAG":
          case "GATE_TDG":
            gate_tdg(ensure(), needQ(a1));
            break;
          case "RX":
          case "GATE_RX":
            gate_rx(ensure(), needQ(a1), parseAngle(a2));
            log.push("→ gate_rx(q" + needQ(a1) + ", " + a2 + ")");
            break;
          case "RY":
          case "GATE_RY":
            gate_ry(ensure(), needQ(a1), parseAngle(a2));
            log.push("→ gate_ry(q" + needQ(a1) + ", " + a2 + ")");
            break;
          case "RZ":
          case "GATE_RZ":
            gate_rz(ensure(), needQ(a1), parseAngle(a2));
            log.push("→ gate_rz(q" + needQ(a1) + ", " + a2 + ")");
            break;
          case "P":
          case "PHASE":
          case "GATE_P":
            gate_p(ensure(), needQ(a1), parseAngle(a2));
            break;
          case "CNOT":
          case "CX":
          case "GATE_CNOT":
            gate_cnot(ensure(), needQ(a1), needQ(a2));
            log.push("→ gate_cnot(" + needQ(a1) + "→" + needQ(a2) + ")");
            break;
          case "CZ":
          case "GATE_CZ":
            gate_cz(ensure(), needQ(a1), needQ(a2));
            log.push("→ gate_cz(" + needQ(a1) + "," + needQ(a2) + ")");
            break;
          case "SWAP":
          case "GATE_SWAP":
            gate_swap(ensure(), needQ(a1), needQ(a2));
            break;
          case "CP":
          case "GATE_CP":
            gate_cp(ensure(), needQ(a1), needQ(a2), parseAngle(a3));
            break;
          case "TOFFOLI":
          case "CCX":
          case "GATE_TOFFOLI":
            gate_toffoli(ensure(), needQ(a1), needQ(a2), needQ(a3));
            log.push("→ gate_toffoli(" + a1 + "," + a2 + "," + a3 + ")");
            break;
          case "CSWAP":
          case "FREDKIN":
          case "GATE_CSWAP":
            gate_cswap(ensure(), needQ(a1), needQ(a2), needQ(a3));
            break;
          case "H_ALL":
          case "QS_HADAMARD_ALL":
            qs_hadamard_all(ensure());
            log.push("→ qs_hadamard_all()");
            break;
          case "MEASURE":
          case "MEASURE_QUBIT":
            if (a1 === undefined || a1 === "") {
              var mall = measure_all(ensure());
              measures.push({ all: true, value: mall });
              log.push("→ measure_all() = " + mall + " " + ketStr(mall, qs.n_qubits));
            } else {
              var mq = measure_qubit(ensure(), needQ(a1));
              measures.push({ qubit: needQ(a1), value: mq });
              log.push("→ measure_qubit(" + needQ(a1) + ") = " + mq);
            }
            break;
          case "MEASURE_ALL":
            var m2 = measure_all(ensure());
            measures.push({ all: true, value: m2 });
            log.push("→ measure_all() = " + m2 + " " + ketStr(m2, qs.n_qubits));
            break;
          case "NOISE_BF":
          case "NOISE_BIT_FLIP":
            noise_bit_flip(ensure(), needQ(a1), parseFloat(a2));
            break;
          case "NOISE_PF":
          case "NOISE_PHASE_FLIP":
            noise_phase_flip(ensure(), needQ(a1), parseFloat(a2));
            break;
          case "NOISE_DEP":
          case "NOISE_DEPOLARIZING":
            noise_depolarizing(ensure(), needQ(a1), parseFloat(a2));
            break;
          case "NOISE_AD":
          case "NOISE_AMPLITUDE_DAMPING":
            noise_amplitude_damping(ensure(), needQ(a1), parseFloat(a2));
            break;
          case "NOISE_DEP_ALL":
          case "NOISE_DEPOLARIZING_ALL":
            noise_depolarizing_all(ensure(), parseFloat(a1));
            break;
          case "PRINT":
          case "QS_PRINT":
            log = log.concat(qs_print_lines(ensure()));
            break;
          case "PROBS":
          case "QS_PRINT_PROBS":
            log = log.concat(qs_print_probs_lines(ensure()));
            break;
          default:
            throw new Error("Operación desconocida: " + op);
        }
      } catch (e) {
        throw new Error("Línea " + (li + 1) + ": " + e.message + "\n  » " + raw);
      }
    }

    if (!qs) qs = qs_create(nDefault);
    return {
      state: qs,
      log: log,
      measures: measures,
      probs: probs(qs),
      norm2: qs_norm2(qs),
    };
  }

  global.QuantumSim = {
    QC_MAX_QUBITS: QC_MAX_QUBITS,
    qs_create: qs_create,
    qs_free: qs_free,
    qs_reset: qs_reset,
    qs_clone: qs_clone,
    qs_norm2: qs_norm2,
    qs_print_lines: qs_print_lines,
    qs_print_probs_lines: qs_print_probs_lines,
    gate_h: gate_h,
    gate_x: gate_x,
    gate_y: gate_y,
    gate_z: gate_z,
    gate_s: gate_s,
    gate_sdg: gate_sdg,
    gate_t: gate_t,
    gate_tdg: gate_tdg,
    gate_rx: gate_rx,
    gate_ry: gate_ry,
    gate_rz: gate_rz,
    gate_p: gate_p,
    gate_cnot: gate_cnot,
    gate_cz: gate_cz,
    gate_swap: gate_swap,
    gate_cp: gate_cp,
    gate_toffoli: gate_toffoli,
    gate_cswap: gate_cswap,
    measure_qubit: measure_qubit,
    measure_all: measure_all,
    prob_qubit_one: prob_qubit_one,
    qs_hadamard_all: qs_hadamard_all,
    qs_seed: qs_seed,
    qs_fidelity: qs_fidelity,
    qs_zz_correlation: qs_zz_correlation,
    noise_bit_flip: noise_bit_flip,
    noise_phase_flip: noise_phase_flip,
    noise_depolarizing: noise_depolarizing,
    noise_amplitude_damping: noise_amplitude_damping,
    noise_depolarizing_all: noise_depolarizing_all,
    probs: probs,
    ketStr: ketStr,
    runCircuit: runCircuit,
    // compat labs antiguos
    QuantumState: function (n) {
      return qs_create(n);
    },
  };

  /* Alias estilo QSim legacy para demos (usa this._qs siempre) */
  function wrapQs(qs) {
    return {
      n: qs.n_qubits,
      dim: qs.dim,
      amps: qs.amps,
      _qs: qs,
      sync: function () {
        this.n = this._qs.n_qubits;
        this.dim = this._qs.dim;
        this.amps = this._qs.amps;
      },
      reset: function () {
        qs_reset(this._qs);
        this.sync();
      },
      clone: function () {
        return wrapQs(qs_clone(this._qs));
      },
      h: function (t) {
        gate_h(this._qs, t);
      },
      x: function (t) {
        gate_x(this._qs, t);
      },
      y: function (t) {
        gate_y(this._qs, t);
      },
      z: function (t) {
        gate_z(this._qs, t);
      },
      ry: function (t, th) {
        gate_ry(this._qs, t, th);
      },
      cnot: function (c, t) {
        gate_cnot(this._qs, c, t);
      },
      cz: function (c, t) {
        gate_cz(this._qs, c, t);
      },
      probs: function () {
        return probs(this._qs);
      },
      probOne: function (t) {
        return prob_qubit_one(this._qs, t);
      },
      measure: function (t) {
        var r = measure_qubit(this._qs, t);
        this.sync();
        return r;
      },
      measureAll: function () {
        var r = measure_all(this._qs);
        this.sync();
        return r;
      },
      depolarize: function (t, p) {
        noise_depolarizing(this._qs, t, p);
      },
      zz: function (a, b) {
        return qs_zz_correlation(this._qs, a, b);
      },
      fidelity: function (other) {
        var o = other._qs || other;
        return qs_fidelity(this._qs, o);
      },
    };
  }

  global.QSim = {
    QuantumState: function (n) {
      return wrapQs(qs_create(n));
    },
    ketLabel: ketStr,
  };
})(typeof window !== "undefined" ? window : globalThis);
