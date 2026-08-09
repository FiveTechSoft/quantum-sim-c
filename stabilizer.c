/*
 * Tableau de estabilizadores (estilo Aaronson–Gottesman / CHP)
 *
 * Filas 0 .. n-1  : destabilizers
 * Filas n .. 2n-1 : stabilizers
 * Columnas 0 .. n-1     : bits X
 * Columnas n .. 2n-1    : bits Z
 * Columna  2n           : bit de fase r (0 → +1, 1 → -1)
 */
#include "stabilizer.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* ---------- RNG ---------- */

static unsigned int g_rng = 1;

void stab_seed(unsigned int seed) {
    g_rng = seed ? seed : 1;
}

static double stab_rand01(void) {
    g_rng ^= g_rng << 13;
    g_rng ^= g_rng >> 17;
    g_rng ^= g_rng << 5;
    return (g_rng & 0xFFFFFFFFu) / 4294967296.0;
}

/* ---------- Acceso al tableau ---------- */

static inline unsigned char *row_ptr(StabState *st, int r) {
    return st->t + (size_t)r * (size_t)st->cols;
}

static inline const unsigned char *row_ptr_c(const StabState *st, int r) {
    return st->t + (size_t)r * (size_t)st->cols;
}

static inline unsigned char getb(const StabState *st, int r, int c) {
    return row_ptr_c(st, r)[c];
}

static inline void setb(StabState *st, int r, int c, unsigned char v) {
    row_ptr(st, r)[c] = (unsigned char)(v & 1);
}

static inline void xorb(StabState *st, int r, int c, unsigned char v) {
    row_ptr(st, r)[c] ^= (unsigned char)(v & 1);
}

/* ---------- Creación ---------- */

StabState *stab_create(int n_qubits) {
    if (n_qubits < 1 || n_qubits > 4096) {
        fprintf(stderr, "stab_create: n_qubits fuera de rango (1..4096)\n");
        return NULL;
    }
    StabState *st = (StabState *)calloc(1, sizeof(StabState));
    if (!st) return NULL;
    st->n = n_qubits;
    st->rows = 2 * n_qubits;
    st->cols = 2 * n_qubits + 1;
    st->t = (unsigned char *)calloc((size_t)st->rows * (size_t)st->cols, 1);
    if (!st->t) {
        free(st);
        return NULL;
    }
    /* Identidad: destab i tiene X_i; stab i tiene Z_i */
    for (int i = 0; i < n_qubits; i++) {
        setb(st, i, i, 1);                 /* destab: X_i */
        setb(st, n_qubits + i, n_qubits + i, 1); /* stab: Z_i */
    }
    static int seeded = 0;
    if (!seeded) {
        stab_seed((unsigned int)time(NULL));
        seeded = 1;
    }
    return st;
}

void stab_free(StabState *st) {
    if (!st) return;
    free(st->t);
    free(st);
}

void stab_reset(StabState *st) {
    if (!st) return;
    memset(st->t, 0, (size_t)st->rows * (size_t)st->cols);
    for (int i = 0; i < st->n; i++) {
        setb(st, i, i, 1);
        setb(st, st->n + i, st->n + i, 1);
    }
}

/* ---------- rowsum: suma de Pauli filas h += i (mod fases) ---------- */
/* Implementación estándar CHP: actualiza fase de h al sumar generador i. */

static int g_func(int x1, int z1, int x2, int z2) {
    /* Contribución de fase al multiplicar P1*P2 (Aaronson-Gottesman) */
    if (x1 == 0 && z1 == 0) return 0;
    if (x1 == 1 && z1 == 1) return z2 - x2;
    if (x1 == 1 && z1 == 0) return z2 * (2 * x2 - 1);
    /* x1==0 && z1==1 */
    return x2 * (1 - 2 * z2);
}

static void rowsum(StabState *st, int h, int i) {
    int n = st->n;
    int sum = 0;
    /* 2 * phase bits + sum g over qubits, then mod 4 */
    sum = 2 * getb(st, h, 2 * n) + 2 * getb(st, i, 2 * n);
    for (int j = 0; j < n; j++) {
        sum += g_func(getb(st, i, j), getb(st, i, n + j),
                      getb(st, h, j), getb(st, h, n + j));
    }
    sum = ((sum % 4) + 4) % 4;
    if (sum == 0)
        setb(st, h, 2 * n, 0);
    else if (sum == 2)
        setb(st, h, 2 * n, 1);
    else {
        /* fase ±i no debería aparecer en circuitos Clifford bien formados */
        setb(st, h, 2 * n, sum / 2);
    }
    for (int j = 0; j < 2 * n; j++)
        xorb(st, h, j, getb(st, i, j));
}

