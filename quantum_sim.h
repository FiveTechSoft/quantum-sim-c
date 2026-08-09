/*
 * Simulador de ordenador cuántico — API pública
 * Simulación por vector de estado (statevector): 2^n amplitudes complejas.
 */
#ifndef QUANTUM_SIM_H
#define QUANTUM_SIM_H

#include <stddef.h>
#include <stdbool.h>

/* ---------- Números complejos ---------- */

typedef struct {
    double re;
    double im;
} Complex;

Complex c_new(double re, double im);
Complex c_add(Complex a, Complex b);
Complex c_sub(Complex a, Complex b);
Complex c_mul(Complex a, Complex b);
Complex c_scale(Complex a, double s);
Complex c_conj(Complex a);
double  c_abs2(Complex a);   /* |z|^2 */
double  c_abs(Complex a);    /* |z|   */

/* ---------- Registro cuántico ---------- */

#define QC_MAX_QUBITS 12  /* 2^12 = 4096 amplitudes; sube con precaución */

typedef struct {
    int      n_qubits;   /* número de qubits */
    size_t   dim;        /* 2^n_qubits       */
    Complex *amps;       /* amplitudes del estado |ψ⟩ */
} QuantumState;

/* Crea un registro de n qubits en |0...0⟩. Devuelve NULL si falla. */
QuantumState *qs_create(int n_qubits);

/* Libera el registro. */
void qs_free(QuantumState *qs);

/* Reinicia a |0...0⟩. */
void qs_reset(QuantumState *qs);

/* Copia profunda. */
QuantumState *qs_clone(const QuantumState *qs);

/* Imprime el estado (solo amplitudes no despreciables). */
void qs_print(const QuantumState *qs);

/* Imprime probabilidades de cada base computacional. */
void qs_print_probs(const QuantumState *qs);

/* Norma al cuadrado del estado (debe ser ~1). */
double qs_norm2(const QuantumState *qs);

/* ---------- Puertas de 1 qubit ---------- */
/* Convención de bit: qubit 0 = bit menos significativo (LSB). */

void gate_h(QuantumState *qs, int target);           /* Hadamard      */
void gate_x(QuantumState *qs, int target);           /* Pauli-X (NOT) */
void gate_y(QuantumState *qs, int target);           /* Pauli-Y       */
void gate_z(QuantumState *qs, int target);           /* Pauli-Z       */
void gate_s(QuantumState *qs, int target);           /* S = √Z        */
void gate_sdg(QuantumState *qs, int target);         /* S†            */
void gate_t(QuantumState *qs, int target);           /* T = π/8       */
void gate_tdg(QuantumState *qs, int target);         /* T†            */
void gate_rx(QuantumState *qs, int target, double theta);
void gate_ry(QuantumState *qs, int target, double theta);
void gate_rz(QuantumState *qs, int target, double theta);
void gate_p(QuantumState *qs, int target, double phi); /* Phase(φ)    */

/* ---------- Puertas de 2 qubits ---------- */

void gate_cnot(QuantumState *qs, int control, int target);
void gate_cz(QuantumState *qs, int control, int target);
void gate_swap(QuantumState *qs, int a, int b);
void gate_cp(QuantumState *qs, int control, int target, double phi); /* controlled-phase */

/* ---------- Puertas de 3 qubits ---------- */

void gate_toffoli(QuantumState *qs, int c1, int c2, int target); /* CCX */
void gate_cswap(QuantumState *qs, int control, int a, int b);    /* Fredkin */

/* ---------- Medición ---------- */

/* Mide un qubit; colapsa el estado. Devuelve 0 o 1. */
int measure_qubit(QuantumState *qs, int target);

/* Mide todos los qubits; colapsa a un estado base. Devuelve el entero
 * cuyo bit i es el resultado del qubit i. */
int measure_all(QuantumState *qs);

/* Probabilidad de medir 1 en el qubit target (sin colapsar). */
double prob_qubit_one(const QuantumState *qs, int target);

/* ---------- Utilidades de demo ---------- */

/* Aplica H a todos los qubits (superposición uniforme). */
void qs_hadamard_all(QuantumState *qs);

/* Semilla del generador aleatorio (para mediciones reproducibles). */
void qs_seed(unsigned int seed);

/* Fidelidad |⟨a|b⟩|² entre dos estados puros (misma dimensión). */
double qs_fidelity(const QuantumState *a, const QuantumState *b);

/* Correlación ⟨Z⊗Z⟩ en los dos primeros qubits (estados 2+ qubits). */
double qs_zz_correlation(const QuantumState *qs, int q0, int q1);

/* ---------- Ruido NISQ (trayectorias estocásticas) ----------
 * Aproxima canales de un qubit sobre estados puros: con probabilidad p
 * (o según el modelo) aplica un "error" unitario/no unitario y renormaliza.
 * Para estadísticas del canal hay que promediar muchas trayectorias.
 * Ideal para ver cómo el ruido degrada Bell, algoritmos, etc.
 */

/* Bit-flip: X con probabilidad p. */
void noise_bit_flip(QuantumState *qs, int target, double p);

/* Phase-flip: Z con probabilidad p. */
void noise_phase_flip(QuantumState *qs, int target, double p);

/* Depolarizing: con prob p aplica X, Y o Z (1/3 cada una). */
void noise_depolarizing(QuantumState *qs, int target, double p);

/* Amplitude damping (relajación T1): gamma en [0,1]. */
void noise_amplitude_damping(QuantumState *qs, int target, double gamma);

/* Aplica el mismo canal de ruido a todos los qubits. */
void noise_depolarizing_all(QuantumState *qs, double p);

#endif /* QUANTUM_SIM_H */
