/*
 * Simulador de ordenador cuántico — implementación
 */
#include "quantum_sim.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#define EPS 1e-12

/* ---------- Complejos ---------- */

Complex c_new(double re, double im) {
    Complex z = { re, im };
    return z;
}

Complex c_add(Complex a, Complex b) {
    return c_new(a.re + b.re, a.im + b.im);
}

Complex c_sub(Complex a, Complex b) {
    return c_new(a.re - b.re, a.im - b.im);
}

Complex c_mul(Complex a, Complex b) {
    return c_new(a.re * b.re - a.im * b.im,
                 a.re * b.im + a.im * b.re);
}

Complex c_scale(Complex a, double s) {
    return c_new(a.re * s, a.im * s);
}

Complex c_conj(Complex a) {
    return c_new(a.re, -a.im);
}

double c_abs2(Complex a) {
    return a.re * a.re + a.im * a.im;
}

double c_abs(Complex a) {
    return sqrt(c_abs2(a));
}

/* ---------- RNG simple (xorshift) ---------- */

static unsigned int g_rng = 1;

void qs_seed(unsigned int seed) {
    g_rng = seed ? seed : 1;
}

static double qs_rand01(void) {
    g_rng ^= g_rng << 13;
    g_rng ^= g_rng >> 17;
    g_rng ^= g_rng << 5;
    return (g_rng & 0xFFFFFFFFu) / 4294967296.0;
}

/* ---------- Estado ---------- */

static size_t pow2(int n) {
    return (size_t)1 << n;
}

QuantumState *qs_create(int n_qubits) {
    if (n_qubits < 1 || n_qubits > QC_MAX_QUBITS) {
        fprintf(stderr, "qs_create: n_qubits debe estar en 1..%d\n", QC_MAX_QUBITS);
        return NULL;
    }
    QuantumState *qs = (QuantumState *)calloc(1, sizeof(QuantumState));
    if (!qs) return NULL;
    qs->n_qubits = n_qubits;
    qs->dim = pow2(n_qubits);
    qs->amps = (Complex *)calloc(qs->dim, sizeof(Complex));
    if (!qs->amps) {
        free(qs);
        return NULL;
    }
    qs->amps[0] = c_new(1.0, 0.0); /* |0...0⟩ */
    static int seeded = 0;
    if (!seeded) {
        qs_seed((unsigned int)time(NULL));
        seeded = 1;
    }
    return qs;
}

void qs_free(QuantumState *qs) {
    if (!qs) return;
    free(qs->amps);
    free(qs);
}

void qs_reset(QuantumState *qs) {
    if (!qs) return;
    memset(qs->amps, 0, qs->dim * sizeof(Complex));
    qs->amps[0] = c_new(1.0, 0.0);
}

QuantumState *qs_clone(const QuantumState *qs) {
    if (!qs) return NULL;
    QuantumState *c = qs_create(qs->n_qubits);
    if (!c) return NULL;
    memcpy(c->amps, qs->amps, qs->dim * sizeof(Complex));
    return c;
}

double qs_norm2(const QuantumState *qs) {
    double s = 0.0;
    for (size_t i = 0; i < qs->dim; i++)
        s += c_abs2(qs->amps[i]);
    return s;
}

void qs_print(const QuantumState *qs) {
    printf("Estado (%d qubits, dim=%zu, ||ψ||²=%.6f):\n",
           qs->n_qubits, qs->dim, qs_norm2(qs));
    for (size_t i = 0; i < qs->dim; i++) {
        double p = c_abs2(qs->amps[i]);
        if (p < 1e-10) continue;
        printf("  |");
        for (int b = qs->n_qubits - 1; b >= 0; b--)
            putchar((i >> b) & 1 ? '1' : '0');
        printf("⟩  amp = %+.6f%+.6fi   P=%.4f\n",
               qs->amps[i].re, qs->amps[i].im, p);
    }
}

void qs_print_probs(const QuantumState *qs) {
    printf("Probabilidades:\n");
    for (size_t i = 0; i < qs->dim; i++) {
        double p = c_abs2(qs->amps[i]);
        if (p < 1e-10) continue;
        printf("  |");
        for (int b = qs->n_qubits - 1; b >= 0; b--)
            putchar((i >> b) & 1 ? '1' : '0');
        printf("⟩  %.4f  (", p);
        int bars = (int)(p * 40.0 + 0.5);
        for (int k = 0; k < bars; k++) putchar('#');
        printf(")\n");
    }
}

