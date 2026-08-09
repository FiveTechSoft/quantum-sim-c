/*
 * Comparación a tres bandas:
 *   1) Regresión logística (lineal)
 *   2) MLP clásico (1 capa oculta, 8 neuronas)
 *   3) VQC cuántico simulado (2 qubits)
 *
 * Mismo dataset 2D binario, misma métrica (BCE + accuracy).
 *
 * Compilar:
 *   gcc -O2 -o qml_compare.exe quantum_sim.c qml_compare.c -lm
 * Ejecutar:
 *   ./qml_compare.exe
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

/* ---------- Configuración ---------- */

#define N_SAMPLES   200
#define N_TRAIN     160
#define N_TEST      (N_SAMPLES - N_TRAIN)
#define N_FEATURES  2

#define N_HIDDEN    8
/* MLP: W1[H][F] + b1[H] + W2[H] + b2 */
#define MLP_PARAMS  (N_HIDDEN * N_FEATURES + N_HIDDEN + N_HIDDEN + 1)

#define N_QUBITS    2
#define N_LAYERS    2
#define N_PARAMS    (N_LAYERS * N_QUBITS)

#define LR_EPOCHS   400
#define MLP_EPOCHS  2500
#define VQC_EPOCHS  80
#define LR_RATE     0.5
#define MLP_RATE    0.8
#define VQC_RATE    0.15
#define FD_EPS      0.05

/* ---------- Dataset ---------- */

typedef struct {
    double x[N_FEATURES];
    int    y;
} Sample;

static unsigned int g_seed = 12345;

static double rnd(void) {
    g_seed = g_seed * 1103515245u + 12345u;
    return (g_seed / 65536u % 32768u) / 32768.0;
}

static double rndn(void) {
    double u1 = rnd() + 1e-12;
    double u2 = rnd();
    return sqrt(-2.0 * log(u1)) * cos(2.0 * M_PI * u2);
}

static void make_blobs(Sample *data, int n) {
    for (int i = 0; i < n; i++) {
        int y = (i < n / 2) ? 0 : 1;
        if (y == 0) {
            data[i].x[0] = -1.0 + 0.45 * rndn();
            data[i].x[1] = -0.8 + 0.45 * rndn();
        } else {
            data[i].x[0] =  1.0 + 0.45 * rndn();
            data[i].x[1] =  0.8 + 0.45 * rndn();
        }
        data[i].y = y;
    }
}

static void make_circles(Sample *data, int n) {
    for (int i = 0; i < n; i++) {
        int y = (i < n / 2) ? 0 : 1;
        double ang = 2.0 * M_PI * rnd();
        double r = (y == 0) ? (0.35 + 0.12 * rndn()) : (0.95 + 0.12 * rndn());
        if (r < 0.05) r = 0.05;
        data[i].x[0] = r * cos(ang);
        data[i].x[1] = r * sin(ang);
        data[i].y = y;
    }
}

static void make_xor(Sample *data, int n) {
    for (int i = 0; i < n; i++) {
        double a = (rnd() < 0.5) ? -1.0 : 1.0;
        double b = (rnd() < 0.5) ? -1.0 : 1.0;
        data[i].x[0] = a + 0.25 * rndn();
        data[i].x[1] = b + 0.25 * rndn();
        data[i].y = ((a * b) > 0) ? 1 : 0;
    }
}

static void shuffle(Sample *data, int n) {
    for (int i = n - 1; i > 0; i--) {
        int j = (int)(rnd() * (i + 1));
        if (j > i) j = i;
        Sample t = data[i];
        data[i] = data[j];
        data[j] = t;
    }
}

static void normalize_features(Sample *data, int n) {
    double minv[N_FEATURES], maxv[N_FEATURES];
    for (int f = 0; f < N_FEATURES; f++) {
        minv[f] = data[0].x[f];
        maxv[f] = data[0].x[f];
    }
    for (int i = 1; i < n; i++) {
        for (int f = 0; f < N_FEATURES; f++) {
            if (data[i].x[f] < minv[f]) minv[f] = data[i].x[f];
            if (data[i].x[f] > maxv[f]) maxv[f] = data[i].x[f];
        }
    }
    for (int i = 0; i < n; i++) {
        for (int f = 0; f < N_FEATURES; f++) {
            double den = maxv[f] - minv[f];
            if (den < 1e-12) den = 1.0;
            data[i].x[f] = (data[i].x[f] - minv[f]) / den;
        }
    }
}

