/*
 * Demo del simulador de estabilizadores (Clifford)
 *
 * Muestra la superioridad de escala vs statevector:
 *   - GHZ de 64 qubits (imposible en statevector denso)
 *   - Código de 3 qubits bit-flip + corrección
 *   - Benchmark de puertas a n grande
 *
 *   gcc -O2 -o stab_demo.exe stabilizer.c stab_demo.c -lm
 *   ./stab_demo.exe
 */
#include "stabilizer.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

static void sep(const char *t) {
    printf("\n══════════════════════════════════════════════════════════\n");
    printf(" %s\n",
           t);
    printf("══════════════════════════════════════════════════════════\n");
}

/* GHZ: (|00...0⟩ + |11...1⟩)/√2 vía H + cadena de CNOTs */
static void demo_ghz(int n) {
    char title[80];
    snprintf(title, sizeof(title), "1. Estado GHZ de %d qubits", n);
    sep(title);

    clock_t t0 = clock();
    StabState *st = stab_create(n);
    if (!st) {
        printf("  No se pudo crear el estado.\n");
        return;
    }

    stab_h(st, 0);
    for (int i = 0; i < n - 1; i++)
        stab_cnot(st, i, i + 1);

    clock_t t1 = clock();
    double ms = 1000.0 * (t1 - t0) / CLOCKS_PER_SEC;

    printf("  Circuito: H(0) + CNOT(i,i+1) para i=0..%d\n", n - 2);
    printf("  Tiempo de construcción: %.2f ms\n", ms);
    printf("  Memoria tableau: ~%.1f KB  (statevector necesitaría 2^%d amplitudes)\n",
           (2.0 * n * (2.0 * n + 1)) / 1024.0, n);

    if (n <= 8) {
        printf("  Generadores:\n");
        stab_print(st);
    } else {
        printf("  (n grande: no imprimimos los %d estabilizadores)\n", n);
        printf("  Primeros estabilizadores esperados: +XX... / +ZZI... / +IZZ...\n");
    }

    /* Medir q0 y comprobar que el resto está correlacionado */
    int b0 = stab_measure(st, 0);
    int same = 1;
    for (int i = 1; i < n && i < 16; i++) {
        int bi = stab_measure(st, i);
        if (bi != b0) same = 0;
    }
    printf("  Tras medir q0=%d, qubits 1..min(15,n-1) iguales: %s\n",
           b0, same ? "SI (correlacion GHZ)" : "NO");

    stab_free(st);

    if (n >= 20) {
        /* 2^n * 16 bytes; usar log para evitar overflow en shift */
        double bytes = ldexp(16.0, n); /* 16 * 2^n */
        double gb = bytes / (1024.0 * 1024.0 * 1024.0);
        if (n < 40)
            printf("  → Un statevector de %d qubits necesitaría ~%.1f GB\n", n, gb);
        else if (n < 50)
            printf("  → Un statevector de %d qubits necesitaría ~%.0e GB\n", n, gb);
        else
            printf("  → Un statevector de %d qubits: ~2^%d amplitudes (imposible)\n",
                   n, n);
        printf("    El tableau usa O(n²) bits (~%.1f KB aqui).\n",
               (2.0 * n * (2.0 * n + 1)) / 1024.0);
    }
}

/* Código de repetición de 3 qubits contra bit-flip */
static void demo_bitflip_code(void) {
    sep("2. Codigo de 3 qubits (bit-flip) + correccion");

    /*
     * Encode |ψ⟩ en q0 → |ψψψ⟩ con CNOT 0→1, 0→2
     * (aquí |ψ⟩=|1⟩ o superposición H)
     * Ruido: X en un qubit de datos
     * Síndrome: estabilizadores Z0Z1, Z1Z2 (medidos con ancillas)
     * Corrección según síndrome
     */
    printf("  Encode |+⟩ en 3 qubits, bit-flip en q1, medir sindrome, corregir.\n\n");

    int trials = 200;
    int ok = 0;

    for (int t = 0; t < trials; t++) {
        StabState *st = stab_create(5); /* q0,q1,q2 datos; q3,q4 ancilla */

        /* |+⟩ en q0 */
        stab_h(st, 0);
        /* encode */
        stab_cnot(st, 0, 1);
        stab_cnot(st, 0, 2);

        /* error: X en q1 */
        stab_x(st, 1);

        /* síndrome: ancilla q3 mide Z0Z1, q4 mide Z1Z2
         * CNOT datos→ancilla en base X... estándar:
         * H on ancilla; CNOT data->anc; H; measure
         * Para Z_i Z_j: CNOT i→a, CNOT j→a, measure a
         */
        stab_cnot(st, 0, 3);
        stab_cnot(st, 1, 3);
        int s0 = stab_measure(st, 3);

        stab_cnot(st, 1, 4);
        stab_cnot(st, 2, 4);
        int s1 = stab_measure(st, 4);

        /* Corrección: 01 → X q0, 11 → X q1, 10 → X q2  (s0s1) */
        if (s0 == 1 && s1 == 0) stab_x(st, 0);
        if (s0 == 1 && s1 == 1) stab_x(st, 1);
        if (s0 == 0 && s1 == 1) stab_x(st, 2);

        /* Decode: CNOT 0→1, 0→2 (inverso encode para bits de paridad) */
        stab_cnot(st, 0, 1);
        stab_cnot(st, 0, 2);

        /* Estado lógico en q0 debería ser |+⟩: medir en X → H then Z */
        stab_h(st, 0);
        int m = stab_measure(st, 0);
        /* |+⟩ → H → |0⟩ */
        if (m == 0) ok++;

        stab_free(st);
    }

    printf("  Tras bit-flip en q1 + correccion: %d/%d trials recuperan |+> (%.1f%%)\n",
           ok, trials, 100.0 * ok / trials);
    printf("  (Esperado ~100%%: el codigo de 3 qubits corrige 1 bit-flip.)\n");
}