/* Aplica una matriz 2x2 unitaria al qubit target.
 * U = | u00  u01 |
 *     | u10  u11 |
 */
static void apply_1q(QuantumState *qs, int target,
                     Complex u00, Complex u01,
                     Complex u10, Complex u11) {
    size_t bit = (size_t)1 << target;
    size_t step = bit << 1;
    for (size_t base = 0; base < qs->dim; base += step) {
        for (size_t offset = 0; offset < bit; offset++) {
            size_t i0 = base + offset;
            size_t i1 = i0 + bit;
            Complex a0 = qs->amps[i0];
            Complex a1 = qs->amps[i1];
            qs->amps[i0] = c_add(c_mul(u00, a0), c_mul(u01, a1));
            qs->amps[i1] = c_add(c_mul(u10, a0), c_mul(u11, a1));
        }
    }
}

/* ---------- Puertas de 1 qubit ---------- */

void gate_h(QuantumState *qs, int target) {
    double s = 1.0 / sqrt(2.0);
    Complex u00 = c_new(s, 0), u01 = c_new(s, 0);
    Complex u10 = c_new(s, 0), u11 = c_new(-s, 0);
    apply_1q(qs, target, u00, u01, u10, u11);
}

void gate_x(QuantumState *qs, int target) {
    apply_1q(qs, target,
             c_new(0, 0), c_new(1, 0),
             c_new(1, 0), c_new(0, 0));
}

void gate_y(QuantumState *qs, int target) {
    apply_1q(qs, target,
             c_new(0, 0), c_new(0, -1),
             c_new(0, 1), c_new(0, 0));
}

void gate_z(QuantumState *qs, int target) {
    apply_1q(qs, target,
             c_new(1, 0), c_new(0, 0),
             c_new(0, 0), c_new(-1, 0));
}

void gate_s(QuantumState *qs, int target) {
    apply_1q(qs, target,
             c_new(1, 0), c_new(0, 0),
             c_new(0, 0), c_new(0, 1));
}

void gate_sdg(QuantumState *qs, int target) {
    apply_1q(qs, target,
             c_new(1, 0), c_new(0, 0),
             c_new(0, 0), c_new(0, -1));
}

void gate_t(QuantumState *qs, int target) {
    double a = 1.0 / sqrt(2.0);
    apply_1q(qs, target,
             c_new(1, 0), c_new(0, 0),
             c_new(0, 0), c_new(a, a)); /* e^{iπ/4} */
}

void gate_tdg(QuantumState *qs, int target) {
    double a = 1.0 / sqrt(2.0);
    apply_1q(qs, target,
             c_new(1, 0), c_new(0, 0),
             c_new(0, 0), c_new(a, -a));
}

void gate_rx(QuantumState *qs, int target, double theta) {
    double c = cos(theta / 2.0);
    double s = sin(theta / 2.0);
    apply_1q(qs, target,
             c_new(c, 0), c_new(0, -s),
             c_new(0, -s), c_new(c, 0));
}

void gate_ry(QuantumState *qs, int target, double theta) {
    double c = cos(theta / 2.0);
    double s = sin(theta / 2.0);
    apply_1q(qs, target,
             c_new(c, 0), c_new(-s, 0),
             c_new(s, 0), c_new(c, 0));
}

void gate_rz(QuantumState *qs, int target, double theta) {
    double c = cos(theta / 2.0);
    double s = sin(theta / 2.0);
    apply_1q(qs, target,
             c_new(c, -s), c_new(0, 0),
             c_new(0, 0), c_new(c, s));
}

void gate_p(QuantumState *qs, int target, double phi) {
    apply_1q(qs, target,
             c_new(1, 0), c_new(0, 0),
             c_new(0, 0), c_new(cos(phi), sin(phi)));
}

/* ---------- Puertas de 2 qubits ---------- */