/* ---------- Métricas ---------- */

static double accuracy(const int *pred, const Sample *data, int n) {
    int ok = 0;
    for (int i = 0; i < n; i++)
        if (pred[i] == data[i].y) ok++;
    return 100.0 * ok / n;
}

static double clip_p(double p) {
    return fmax(1e-12, fmin(1.0 - 1e-12, p));
}

static double bce(double p, int y) {
    p = clip_p(p);
    return -y * log(p) - (1 - y) * log(1.0 - p);
}

static double sigmoid(double z) {
    if (z > 30.0) return 1.0;
    if (z < -30.0) return 0.0;
    return 1.0 / (1.0 + exp(-z));
}

static double tanh_act(double z) {
    if (z > 20.0) return 1.0;
    if (z < -20.0) return -1.0;
    return tanh(z);
}

/* ---------- Regresión logística ---------- */

typedef struct {
    double w[N_FEATURES];
    double b;
} LogReg;

static double lr_predict_prob(const LogReg *m, const double *x) {
    double z = m->b;
    for (int f = 0; f < N_FEATURES; f++)
        z += m->w[f] * x[f];
    return sigmoid(z);
}

static int lr_predict(const LogReg *m, const double *x) {
    return lr_predict_prob(m, x) >= 0.5 ? 1 : 0;
}

static double lr_loss(const LogReg *m, const Sample *data, int n) {
    double loss = 0.0;
    for (int i = 0; i < n; i++)
        loss += bce(lr_predict_prob(m, data[i].x), data[i].y);
    return loss / n;
}

static void lr_train(LogReg *m, const Sample *data, int n, int epochs, double lr) {
    memset(m, 0, sizeof(*m));
    for (int ep = 0; ep < epochs; ep++) {
        double gw[N_FEATURES] = {0};
        double gb = 0.0;
        for (int i = 0; i < n; i++) {
            double p = lr_predict_prob(m, data[i].x);
            double err = p - data[i].y;
            for (int f = 0; f < N_FEATURES; f++)
                gw[f] += err * data[i].x[f];
            gb += err;
        }
        for (int f = 0; f < N_FEATURES; f++)
            m->w[f] -= lr * gw[f] / n;
        m->b -= lr * gb / n;
    }
}

/* ---------- MLP: 2 → 8 (tanh) → 1 (sigmoid) ---------- */

typedef struct {
    double W1[N_HIDDEN][N_FEATURES];
    double b1[N_HIDDEN];
    double W2[N_HIDDEN];
    double b2;
} MLP;

static double mlp_forward(const MLP *m, const double *x, double *h_out) {
    double h[N_HIDDEN];
    for (int j = 0; j < N_HIDDEN; j++) {
        double z = m->b1[j];
        for (int f = 0; f < N_FEATURES; f++)
            z += m->W1[j][f] * x[f];
        h[j] = tanh_act(z);
        if (h_out) h_out[j] = h[j];
    }
    double z2 = m->b2;
    for (int j = 0; j < N_HIDDEN; j++)
        z2 += m->W2[j] * h[j];
    return sigmoid(z2);
}

static double mlp_predict_prob(const MLP *m, const double *x) {
    return mlp_forward(m, x, NULL);
}

static int mlp_predict(const MLP *m, const double *x) {
    return mlp_predict_prob(m, x) >= 0.5 ? 1 : 0;
}

static double mlp_loss(const MLP *m, const Sample *data, int n) {
    double loss = 0.0;
    for (int i = 0; i < n; i++)
        loss += bce(mlp_predict_prob(m, data[i].x), data[i].y);
    return loss / n;
}