/* ---------- Puertas ---------- */

void stab_h(StabState *st, int q) {
    int n = st->n;
    for (int i = 0; i < 2 * n; i++) {
        unsigned char x = getb(st, i, q);
        unsigned char z = getb(st, i, n + q);
        /* fase: r ^= x z */
        if (x && z)
            xorb(st, i, 2 * n, 1);
        setb(st, i, q, z);
        setb(st, i, n + q, x);
    }
}

void stab_s(StabState *st, int q) {
    int n = st->n;
    for (int i = 0; i < 2 * n; i++) {
        unsigned char x = getb(st, i, q);
        unsigned char z = getb(st, i, n + q);
        if (x && z)
            xorb(st, i, 2 * n, 1);
        /* z ^= x */
        setb(st, i, n + q, (unsigned char)(z ^ x));
    }
}

void stab_sdg(StabState *st, int q) {
    /* S† = S³ */
    stab_s(st, q);
    stab_s(st, q);
    stab_s(st, q);
}

void stab_cnot(StabState *st, int control, int target) {
    int n = st->n;
    for (int i = 0; i < 2 * n; i++) {
        unsigned char xc = getb(st, i, control);
        unsigned char xt = getb(st, i, target);
        unsigned char zc = getb(st, i, n + control);
        unsigned char zt = getb(st, i, n + target);
        /* fase: r ^= x_c z_t (x_t ⊕ z_c ⊕ 1) */
        if (xc && zt && (xt ^ zc ^ 1))
            xorb(st, i, 2 * n, 1);
        /* x_t ^= x_c ; z_c ^= z_t */
        setb(st, i, target, (unsigned char)(xt ^ xc));
        setb(st, i, n + control, (unsigned char)(zc ^ zt));
    }
}

void stab_x(StabState *st, int q) {
    /* X = H S S H  o conjugación: solo fases de estabilizadores con Z */
    int n = st->n;
    for (int i = 0; i < 2 * n; i++) {
        if (getb(st, i, n + q))
            xorb(st, i, 2 * n, 1);
    }
}

void stab_z(StabState *st, int q) {
    int n = st->n;
    for (int i = 0; i < 2 * n; i++) {
        if (getb(st, i, q))
            xorb(st, i, 2 * n, 1);
    }
}

void stab_y(StabState *st, int q) {
    /* Y = i X Z → en Clifford: X luego Z (fase global irrelevante) */
    stab_z(st, q);
    stab_x(st, q);
}

void stab_cz(StabState *st, int a, int b) {
    /* CZ = H_b CNOT(a,b) H_b */
    stab_h(st, b);
    stab_cnot(st, a, b);
    stab_h(st, b);
}

void stab_swap(StabState *st, int a, int b) {
    if (a == b) return;
    stab_cnot(st, a, b);
    stab_cnot(st, b, a);
    stab_cnot(st, a, b);
}

/* ---------- Medición Z ---------- */

bool stab_is_deterministic(const StabState *st, int q) {
    int n = st->n;
    for (int i = n; i < 2 * n; i++) {
        if (getb(st, i, q))
            return false; /* algún estabilizador tiene X_q → aleatorio */
    }
    return true;
}

