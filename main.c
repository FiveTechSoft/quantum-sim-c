/*
 * Demos del simulador de ordenador cuántico
 *
 * Compilar (GCC/MinGW):
 *   gcc -O2 -o quantum_sim.exe quantum_sim.c main.c -lm
 *
 * Compilar (MSVC):
 *   cl /O2 /Fe:quantum_sim.exe quantum_sim.c main.c
 *
 * Ejecutar:
 *   ./quantum_sim.exe
 */
#include "quantum_sim.h"

#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static void sep(const char *title) {
    printf("\n========================================\n");
    printf(" %s\n", title);
    printf("========================================\n");
}

/* 1) Superposición de un qubit: H|0⟩ = (|0⟩+|1⟩)/√2 */
static void demo_superposicion(void) {
    sep("1. Superposición (puerta Hadamard)");
    QuantumState *qs = qs_create(1);
    printf("Estado inicial |0⟩:\n");
    qs_print(qs);

    gate_h(qs, 0);
    printf("\nTras H|0⟩:\n");
    qs_print(qs);
    qs_print_probs(qs);

    printf("\nMediciones (20 tiros):\n  ");
    for (int i = 0; i < 20; i++) {
        QuantumState *tmp = qs_clone(qs);
        printf("%d ", measure_qubit(tmp, 0));
        qs_free(tmp);
    }
    printf("\n");
    qs_free(qs);
}

/* 2) Par de Bell Φ+ = (|00⟩+|11⟩)/√2 */
static void demo_bell(void) {
    sep("2. Entrelazamiento — estado de Bell Φ+");
    QuantumState *qs = qs_create(2);
    /* Circuito: H(0); CNOT(0→1) */
    gate_h(qs, 0);
    gate_cnot(qs, 0, 1);

    printf("Circuito: H(q0) → CNOT(q0,q1)\n");
    qs_print(qs);
    qs_print_probs(qs);

    printf("\nCorrelación (medir q0 luego q1, 16 tiros):\n");
    for (int t = 0; t < 16; t++) {
        QuantumState *tmp = qs_clone(qs);
        int b0 = measure_qubit(tmp, 0);
        int b1 = measure_qubit(tmp, 1);
        printf("  tiro %2d: q0=%d q1=%d %s\n",
               t + 1, b0, b1, b0 == b1 ? "(iguales)" : "(¡raro!)");
        qs_free(tmp);
    }
    qs_free(qs);
}

/* 3) Algoritmo de Deutsch: f constante o balanceada en 1 bit */
static void demo_deutsch(void) {
    sep("3. Algoritmo de Deutsch");
    /*
     * Oráculo U_f: |x⟩|y⟩ → |x⟩|y⊕f(x)⟩
     * f0(x)=0  constante  → I
     * f1(x)=1  constante  → X en y
     * f2(x)=x  balanceada → CNOT
     * f3(x)=¬x balanceada → X(x); CNOT; X(x)
     */
    const char *nombres[] = {
        "f(x)=0 (constante)",
        "f(x)=1 (constante)",
        "f(x)=x (balanceada)",
        "f(x)=¬x (balanceada)"
    };

    for (int tipo = 0; tipo < 4; tipo++) {
        QuantumState *qs = qs_create(2);
        /* Preparación: |0⟩|1⟩ luego H⊗H */
        gate_x(qs, 1);
        gate_h(qs, 0);
        gate_h(qs, 1);

        /* Oráculo */
        switch (tipo) {
        case 0: break;
        case 1: gate_x(qs, 1); break;
        case 2: gate_cnot(qs, 0, 1); break;
        case 3:
            gate_x(qs, 0);
            gate_cnot(qs, 0, 1);
            gate_x(qs, 0);
            break;
        }

        gate_h(qs, 0);
        int result = measure_qubit(qs, 0);
        printf("  %s → mide q0=%d → %s\n",
               nombres[tipo], result,
               result == 0 ? "CONSTANTE" : "BALANCEADA");
        qs_free(qs);
    }
}