static void mlp_init(MLP *m) {
    /* Xavier-ish pequeño */
    double s1 = sqrt(2.0 / (N_FEATURES + N_HIDDEN));
    double s2 = sqrt(2.0 / (N_HIDDEN + 1));
    for (int j = 0; j < N_HIDDEN; j++) {
        for (int f = 0; f < N_FEATURES; f++)
            m->W1[j][f] = (rnd() * 2.0 - 1.0) * s1;
        m->b1[j] = 0.0;
        m->W2[j] = (rnd() * 2.0 - 1.0) * s2;
    }
    m->b2 = 0.0;
}

static void mlp_train(MLP *m, const Sample *data, int n, int epochs, double lr) {
    mlp_init(m);
    for (int ep = 0; ep < epochs; ep++) {
        double gW1[N_HIDDEN][N_FEATURES];
        double gb1[N_HIDDEN];
        double gW2[N_HIDDEN];
        double gb2 = 0.0;
        memset(gW1, 0, sizeof(gW1));
        memset(gb1, 0, sizeof(gb1));
        memset(gW2, 0, sizeof(gW2));

        for (int i = 0; i < n; i++) {
            double h[N_HIDDEN];
            double p = mlp_forward(m, data[i].x, h);
            /* dL/dz2 = p - y  (BCE + sigmoid) */
            double dz2 = p - data[i].y;

            gb2 += dz2;
            for (int j = 0; j < N_HIDDEN; j++) {
                gW2[j] += dz2 * h[j];
                /* dL/dh_j = dz2 * W2[j];  dh/dz1 = 1 - h^2 */
                double dh = dz2 * m->W2[j];
                double dz1 = dh * (1.0 - h[j] * h[j]);
                gb1[j] += dz1;
                for (int f = 0; f < N_FEATURES; f++)
                    gW1[j][f] += dz1 * data[i].x[f];
            }
        }

        double inv = 1.0 / n;
        for (int j = 0; j < N_HIDDEN; j++) {
            for (int f = 0; f < N_FEATURES; f++)
                m->W1[j][f] -= lr * gW1[j][f] * inv;
            m->b1[j] -= lr * gb1[j] * inv;
            m->W2[j] -= lr * gW2[j] * inv;
        }
        m->b2 -= lr * gb2 * inv;
    }
}

/* ---------- VQC: 2 qubits ---------- */

static void vqc_circuit(QuantumState *qs, const double *x, const double *theta) {
    qs_reset(qs);
    gate_ry(qs, 0, x[0] * M_PI);
    gate_ry(qs, 1, x[1] * M_PI);
    for (int L = 0; L < N_LAYERS; L++) {
        gate_ry(qs, 0, theta[L * N_QUBITS + 0]);
        gate_ry(qs, 1, theta[L * N_QUBITS + 1]);
        gate_cnot(qs, 0, 1);
    }
}

static double vqc_prob_class1(QuantumState *qs, const double *x, const double *theta) {
    vqc_circuit(qs, x, theta);
    return prob_qubit_one(qs, 0);
}

static int vqc_predict(QuantumState *qs, const double *x, const double *theta) {
    return vqc_prob_class1(qs, x, theta) >= 0.5 ? 1 : 0;
}

static double vqc_loss(QuantumState *qs, const double *theta,
                       const Sample *data, int n) {
    double loss = 0.0;
    for (int i = 0; i < n; i++)
        loss += bce(vqc_prob_class1(qs, data[i].x, theta), data[i].y);
    return loss / n;
}

static void vqc_train(QuantumState *qs, double *theta,
                      const Sample *data, int n,
                      int epochs, double lr) {
    for (int i = 0; i < N_PARAMS; i++)
        theta[i] = (rnd() - 0.5) * 0.5;

    double grad[N_PARAMS];
    for (int ep = 0; ep < epochs; ep++) {
        for (int p = 0; p < N_PARAMS; p++) {
            double save = theta[p];
            theta[p] = save + FD_EPS;
            double lp = vqc_loss(qs, theta, data, n);
            theta[p] = save - FD_EPS;
            double lm = vqc_loss(qs, theta, data, n);
            theta[p] = save;
            grad[p] = (lp - lm) / (2.0 * FD_EPS);
        }
        for (int p = 0; p < N_PARAMS; p++)
            theta[p] -= lr * grad[p];

        if ((ep + 1) % 20 == 0 || ep == 0)
            printf("    VQC epoch %3d  loss=%.4f\n",
                   ep + 1, vqc_loss(qs, theta, data, n));
    }
}

