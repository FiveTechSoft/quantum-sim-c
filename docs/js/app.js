/**
 * Interactive didactic UI for quantum-sim-c
 */
(function () {
  "use strict";
  var QS = window.QSim;

  function $(id) {
    return document.getElementById(id);
  }

  function renderAmps(container, qs) {
    var probs = qs.probs();
    var html = "";
    for (var i = 0; i < qs.dim; i++) {
      var p = probs[i];
      if (p < 1e-10 && qs.dim > 4) continue;
      var pct = (p * 100).toFixed(1);
      var phaseNeg = qs.amps[i].re < -1e-9 || qs.amps[i].im < -1e-9;
      html +=
        '<div class="amp-row">' +
        '<span class="ket">' +
        QS.ketLabel(i, qs.n) +
        "</span>" +
        '<div class="amp-bar-bg"><div class="amp-bar' +
        (phaseNeg ? " phase-neg" : "") +
        '" style="width:' +
        pct +
        '%"></div></div>' +
        "<span>" +
        pct +
        "%</span></div>";
    }
    container.innerHTML = html || "<p class='muted small'>Sin amplitudes visibles</p>";
  }

  function renderHist(container, counts, nQubits) {
    var total = 0;
    var keys = Object.keys(counts);
    for (var k = 0; k < keys.length; k++) total += counts[keys[k]];
    if (total === 0) total = 1;
    var dim = 1 << nQubits;
    var html = "";
    for (var i = 0; i < dim; i++) {
      var c = counts[i] || 0;
      var pct = (100 * c) / total;
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
        QS.ketLabel(i, nQubits) +
        "</div></div>";
    }
    container.innerHTML = html;
  }

  /* ---------- 1. Superposición ---------- */
  var q1 = new QS.QuantumState(1);
  var hist1 = { 0: 0, 1: 0 };
  var shots1 = 0;

  function refresh1() {
    renderAmps($("amps-1q"), q1);
    $("stat-1q").textContent =
      "P(|0⟩)=" +
      (q1.probs()[0] * 100).toFixed(1) +
      "% · P(|1⟩)=" +
      (q1.probs()[1] * 100).toFixed(1) +
      "% · tiros=" +
      shots1;
    renderHist($("hist-1q"), hist1, 1);
    drawBloch($("bloch"), q1);
  }

  function drawBloch(canvas, qs) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2;
    var cy = h / 2;
    var r = Math.min(w, h) * 0.38;

    // sphere outline
    ctx.strokeStyle = "#2a3a5c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // equator
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.28, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#1e3a5f";
    ctx.stroke();

    // poles labels
    ctx.fillStyle = "#8b9bb8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("|0⟩", cx, cy - r - 8);
    ctx.fillText("|1⟩", cx, cy + r + 16);

    // state vector: |ψ⟩ = α|0⟩+β|1⟩ → Bloch approx for pure state on YZ (Ry)
    var a = qs.amps[0];
    var b = qs.amps[1];
    // θ from |α|, φ from relative phase
    var alpha = Math.sqrt(a.abs2());
    var theta = 2 * Math.acos(Math.min(1, Math.max(0, alpha)));
    var phi = 0;
    if (b.abs2() > 1e-12 && a.abs2() > 1e-12) {
      phi = Math.atan2(b.im, b.re) - Math.atan2(a.im, a.re);
    } else if (b.abs2() > 1e-12) {
      phi = Math.atan2(b.im, b.re);
    }
    var x = r * Math.sin(theta) * Math.cos(phi);
    var y = r * Math.sin(theta) * Math.sin(phi);
    var z = r * Math.cos(theta);
    // project 3D to 2D (x horizontal, z vertical, y depth)
    var px = cx + x;
    var py = cy - z + y * 0.25;

    ctx.strokeStyle = "#3ee0ff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  $("btn-reset-1q").onclick = function () {
    q1.reset();
    hist1 = { 0: 0, 1: 0 };
    shots1 = 0;
    refresh1();
  };
  $("btn-h-1q").onclick = function () {
    q1.h(0);
    refresh1();
  };
  $("btn-x-1q").onclick = function () {
    q1.x(0);
    refresh1();
  };
  $("btn-measure-1q").onclick = function () {
    var copy = q1.clone();
    var m = copy.measure(0);
    hist1[m] = (hist1[m] || 0) + 1;
    shots1++;
    $("hist-1q").classList.remove("flash");
    void $("hist-1q").offsetWidth;
    $("hist-1q").classList.add("flash");
    // collapse displayed state to measured
    q1 = copy;
    refresh1();
  };
  $("btn-shots-1q").onclick = function () {
    var base = q1.clone();
    // if already collapsed, rebuild H|0> for demo convenience
    for (var i = 0; i < 50; i++) {
      var c = base.clone();
      // if state is computational after measure, user should re-apply H
      var m = c.measureAll();
      hist1[m] = (hist1[m] || 0) + 1;
      shots1++;
    }
    refresh1();
  };

  /* ---------- 2. Bell ---------- */
  var qBell = new QS.QuantumState(2);
  var histBell = { 0: 0, 1: 0, 2: 0, 3: 0 };
  var shotsBell = 0;

  function makeBell(qs) {
    qs.reset();
    qs.h(0);
    qs.cnot(0, 1);
  }

  function refreshBell() {
    renderAmps($("amps-bell"), qBell);
    $("stat-bell").textContent =
      "⟨Z₀Z₁⟩ = " +
      qBell.zz(0, 1).toFixed(3) +
      " · tiros = " +
      shotsBell +
      " · P(iguales) ≈ " +
      (
        ((histBell[0] || 0) + (histBell[3] || 0)) /
          Math.max(1, shotsBell) *
          100
      ).toFixed(0) +
      "%";
    renderHist($("hist-bell"), histBell, 2);
  }

  $("btn-bell-build").onclick = function () {
    makeBell(qBell);
    histBell = { 0: 0, 1: 0, 2: 0, 3: 0 };
    shotsBell = 0;
    refreshBell();
  };
  $("btn-bell-measure").onclick = function () {
    var c = qBell.clone();
    var m = c.measureAll();
    histBell[m] = (histBell[m] || 0) + 1;
    shotsBell++;
    qBell = c;
    refreshBell();
  };
  $("btn-bell-shots").onclick = function () {
    for (var i = 0; i < 40; i++) {
      var c = new QS.QuantumState(2);
      makeBell(c);
      var m = c.measureAll();
      histBell[m] = (histBell[m] || 0) + 1;
      shotsBell++;
    }
    // restore pure Bell for amp display
    makeBell(qBell);
    refreshBell();
  };

  /* ---------- 3. Noise ---------- */
  var noiseP = 0.1;

  function runNoiseSim() {
    var p = parseFloat($("noise-slider").value);
    noiseP = p;
    $("noise-p-label").textContent = p.toFixed(2);
    var nTraj = 200;
    var sumZZ = 0;
    var sumFid = 0;
    var ideal = new QS.QuantumState(2);
    makeBell(ideal);
    var same = 0;
    for (var t = 0; t < nTraj; t++) {
      var qs = new QS.QuantumState(2);
      makeBell(qs);
      qs.depolarize(0, p);
      qs.depolarize(1, p);
      sumZZ += qs.zz(0, 1);
      sumFid += qs.fidelity(ideal);
      var pr = qs.probs();
      same += pr[0] + pr[3];
    }
    var zz = sumZZ / nTraj;
    var fid = sumFid / nTraj;
    var pSame = same / nTraj;
    $("noise-zz").style.width = Math.max(0, Math.min(100, Math.abs(zz) * 100)) + "%";
    $("noise-fid").style.width = Math.max(0, Math.min(100, fid * 100)) + "%";
    $("noise-stats").innerHTML =
      "<span class='stat-line'><b>⟨ZZ⟩</b> = " +
      zz.toFixed(3) +
      " (ideal 1.0)</span>" +
      "<span class='stat-line'><b>Fidelidad</b> ≈ " +
      fid.toFixed(3) +
      "</span>" +
      "<span class='stat-line'><b>P(bits iguales)</b> ≈ " +
      (pSame * 100).toFixed(1) +
      "%</span>";
  }

  $("noise-slider").oninput = runNoiseSim;

  /* ---------- 4. Grover ---------- */
  function runGrover(withNoise) {
    var p = withNoise ? parseFloat($("grover-noise").value) : 0;
    $("grover-noise-label").textContent = p.toFixed(2);
    var nTraj = withNoise ? 150 : 1;
    var sum = [0, 0, 0, 0];
    for (var t = 0; t < nTraj; t++) {
      var qs = new QS.QuantumState(2);
      qs.h(0);
      qs.h(1);
      if (p) {
        qs.depolarize(0, p);
        qs.depolarize(1, p);
      }
      qs.cz(0, 1); // mark |11>
      if (p) {
        qs.depolarize(0, p);
        qs.depolarize(1, p);
      }
      // diffuser
      qs.h(0);
      qs.h(1);
      qs.x(0);
      qs.x(1);
      qs.cz(0, 1);
      qs.x(0);
      qs.x(1);
      qs.h(0);
      qs.h(1);
      if (p) {
        qs.depolarize(0, p);
        qs.depolarize(1, p);
      }
      var pr = qs.probs();
      for (var i = 0; i < 4; i++) sum[i] += pr[i];
    }
    var counts = {};
    for (var j = 0; j < 4; j++) counts[j] = sum[j] / nTraj;
    // fake hist scale as percentages
    var histCounts = {};
    for (var k = 0; k < 4; k++) histCounts[k] = Math.round(counts[k] * 1000);
    renderHist($("hist-grover"), histCounts, 2);
    $("grover-stats").textContent =
      "P(|11⟩) ≈ " + (counts[3] * 100).toFixed(1) + "%  (objetivo de búsqueda)";
  }

  $("btn-grover-ideal").onclick = function () {
    runGrover(false);
  };
  $("grover-noise").oninput = function () {
    runGrover(true);
  };
  $("btn-grover-noise").onclick = function () {
    runGrover(true);
  };

  /* ---------- 5. VQC vs MLP static story ---------- */
  // already in HTML tables

  /* Init */
  if ($("bloch")) {
    $("bloch").width = 180;
    $("bloch").height = 180;
  }
  refresh1();
  makeBell(qBell);
  refreshBell();
  runNoiseSim();
  runGrover(false);
})();