void gate_cnot(QuantumState *qs, int control, int target) {
    if (control == target) return;
    size_t cbit = (size_t)1 << control;
    size_t tbit = (size_t)1 << target;
    /* Intercambiar amplitudes donde control=1 y target difiere */
    for (size_t i = 0; i < qs->dim; i++) {
        if ((i & cbit) && !(i & tbit)) {
            size_t j = i | tbit;
            Complex tmp = qs->amps[i];
            qs->amps[i] = qs->amps[j];
            qs->amps[j] = tmp;
        }
    }
}

void gate_cz(QuantumState *qs, int control, int target) {
    if (control == target) return;
    size_t mask = ((size_t)1 << control) | ((size_t)1 << target);
    for (size_t i = 0; i < qs->dim; i++) {
        if ((i & mask) == mask)
            qs->amps[i] = c_scale(qs->amps[i], -1.0);
    }
}

void gate_swap(QuantumState *qs, int a, int b) {
    if (a == b) return;
    size_t abit = (size_t)1 << a;
    size_t bbit = (size_t)1 << b;
    for (size_t i = 0; i < qs->dim; i++) {
        int has_a = (i & abit) != 0;
        int has_b = (i & bbit) != 0;
        if (has_a && !has_b) {
            size_t j = (i & ~abit) | bbit;
            if (i < j) {
                Complex tmp = qs->amps[i];
                qs->amps[i] = qs->amps[j];
                qs->amps[j] = tmp;
            }
        }
    }
}

void gate_cp(QuantumState *qs, int control, int target, double phi) {
    if (control == target) return;
    size_t mask = ((size_t)1 << control) | ((size_t)1 << target);
    Complex phase = c_new(cos(phi), sin(phi));
    for (size_t i = 0; i < qs->dim; i++) {
        if ((i & mask) == mask)
            qs->amps[i] = c_mul(qs->amps[i], phase);
    }
}

/* ---------- Puertas de 3 qubits ---------- */

void gate_toffoli(QuantumState *qs, int c1, int c2, int target) {
    size_t b1 = (size_t)1 << c1;
    size_t b2 = (size_t)1 << c2;
    size_t bt = (size_t)1 << target;
    for (size_t i = 0; i < qs->dim; i++) {
        if ((i & b1) && (i & b2) && !(i & bt)) {
            size_t j = i | bt;
            Complex tmp = qs->amps[i];
            qs->amps[i] = qs->amps[j];
            qs->amps[j] = tmp;
        }
    }
}

void gate_cswap(QuantumState *qs, int control, int a, int b) {
    size_t cb = (size_t)1 << control;
    size_t ab = (size_t)1 << a;
    size_t bb = (size_t)1 << b;
    for (size_t i = 0; i < qs->dim; i++) {
        if (!(i & cb)) continue;
        int has_a = (i & ab) != 0;
        int has_b = (i & bb) != 0;
        if (has_a && !has_b) {
            size_t j = (i & ~ab) | bb;
            if (i < j) {
                Complex tmp = qs->amps[i];
                qs->amps[i] = qs->amps[j];
                qs->amps[j] = tmp;
            }
        }
    }
}

/* ---------- Medición ---------- */

double prob_qubit_one(const QuantumState *qs, int target) {
    size_t bit = (size_t)1 << target;
    double p = 0.0;
    for (size_t i = 0; i < qs->dim; i++) {
        if (i & bit)
            p += c_abs2(qs->amps[i]);
    }
    return p;
}

int measure_qubit(QuantumState *qs, int target) {
    double p1 = prob_qubit_one(qs, target);
    int outcome = (qs_rand01() < p1) ? 1 : 0;
    size_t bit = (size_t)1 << target;
    double norm = 0.0;

    for (size_t i = 0; i < qs->dim; i++) {
        int bit_set = (i & bit) != 0;
        if (bit_set != outcome) {
            qs->amps[i] = c_new(0, 0);
        } else {
            norm += c_abs2(qs->amps[i]);
        }
    }
    if (norm > EPS) {
        double inv = 1.0 / sqrt(norm);
        for (size_t i = 0; i < qs->dim; i++)
            qs->amps[i] = c_scale(qs->amps[i], inv);
    }
    return outcome;
}

int measure_all(QuantumState *qs) {
    double r = qs_rand01();
    double cum = 0.0;
    size_t chosen = 0;
    for (size_t i = 0; i < qs->dim; i++) {
        cum += c_abs2(qs->amps[i]);
        if (r < cum) {
            chosen = i;
            break;
        }
        if (i == qs->dim - 1)
            chosen = i;
    }
    memset(qs->amps, 0, qs->dim * sizeof(Complex));
    qs->amps[chosen] = c_new(1.0, 0.0);
    return (int)chosen;
}