/* ---------- Experimento ---------- */

static const char *pick_winner(double a, double b, double c,
                               const char *na, const char *nb, const char *nc) {
    double best = a;
    if (b > best) best = b;
    if (c > best) best = c;

    int n = 0;
    if (fabs(a - best) <= 0.5) n++;
    if (fabs(b - best) <= 0.5) n++;
    if (fabs(c - best) <= 0.5) n++;
    if (n >= 2) return "empate";

    if (fabs(a - best) <= 0.5) return na;
    if (fabs(b - best) <= 0.5) return nb;
    return nc;
}

static void run_experiment(const char *name,
                           void (*make_data)(Sample *, int)) {
    printf("\n");
    printf("╔══════════════════════════════════════════════════════════════╗\n");
    printf("║  Dataset: %-50s ║\n", name);
    printf("╚══════════════════════════════════════════════════════════════╝\n");

    Sample all[N_SAMPLES];
    make_data(all, N_SAMPLES);
    shuffle(all, N_SAMPLES);
    normalize_features(all, N_SAMPLES);

    Sample *train = all;
    Sample *test  = all + N_TRAIN;

    /* ----- Logística ----- */
    clock_t t0 = clock();
    LogReg lr;
    lr_train(&lr, train, N_TRAIN, LR_EPOCHS, LR_RATE);
    clock_t t1 = clock();
    double lr_ms = 1000.0 * (t1 - t0) / CLOCKS_PER_SEC;

    int lr_tr[N_TRAIN], lr_te[N_TEST];
    for (int i = 0; i < N_TRAIN; i++) lr_tr[i] = lr_predict(&lr, train[i].x);
    for (int i = 0; i < N_TEST; i++)  lr_te[i] = lr_predict(&lr, test[i].x);
    double lr_acc_tr = accuracy(lr_tr, train, N_TRAIN);
    double lr_acc_te = accuracy(lr_te, test, N_TEST);
    double lr_L = lr_loss(&lr, train, N_TRAIN);

    /* ----- MLP ----- */
    t0 = clock();
    MLP mlp;
    mlp_train(&mlp, train, N_TRAIN, MLP_EPOCHS, MLP_RATE);
    t1 = clock();
    double mlp_ms = 1000.0 * (t1 - t0) / CLOCKS_PER_SEC;

    int mlp_tr[N_TRAIN], mlp_te[N_TEST];
    for (int i = 0; i < N_TRAIN; i++) mlp_tr[i] = mlp_predict(&mlp, train[i].x);
    for (int i = 0; i < N_TEST; i++)  mlp_te[i] = mlp_predict(&mlp, test[i].x);
    double mlp_acc_tr = accuracy(mlp_tr, train, N_TRAIN);
    double mlp_acc_te = accuracy(mlp_te, test, N_TEST);
    double mlp_L = mlp_loss(&mlp, train, N_TRAIN);

    /* ----- VQC ----- */
    printf("  Entrenando VQC (%d qubits, %d capas, %d params)...\n",
           N_QUBITS, N_LAYERS, N_PARAMS);
    QuantumState *qs = qs_create(N_QUBITS);
    double theta[N_PARAMS];

    t0 = clock();
    vqc_train(qs, theta, train, N_TRAIN, VQC_EPOCHS, VQC_RATE);
    t1 = clock();
    double vqc_ms = 1000.0 * (t1 - t0) / CLOCKS_PER_SEC;

    int vqc_tr[N_TRAIN], vqc_te[N_TEST];
    for (int i = 0; i < N_TRAIN; i++) vqc_tr[i] = vqc_predict(qs, train[i].x, theta);
    for (int i = 0; i < N_TEST; i++)  vqc_te[i] = vqc_predict(qs, test[i].x, theta);
    double vqc_acc_tr = accuracy(vqc_tr, train, N_TRAIN);
    double vqc_acc_te = accuracy(vqc_te, test, N_TEST);
    double vqc_L = vqc_loss(qs, theta, train, N_TRAIN);

    printf("\n");
    printf("  ┌──────────────────┬────────────┬────────────┬──────────────┐\n");
    printf("  │ Métrica          │ Logística  │ MLP (8h)   │ VQC (2q)     │\n");
    printf("  ├──────────────────┼────────────┼────────────┼──────────────┤\n");
    printf("  │ Parámetros       │ %10d │ %10d │ %12d │\n",
           N_FEATURES + 1, MLP_PARAMS, N_PARAMS);
    printf("  │ Train (ms)       │ %10.1f │ %10.1f │ %12.1f │\n",
           lr_ms, mlp_ms, vqc_ms);
    printf("  │ Loss train       │ %10.4f │ %10.4f │ %12.4f │\n",
           lr_L, mlp_L, vqc_L);
    printf("  │ Acc train %%      │ %10.1f │ %10.1f │ %12.1f │\n",
           lr_acc_tr, mlp_acc_tr, vqc_acc_tr);
    printf("  │ Acc test  %%      │ %10.1f │ %10.1f │ %12.1f │\n",
           lr_acc_te, mlp_acc_te, vqc_acc_te);
    printf("  └──────────────────┴────────────┴────────────┴──────────────┘\n");

    const char *w = pick_winner(lr_acc_te, mlp_acc_te, vqc_acc_te,
                                "Logística", "MLP", "VQC");
    printf("  → Mejor accuracy test: %s\n", w);
    printf("  → Tiempos: LR %.1f ms · MLP %.1f ms · VQC %.1f ms\n",
           lr_ms, mlp_ms, vqc_ms);
    printf("  → Nota: epochs distintos (LR %d, MLP %d, VQC %d); el coste por\n",
           LR_EPOCHS, MLP_EPOCHS, VQC_EPOCHS);
    printf("    epoch del VQC es mucho mayor (statevector + grad. finito).\n");

    qs_free(qs);
}