int stab_measure(StabState *st, int q) {
    int n = st->n;
    int p = -1; /* fila estabilizadora con X_q = 1 */

    for (int i = n; i < 2 * n; i++) {
        if (getb(st, i, q)) {
            p = i;
            break;
        }
    }

    if (p == -1) {
        /* Resultado determinado: usar destab + rowsum para leer fase */
        /* Crear fila temporal en... no tenemos temp; reconstruir con destabs */
        /* CHP: sumar a una fila auxiliar todos los destab j con X_q en stab? */
        /*
         * Algoritmo determinista CHP:
         * outcome = 0
         * for i in destabilizers:
         *   if stabilizer-like check... 
         * Actually: measure deterministic — for each stab generator that has Z
         * only, the phase of product of destabs.
         *
         * Standard: create temporary row = 0, for i=0..n-1:
         *   if tableau[i+n][q]==? wait.
         *
         * From Aaronson-Gottesman:
         * If measurement is determined, for i in 0..n-1:
         *   if x_{i+n,q} no that's random case.
         * Determined: no stabilizer has x_q=1.
         * Then R = I (temp), for i=0..n-1: if x_{i,q}=1 then rowsum(R, i+n)
         * outcome = phase of R.
         */
        unsigned char *tmp = (unsigned char *)calloc((size_t)st->cols, 1);
        if (!tmp) return 0;
        /* Usamos rowsum solo sobre filas del tableau; simulamos temp como fila extra
         * copiando lógica inline: */
        /* Inicializar "fila virtual" en buffer */
        memset(tmp, 0, (size_t)st->cols);
        for (int i = 0; i < n; i++) {
            if (getb(st, i, q)) {
                /* tmp += stabilizer row (n+i) */
                int sum = 2 * tmp[2 * n] + 2 * getb(st, n + i, 2 * n);
                for (int j = 0; j < n; j++) {
                    sum += g_func(getb(st, n + i, j), getb(st, n + i, n + j),
                                  tmp[j], tmp[n + j]);
                }
                sum = ((sum % 4) + 4) % 4;
                tmp[2 * n] = (sum == 2) ? 1 : 0;
                for (int j = 0; j < 2 * n; j++)
                    tmp[j] ^= getb(st, n + i, j);
            }
        }
        int outcome = tmp[2 * n];
        free(tmp);
        return outcome;
    }

    /* Caso aleatorio: p es primer estabilizador con X_q */
    /* Para cada fila i ≠ p, si X_q, rowsum(i, p) */
    for (int i = 0; i < 2 * n; i++) {
        if (i != p && getb(st, i, q))
            rowsum(st, i, p);
    }

    /* Copiar fila p a destab correspondiente; fijar estabilizador a ±Z_q */
    int p_destab = p - n;
    memcpy(row_ptr(st, p_destab), row_ptr(st, p), (size_t)st->cols);

    memset(row_ptr(st, p), 0, (size_t)st->cols);
    setb(st, p, n + q, 1); /* Z_q */

    int outcome = (stab_rand01() < 0.5) ? 0 : 1;
    setb(st, p, 2 * n, (unsigned char)outcome); /* fase: 0 → +Z, 1 → -Z */
    return outcome;
}

/* ---------- Print ---------- */

void stab_print(const StabState *st) {
    int n = st->n;
    printf("Estabilizadores (%d qubits):\n", n);
    for (int i = n; i < 2 * n; i++) {
        printf("  %c", getb(st, i, 2 * n) ? '-' : '+');
        for (int q = 0; q < n; q++) {
            int x = getb(st, i, q);
            int z = getb(st, i, n + q);
            char c = 'I';
            if (x && !z) c = 'X';
            else if (!x && z) c = 'Z';
            else if (x && z) c = 'Y';
            printf("%c", c);
        }
        printf("\n");
    }
}

double stab_prob_all_zero_if_computational(const StabState *st) {
    /* Si todos los estabilizadores son ±Z_j (computacional), P(all0) es 0 o 1 */
    int n = st->n;
    for (int i = n; i < 2 * n; i++) {
        for (int q = 0; q < n; q++) {
            if (getb(st, i, q)) return -1.0; /* tiene X o Y */
        }
    }
    /* Cada fila debe ser un ±Z en un qubit (forma canónica no garantizada).
     * Comprobar si |0...0⟩ es fijado: medirías todos 0. */
    /* Si algún estabilizador es -Z_j sin otros, |0> no es +1 eigenstate. */
    for (int i = n; i < 2 * n; i++) {
        int zcount = 0, zq = -1;
        for (int q = 0; q < n; q++) {
            if (getb(st, i, n + q)) {
                zcount++;
                zq = q;
            }
        }
        if (zcount == 1 && getb(st, i, 2 * n) == 1) {
            /* -Z_q → eigenstate con bit q = 1 */
            return 0.0;
        }
        (void)zq;
    }
    return 1.0;
}
