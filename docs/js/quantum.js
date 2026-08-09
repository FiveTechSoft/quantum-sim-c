/**
 * Mini statevector simulator (JS) for didactic demos.
 * Qubit 0 = LSB. Up to a few qubits.
 */
(function (global) {
  "use strict";

  function Complex(re, im) {
    this.re = re;
    this.im = im || 0;
  }
  Complex.prototype.abs2 = function () {
    return this.re * this.re + this.im * this.im;
  };
  Complex.prototype.mul = function (o) {
    return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re);
  };
  Complex.prototype.add = function (o) {
    return new Complex(this.re + o.re, this.im + o.im);
  };
  Complex.prototype.scale = function (s) {
    return new Complex(this.re * s, this.im * s);
  };

  function QuantumState(n) {
    this.n = n;
    this.dim = 1 << n;
    this.amps = new Array(this.dim);
    this.reset();
  }

  QuantumState.prototype.reset = function () {
    for (var i = 0; i < this.dim; i++) this.amps[i] = new Complex(0, 0);
    this.amps[0] = new Complex(1, 0);
  };

  QuantumState.prototype.clone = function () {
    var q = new QuantumState(this.n);
    for (var i = 0; i < this.dim; i++)
      q.amps[i] = new Complex(this.amps[i].re, this.amps[i].im);
    return q;
  };

  QuantumState.prototype.apply1 = function (target, u00, u01, u10, u11) {
    var bit = 1 << target;
    var step = bit << 1;
    for (var base = 0; base < this.dim; base += step) {
      for (var off = 0; off < bit; off++) {
        var i0 = base + off;
        var i1 = i0 + bit;
        var a0 = this.amps[i0];
        var a1 = this.amps[i1];
        this.amps[i0] = u00.mul(a0).add(u01.mul(a1));
        this.amps[i1] = u10.mul(a0).add(u11.mul(a1));
      }
    }
  };

  QuantumState.prototype.h = function (t) {
    var s = 1 / Math.sqrt(2);
    this.apply1(
      t,
      new Complex(s), new Complex(s),
      new Complex(s), new Complex(-s)
    );
  };

  QuantumState.prototype.x = function (t) {
    this.apply1(t, new Complex(0), new Complex(1), new Complex(1), new Complex(0));
  };

  QuantumState.prototype.y = function (t) {
    this.apply1(t, new Complex(0), new Complex(0, -1), new Complex(0, 1), new Complex(0));
  };

  QuantumState.prototype.z = function (t) {
    this.apply1(t, new Complex(1), new Complex(0), new Complex(0), new Complex(-1));
  };

  QuantumState.prototype.ry = function (t, theta) {
    var c = Math.cos(theta / 2);
    var s = Math.sin(theta / 2);
    this.apply1(t, new Complex(c), new Complex(-s), new Complex(s), new Complex(c));
  };

  QuantumState.prototype.cnot = function (c, t) {
    if (c === t) return;
    var cb = 1 << c;
    var tb = 1 << t;
    for (var i = 0; i < this.dim; i++) {
      if (i & cb && !(i & tb)) {
        var j = i | tb;
        var tmp = this.amps[i];
        this.amps[i] = this.amps[j];
        this.amps[j] = tmp;
      }
    }
  };

  QuantumState.prototype.cz = function (c, t) {
    var mask = (1 << c) | (1 << t);
    for (var i = 0; i < this.dim; i++) {
      if ((i & mask) === mask) this.amps[i] = this.amps[i].scale(-1);
    }
  };

  QuantumState.prototype.probs = function () {
    var p = [];
    for (var i = 0; i < this.dim; i++) p.push(this.amps[i].abs2());
    return p;
  };

  QuantumState.prototype.probOne = function (t) {
    var bit = 1 << t;
    var p = 0;
    for (var i = 0; i < this.dim; i++) if (i & bit) p += this.amps[i].abs2();
    return p;
  };

  QuantumState.prototype.measure = function (t) {
    var p1 = this.probOne(t);
    var outcome = Math.random() < p1 ? 1 : 0;
    var bit = 1 << t;
    var norm = 0;
    for (var i = 0; i < this.dim; i++) {
      var set = (i & bit) !== 0;
      if ((set ? 1 : 0) !== outcome) this.amps[i] = new Complex(0, 0);
      else norm += this.amps[i].abs2();
    }
    if (norm > 1e-15) {
      var inv = 1 / Math.sqrt(norm);
      for (var j = 0; j < this.dim; j++) this.amps[j] = this.amps[j].scale(inv);
    }
    return outcome;
  };

  QuantumState.prototype.measureAll = function () {
    var r = Math.random();
    var cum = 0;
    var chosen = this.dim - 1;
    for (var i = 0; i < this.dim; i++) {
      cum += this.amps[i].abs2();
      if (r < cum) {
        chosen = i;
        break;
      }
    }
    for (var j = 0; j < this.dim; j++) this.amps[j] = new Complex(0, 0);
    this.amps[chosen] = new Complex(1, 0);
    return chosen;
  };

  QuantumState.prototype.depolarize = function (t, p) {
    if (Math.random() >= p) return;
    var r = Math.random();
    if (r < 1 / 3) this.x(t);
    else if (r < 2 / 3) this.y(t);
    else this.z(t);
  };

  QuantumState.prototype.zz = function (q0, q1) {
    var b0 = 1 << q0;
    var b1 = 1 << q1;
    var c = 0;
    for (var i = 0; i < this.dim; i++) {
      var z0 = i & b0 ? -1 : 1;
      var z1 = i & b1 ? -1 : 1;
      c += this.amps[i].abs2() * z0 * z1;
    }
    return c;
  };

  QuantumState.prototype.fidelity = function (other) {
    var ov = new Complex(0, 0);
    for (var i = 0; i < this.dim; i++) {
      var a = this.amps[i];
      var b = other.amps[i];
      ov = ov.add(new Complex(a.re, -a.im).mul(b));
    }
    return ov.abs2();
  };

  function ketLabel(i, n) {
    var s = "";
    for (var b = n - 1; b >= 0; b--) s += (i >> b) & 1 ? "1" : "0";
    return "|" + s + "⟩";
  }

  global.QSim = {
    Complex: Complex,
    QuantumState: QuantumState,
    ketLabel: ketLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