int main(void) {
    printf("╔══════════════════════════════════════════════════════════════╗\n");
    printf("║  Logística  vs  MLP (8)  vs  VQC (2 qubits)                  ║\n");
    printf("║  Mismo dataset 2D · BCE · accuracy · tiempo de train         ║\n");
    printf("╚══════════════════════════════════════════════════════════════╝\n");
    printf("\nSetup:\n");
    printf("  · %d muestras (%d train / %d test), 2 features, binario\n",
           N_SAMPLES, N_TRAIN, N_TEST);
    printf("  · Logística:  modelo lineal σ(w·x+b), %d epochs\n", LR_EPOCHS);
    printf("  · MLP:        2→%d(tanh)→1(sigmoid), backprop, %d epochs\n",
           N_HIDDEN, MLP_EPOCHS);
    printf("  · VQC:        angle encoding + %d capas RY+CNOT, %d epochs\n",
           N_LAYERS, VQC_EPOCHS);
    printf("  · VQC sobre nuestro simulador statevector (CPU clásica)\n");

    g_seed = 42;
    qs_seed(42);

    run_experiment("Blobs (linealmente separable)", make_blobs);
    run_experiment("Circulos concentricos (NO lineal)", make_circles);
    run_experiment("XOR / cuadrantes (NO lineal)", make_xor);

    printf("\n");
    printf("══════════════════════════════════════════════════════════════\n");
    printf(" Conclusiones\n");
    printf("══════════════════════════════════════════════════════════════\n");
    printf(" 1. LINEAL (blobs): LR y MLP al 100%%; VQC cerca. El lineal basta.\n");
    printf(" 2. CIRCULOS: LR ~azar; VQC mediocre; MLP ~100%%. Gana el MLP.\n");
    printf(" 3. XOR: LR falla; MLP y VQC pueden llegar al 100%%.\n");
    printf(" 4. El VQC gana a modelos LINEALES, no al baseline serio (MLP).\n");
    printf(" 5. Coste: cada epoch VQC simula 2^n amplitudes + 2·#params forwards;\n");
    printf("    el MLP usa backprop barato y escala a d y n mucho mayores.\n");
    printf("\n");

    return 0;
}