/* Benchmark: n qubits, profundidad d de H+CNOT aleatorios */
static void demo_benchmark(void) {
    sep("3. Benchmark: circuitos Clifford aleatorios");

    int sizes[] = {8, 16, 32, 64, 128, 256};
    int n_sizes = (int)(sizeof(sizes) / sizeof(sizes[0]));
    const int depth = 50;

    printf("  %6s  %12s  %14s\n", "n", "tiempo (ms)", "vs statevector");
    printf("  %6s  %12s  %14s\n", "------", "-----------", "--------------");

    for (int si = 0; si < n_sizes; si++) {
        int n = sizes[si];
        StabState *st = stab_create(n);
        if (!st) continue;

        clock_t t0 = clock();
        for (int d = 0; d < depth; d++) {
            for (int q = 0; q < n; q++) {
                if ((d + q) % 3 == 0) stab_h(st, q);
                if ((d + q) % 5 == 0) stab_s(st, q);
            }
            for (int q = 0; q < n - 1; q++)
                stab_cnot(st, q, q + 1);
        }
        /* medir la mitad de los qubits */
        for (int q = 0; q < n; q += 2)
            (void)stab_measure(st, q);
        clock_t t1 = clock();
        double ms = 1000.0 * (t1 - t0) / CLOCKS_PER_SEC;

        const char *note = (n <= 12) ? "statevector OK" :
                           (n <= 30) ? "SV imposible en PC" :
                                       "SV absurdo";
        printf("  %6d  %12.2f  %14s\n", n, ms, note);
        stab_free(st);
    }

    printf("\n  depth=%d capas de H/S + CNOT en cadena + medidas.\n", depth);
    printf("  El statevector denso de este proyecto (QC_MAX_QUBITS=12) no llega aqui.\n");
}

/* Validacion cruzada pequena vs intuicion Bell */
static void demo_bell(void) {
    sep("4. Bell Phi+ (validacion rapida)");

    StabState *st = stab_create(2);
    stab_h(st, 0);
    stab_cnot(st, 0, 1);
    printf("  Generadores del Bell state:\n");
    stab_print(st);

    int eq = 0;
    const int N = 200;
    for (int i = 0; i < N; i++) {
        StabState *t = stab_create(2);
        stab_h(t, 0);
        stab_cnot(t, 0, 1);
        int a = stab_measure(t, 0);
        int b = stab_measure(t, 1);
        if (a == b) eq++;
        stab_free(t);
    }
    printf("  Mediciones correlacionadas: %d/%d (esperado ~%d)\n", eq, N, N);
    stab_free(st);
}

int main(void) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║  Simulador de estabilizadores (Clifford)                 ║\n");
    printf("║  Escala O(n^2) — superior al statevector en n grande     ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");

    stab_seed(99);

    demo_bell();
    demo_bitflip_code();
    demo_ghz(8);
    demo_ghz(64);
    demo_benchmark();

    printf("\n══════════════════════════════════════════════════════════\n");
    printf(" Cuando usar cada motor\n");
    printf("══════════════════════════════════════════════════════════\n");
    printf(" · statevector (quantum_sim): H, T, Rx, VQC, QFT, ruido AD…\n");
    printf("   Cualquier puerta; limite ~12 qubits.\n");
    printf(" · estabilizadores (stabilizer): solo Clifford (H,S,CNOT,Pauli)\n");
    printf("   cientos de qubits; codigos de error, GHZ, sampling Clifford.\n");
    printf(" · Ambos son 'superiores' en su nicho; no se sustituyen.\n");
    printf("\n");

    return 0;
}
