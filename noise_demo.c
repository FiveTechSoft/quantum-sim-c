/*
 * Demo NISQ: cómo el ruido degrada un estado de Bell
 *
 * Muestra el nicho donde este simulador es "superior" a un motor ideal:
 * modelar errores realistas (bit-flip, depolarizing, amplitude damping)
 * y ver el impacto en correlaciones y fidelidad.
 *
 *   gcc -O2 -o noise_demo.exe quantum_sim.c noise_demo.c -lm
 *   ./noise_demo.exe
 */
#include "quantum_sim.h"

#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#define N_TRAJ  400   /* trayectorias estocásticas por nivel de ruido */
#define N_SHOTS 1     /* una medición ZZ por trayectoria (estado ya colapsable) */

static void make_bell(QuantumState *qs) {
    qs_reset(qs);
    gate_h(qs, 0);
    gate_cnot(qs, 0, 1);
}

/* Correlación perfecta de Bell Φ+: P(iguales) = 1 → ⟨ZZ⟩ = +1 */
static void experiment_depolarizing(void) {
    printf("\n══════════════════════════════════════════════════════════\n");
    printf(" 1. Estado de Bell + ruido depolarizing en ambos qubits\n");
    printf("══════════════════════════════════════════════════════════\n");
    printf("  Ideal: ⟨Z₀Z₁⟩ = +1  (mediciones siempre iguales)\n");
    printf("  Con ruido: la correlación cae hacia 0.\n\n");

    printf("  %8s  %12s  %12s  %s\n", "p_err", "<ZZ> medio", "F vs Bell*", "barra |<ZZ>|");
    printf("  %8s  %12s  %12s  %s\n", "------", "----------", "----------", "------------");

    double p_list[] = {0.0, 0.02, 0.05, 0.10, 0.20, 0.35, 0.50};
    int n_p = (int)(sizeof(p_list) / sizeof(p_list[0]));

    QuantumState *ideal = qs_create(2);
    make_bell(ideal);

    for (int ip = 0; ip < n_p; ip++) {
        double p = p_list[ip];
        double sum_zz = 0.0;
        double sum_fid = 0.0;

        for (int t = 0; t < N_TRAJ; t++) {
            QuantumState *qs = qs_create(2);
            make_bell(qs);
            /* Ruido tras el circuito (modelo de error de puerta/canal) */
            noise_depolarizing(qs, 0, p);
            noise_depolarizing(qs, 1, p);

            sum_zz += qs_zz_correlation(qs, 0, 1);
            sum_fid += qs_fidelity(ideal, qs);
            qs_free(qs);
        }

        double zz = sum_zz / N_TRAJ;
        double fid = sum_fid / N_TRAJ;
        printf("  %8.2f  %12.4f  %12.4f  ", p, zz, fid);
        int bars = (int)(fabs(zz) * 40.0 + 0.5);
        for (int k = 0; k < bars; k++) putchar('#');
        printf("\n");
    }

    printf("\n  * Fidelidad media trayectoria-a-ideal (estados puros ruidosos).\n");
    qs_free(ideal);
}

static void experiment_compare_channels(void) {
    printf("\n══════════════════════════════════════════════════════════\n");
    printf(" 2. Mismo p=0.15: bit-flip vs phase-flip vs depolarizing vs T1\n");
    printf("══════════════════════════════════════════════════════════\n");

    const double p = 0.15;
    QuantumState *ideal = qs_create(2);
    make_bell(ideal);

    typedef struct {
        const char *name;
        void (*apply)(QuantumState *, int, double);
        double strength;
    } Chan;

    Chan chans[] = {
        { "sin ruido",           NULL,                    0.0 },
        { "bit-flip",            noise_bit_flip,          p },
        { "phase-flip",          noise_phase_flip,        p },
        { "depolarizing",        noise_depolarizing,      p },
        { "amplitude damp (T1)", noise_amplitude_damping, p },
    };
    int n_c = (int)(sizeof(chans) / sizeof(chans[0]));

    printf("  %22s  %10s  %10s  %14s\n",
           "canal", "<ZZ>", "F(Bell)", "P(mismos bits)");
    printf("  %22s  %10s  %10s  %14s\n",
           "----------------------", "--------", "--------", "--------------");

    for (int c = 0; c < n_c; c++) {
        double sum_zz = 0.0, sum_fid = 0.0, same = 0.0;

        for (int t = 0; t < N_TRAJ; t++) {
            QuantumState *qs = qs_create(2);
            make_bell(qs);
            if (chans[c].apply) {
                chans[c].apply(qs, 0, chans[c].strength);
                chans[c].apply(qs, 1, chans[c].strength);
            }
            sum_zz += qs_zz_correlation(qs, 0, 1);
            sum_fid += qs_fidelity(ideal, qs);

            /* P(iguales) a partir de amplitudes (sin colapsar de más) */
            double p00 = c_abs2(qs->amps[0]);
            double p11 = c_abs2(qs->amps[3]);
            same += p00 + p11;
            qs_free(qs);
        }

        printf("  %22s  %10.4f  %10.4f  %14.4f\n",
               chans[c].name,
               sum_zz / N_TRAJ,
               sum_fid / N_TRAJ,
               same / N_TRAJ);
    }
    qs_free(ideal);
}