/* 4) Grover de 2 qubits: buscar |11⟩ entre 4 elementos */
static void demo_grover(void) {
    sep("4. Algoritmo de Grover (2 qubits, marca |11⟩)");
    QuantumState *qs = qs_create(2);

    /* Superposición uniforme */
    qs_hadamard_all(qs);
    printf("Tras H⊗H (superposición):\n");
    qs_print_probs(qs);

    /* Una iteración de Grover (óptima para N=4) */
    /* Oráculo: marca |11⟩ con fase -1  ≡  CZ (tras X si se marca otro) */
    /* Para marcar |11⟩: Z controlado = CZ */
    gate_cz(qs, 0, 1);

    /* Difusor: H⊗H · X⊗X · CZ · X⊗X · H⊗H  (reflexión sobre |s⟩) */
    gate_h(qs, 0);
    gate_h(qs, 1);
    gate_x(qs, 0);
    gate_x(qs, 1);
    gate_cz(qs, 0, 1);
    gate_x(qs, 0);
    gate_x(qs, 1);
    gate_h(qs, 0);
    gate_h(qs, 1);

    printf("\nTras 1 iteración de Grover (objetivo |11⟩):\n");
    qs_print(qs);
    qs_print_probs(qs);

    printf("\nHistograma de 100 mediciones:\n");
    int counts[4] = {0};
    for (int i = 0; i < 100; i++) {
        QuantumState *tmp = qs_clone(qs);
        int m = measure_all(tmp);
        counts[m & 3]++;
        qs_free(tmp);
    }
    for (int i = 0; i < 4; i++) {
        printf("  |%d%d⟩: %3d  ", (i >> 1) & 1, i & 1, counts[i]);
        for (int k = 0; k < counts[i] / 2; k++) putchar('#');
        printf("\n");
    }
    qs_free(qs);
}

/* 5) Teleportación cuántica (simplificada: estado + Bell + corrección) */
static void demo_teleportacion(void) {
    sep("5. Teleportación cuántica");
    /*
     * q0 = qubit a teleportar (Alice)
     * q1 = mitad de Bell de Alice
     * q2 = mitad de Bell de Bob
     *
     * Preparación de |ψ⟩ en q0: Ry(θ)|0⟩
     */
    double theta = M_PI / 3.0; /* |ψ⟩ con P(1)=sin²(θ/2) */
    QuantumState *qs = qs_create(3);

    gate_ry(qs, 0, theta);
    printf("Estado a teleportar en q0 (Ry(π/3)|0⟩):\n");
    /* Probabilidad teórica de |1⟩ en q0 */
    double p1_teorica = sin(theta / 2.0) * sin(theta / 2.0);
    printf("  P(q0=1) teórica = %.4f\n", p1_teorica);

    /* Par de Bell entre q1 y q2 */
    gate_h(qs, 1);
    gate_cnot(qs, 1, 2);

    /* Protocolo de Alice */
    gate_cnot(qs, 0, 1);
    gate_h(qs, 0);
    int m0 = measure_qubit(qs, 0);
    int m1 = measure_qubit(qs, 1);

    /* Correcciones de Bob */
    if (m1) gate_x(qs, 2);
    if (m0) gate_z(qs, 2);

    printf("  Mediciones Alice: m0=%d m1=%d\n", m0, m1);
    printf("  Estado de Bob (q2) tras corrección:\n");
    /* Mostrar solo amplitudes donde q0=m0, q1=m1 (ya colapsados) */
    qs_print(qs);

    double p1_bob = prob_qubit_one(qs, 2);
    printf("  P(q2=1) = %.4f  (debería ≈ %.4f)\n", p1_bob, p1_teorica);
    qs_free(qs);
}

/* 6) QFT de 3 qubits sobre |001⟩ (estado |1⟩) */
static void demo_qft(void) {
    sep("6. Transformada de Fourier cuántica (3 qubits)");
    QuantumState *qs = qs_create(3);
    gate_x(qs, 0); /* |001⟩ = |1⟩ en notación decimal LSB */
    printf("Entrada |001⟩:\n");
    qs_print_probs(qs);

    /* QFT estándar (qubits 0,1,2 con 0 = LSB) */
    /* H en q2, CP(π/2) q1→q2, CP(π/4) q0→q2 */
    gate_h(qs, 2);
    gate_cp(qs, 1, 2, M_PI / 2.0);
    gate_cp(qs, 0, 2, M_PI / 4.0);
    /* H en q1, CP(π/2) q0→q1 */
    gate_h(qs, 1);
    gate_cp(qs, 0, 1, M_PI / 2.0);
    /* H en q0 */
    gate_h(qs, 0);
    /* Swap para invertir orden de qubits */
    gate_swap(qs, 0, 2);

    printf("\nTras QFT₃:\n");
    qs_print(qs);
    qs_print_probs(qs);
    qs_free(qs);
}

int main(void) {
    printf("╔══════════════════════════════════════════╗\n");
    printf("║  Simulador de Ordenador Cuántico (C)     ║\n");
    printf("║  Simulación por vector de estado         ║\n");
    printf("╚══════════════════════════════════════════╝\n");

    qs_seed(42); /* resultados reproducibles en demos */

    demo_superposicion();
    demo_bell();
    demo_deutsch();
    demo_grover();
    demo_teleportacion();
    demo_qft();

    printf("\n--- Fin de las demos ---\n");
    return 0;
}
