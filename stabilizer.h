/*
 * Simulador de estabilizadores (Clifford / Gottesman–Knill)
 *
 * Representa el estado por un tableau 2n×(2n+1) de bits.
 * Solo puertas Clifford: H, S, X, Y, Z, CNOT, CZ, SWAP.
 * Escala ~O(n²) por puerta → decenas/cientos de qubits (no 2^n).
 *
 * Ideal para: códigos de corrección de errores, circuitos Clifford,
 * muestreo eficiente cuando no hace falta el statevector completo.
 */
#ifndef STABILIZER_H
#define STABILIZER_H

#include <stddef.h>
#include <stdbool.h>

typedef struct {
    int n;           /* número de qubits */
    int rows;        /* 2n (destabilizers + stabilizers) */
    int cols;        /* 2n + 1 (x | z | phase) */
    unsigned char *t; /* tableau row-major: t[r*cols + c] ∈ {0,1} */
} StabState;

/* Crea |0...0⟩. NULL si falla. */
StabState *stab_create(int n_qubits);

void stab_free(StabState *st);
void stab_reset(StabState *st); /* vuelve a |0...0⟩ */

/* ---------- Puertas Clifford ---------- */

void stab_h(StabState *st, int q);
void stab_s(StabState *st, int q);   /* S = √Z  (phase gate) */
void stab_sdg(StabState *st, int q); /* S† = S³ */
void stab_x(StabState *st, int q);
void stab_y(StabState *st, int q);
void stab_z(StabState *st, int q);
void stab_cnot(StabState *st, int control, int target);
void stab_cz(StabState *st, int a, int b);
void stab_swap(StabState *st, int a, int b);

/* ---------- Medición (base Z) ---------- */

/* Mide qubit q en Z; actualiza el estado. Devuelve 0 o 1. */
int stab_measure(StabState *st, int q);

/* True si el resultado de medir q está determinado por los estabilizadores. */
bool stab_is_deterministic(const StabState *st, int q);

/* ---------- Utilidades ---------- */

void stab_seed(unsigned int seed);

/* Imprime generadores estabilizadores (filas n..2n-1) en notación Pauli. */
void stab_print(const StabState *st);

/* Probabilidad exacta de |0...0⟩ si el estado es un estabilizador computacional;
 * en general no disponible sin 2^n — aquí solo reporta si es |0⟩^n o no de forma
 * barata cuando todos los estabilizadores son ±Z. Devuelve -1 si no aplica. */
double stab_prob_all_zero_if_computational(const StabState *st);

#endif /* STABILIZER_H */