static void experiment_grover_noise(void) {
    printf("\n══════════════════════════════════════════════════════════\n");
    printf(" 3. Grover 2q (marca |11⟩) degradado por ruido tras cada capa\n");
    printf("══════════════════════════════════════════════════════════\n");
    printf("  Ideal: P(|11⟩)=1 tras 1 iteración.\n\n");

    double p_list[] = {0.0, 0.01, 0.03, 0.05, 0.10, 0.20};
    int n_p = (int)(sizeof(p_list) / sizeof(p_list[0]));

    printf("  %8s  %14s\n", "p_err", "P(|11⟩) medio");
    printf("  %8s  %14s\n", "------", "--------------");

    for (int ip = 0; ip < n_p; ip++) {
        double p = p_list[ip];
        double sum_p11 = 0.0;

        for (int t = 0; t < N_TRAJ; t++) {
            QuantumState *qs = qs_create(2);
            qs_hadamard_all(qs);
            noise_depolarizing_all(qs, p);

            /* oráculo CZ */
            gate_cz(qs, 0, 1);
            noise_depolarizing_all(qs, p);

            /* difusor */
            gate_h(qs, 0); gate_h(qs, 1);
            noise_depolarizing_all(qs, p);
            gate_x(qs, 0); gate_x(qs, 1);
            gate_cz(qs, 0, 1);
            noise_depolarizing_all(qs, p);
            gate_x(qs, 0); gate_x(qs, 1);
            gate_h(qs, 0); gate_h(qs, 1);
            noise_depolarizing_all(qs, p);

            sum_p11 += c_abs2(qs->amps[3]); /* |11⟩ = índice 3 */
            qs_free(qs);
        }

        double p11 = sum_p11 / N_TRAJ;
        printf("  %8.2f  %14.4f  ", p, p11);
        int bars = (int)(p11 * 40.0 + 0.5);
        for (int k = 0; k < bars; k++) putchar('#');
        printf("\n");
    }
}

int main(void) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║  Ruido NISQ en el simulador cuántico                     ║\n");
    printf("║  Donde este motor aporta: modelar errores realistas      ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\nTrayectorias por punto: %d (promedio de canales estocásticos)\n",
           N_TRAJ);

    qs_seed(7);

    experiment_depolarizing();
    experiment_compare_channels();
    experiment_grover_noise();

    printf("\n══════════════════════════════════════════════════════════\n");
    printf(" Por qué esto es un punto fuerte del simulador\n");
    printf("══════════════════════════════════════════════════════════\n");
    printf(" · Un motor 'ideal' solo muestra algoritmos perfectos.\n");
    printf(" · Con ruido ves el régimen NISQ: correlaciones y algoritmos\n");
    printf("   se degradan con p — intuición crítica en hardware real.\n");
    printf(" · Útil para: enseñar decoherencia, comparar mitigación de\n");
    printf("   errores, y decidir profundidad máxima de un circuito.\n");
    printf(" · Limitación: trayectorias ≈ canal; no es density-matrix\n");
    printf("   exacta (mejor para n pequeño con ρ de 4^n elementos).\n");
    printf("\n");

    return 0;
}