void qs_hadamard_all(QuantumState *qs) {
    for (int q = 0; q < qs->n_qubits; q++)
        gate_h(qs, q);
}

/* ---------- Fidelidad y correlaciones ---------- */

double qs_fidelity(const QuantumState *a, const QuantumState *b) {
    if (!a || !b || a->dim != b->dim) return 0.0;
    Complex ov = c_new(0, 0);
    for (size_t i = 0; i < a->dim; i++)
        ov = c_add(ov, c_mul(c_conj(a->amps[i]), b->amps[i]));
    return c_abs2(ov);
}

double qs_zz_correlation(const QuantumState *qs, int q0, int q1) {
    /* ⟨Z_q0 Z_q1⟩ = Σ_i |a_i|² * (+1 si bits iguales, -1 si distintos) */
    size_t b0 = (size_t)1 << q0;
    size_t b1 = (size_t)1 << q1;
    double corr = 0.0;
    for (size_t i = 0; i < qs->dim; i++) {
        int z0 = (i & b0) ? -1 : 1;
        int z1 = (i & b1) ? -1 : 1;
        corr += c_abs2(qs->amps[i]) * (double)(z0 * z1);
    }
    return corr;
}

/* Renormaliza tras una operación no unitaria */
static void qs_renormalize(QuantumState *qs) {
    double n2 = qs_norm2(qs);
    if (n2 < EPS) {
        qs_reset(qs);
        return;
    }
    double inv = 1.0 / sqrt(n2);
    for (size_t i = 0; i < qs->dim; i++)
        qs->amps[i] = c_scale(qs->amps[i], inv);
}

/* ---------- Ruido NISQ (trayectorias) ---------- */

void noise_bit_flip(QuantumState *qs, int target, double p) {
    if (p <= 0.0) return;
    if (p >= 1.0 || qs_rand01() < p)
        gate_x(qs, target);
}

void noise_phase_flip(QuantumState *qs, int target, double p) {
    if (p <= 0.0) return;
    if (p >= 1.0 || qs_rand01() < p)
        gate_z(qs, target);
}

void noise_depolarizing(QuantumState *qs, int target, double p) {
    if (p <= 0.0) return;
    if (qs_rand01() >= p && p < 1.0) return;
    double r = qs_rand01();
    if (r < 1.0 / 3.0)
        gate_x(qs, target);
    else if (r < 2.0 / 3.0)
        gate_y(qs, target);
    else
        gate_z(qs, target);
}

void noise_amplitude_damping(QuantumState *qs, int target, double gamma) {
    if (gamma <= 0.0) return;
    if (gamma > 1.0) gamma = 1.0;

    double p1 = prob_qubit_one(qs, target);
    /* Probabilidad de salto (emisión): gamma * ⟨n⟩ */
    double p_jump = gamma * p1;

    if (qs_rand01() < p_jump && p1 > EPS) {
        /* Operador de salto σ− : |1⟩ → |0⟩ en el target */
        size_t bit = (size_t)1 << target;
        Complex *tmp = (Complex *)calloc(qs->dim, sizeof(Complex));
        if (!tmp) return;
        for (size_t i = 0; i < qs->dim; i++) {
            if (i & bit) {
                size_t j = i & ~bit; /* flip 1 → 0 */
                tmp[j] = c_add(tmp[j], qs->amps[i]);
            }
        }
        memcpy(qs->amps, tmp, qs->dim * sizeof(Complex));
        free(tmp);
        qs_renormalize(qs);
    } else {
        /* Sin salto: aplicar diag(1, √(1-γ)) en el target y renormalizar */
        size_t bit = (size_t)1 << target;
        double s = sqrt(1.0 - gamma);
        for (size_t i = 0; i < qs->dim; i++) {
            if (i & bit)
                qs->amps[i] = c_scale(qs->amps[i], s);
        }
        qs_renormalize(qs);
    }
}

void noise_depolarizing_all(QuantumState *qs, double p) {
    for (int q = 0; q < qs->n_qubits; q++)
        noise_depolarizing(qs, q, p);
}
