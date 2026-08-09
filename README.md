# Simulador de Ordenador Cuántico en C

Toolkit educativo de computación cuántica en **C puro** (sin dependencias): dos motores, demos de algoritmos, ruido NISQ y una comparación honesta de QML vs ML clásico.

## Motores

| Motor | Archivos | Escala | Uso |
|-------|----------|--------|-----|
| **Statevector** | `quantum_sim.h` / `.c` | ~12 qubits | Puertas generales, QML, ruido |
| **Estabilizadores** (Clifford) | `stabilizer.h` / `.c` | cientos de qubits | QEC, GHZ grande, sampling Clifford |

## Compilar y ejecutar

```bash
# Todo
make

# Demos
make run          # algoritmos: Bell, Deutsch, Grover, teleportación, QFT
make run-qml      # logística vs MLP vs VQC
make run-noise    # ruido NISQ (Bell, canales, Grover ruidoso)
make run-stab     # GHZ-64, código bit-flip, benchmark Clifford
```

Sin Make (GCC / MinGW / clang):

```bash
gcc -O2 -o quantum_sim quantum_sim.c main.c -lm && ./quantum_sim
gcc -O2 -o qml_compare quantum_sim.c qml_compare.c -lm && ./qml_compare
gcc -O2 -o noise_demo quantum_sim.c noise_demo.c -lm && ./noise_demo
gcc -O2 -o stab_demo stabilizer.c stab_demo.c -lm && ./stab_demo
```

MSVC:

```bat
cl /O2 /Fe:quantum_sim.exe quantum_sim.c main.c
```

## Contenido

| Archivo | Descripción |
|---------|-------------|
| `quantum_sim.h` / `.c` | Statevector: puertas, medición, ruido NISQ |
| `main.c` | Demos de algoritmos cuánticos clásicos |
| `qml_compare.c` | Logística vs MLP(8) vs VQC(2q) en datos 2D |
| `noise_demo.c` | Depolarizing, bit/phase flip, T1, Grover ruidoso |
| `stabilizer.h` / `.c` | Tableau Gottesman–Knill |
| `stab_demo.c` | GHZ, código 3-qubit, benchmark n=256 |
| `Makefile` | Targets `all`, `run`, `run-qml`, `run-noise`, `run-stab` |

## API statevector (rápida)

```c
QuantumState *qs = qs_create(2);  // |00⟩
gate_h(qs, 0);
gate_cnot(qs, 0, 1);              // Bell Φ+
qs_print(qs);
noise_depolarizing(qs, 0, 0.05);  // error NISQ
int bit = measure_qubit(qs, 0);
qs_free(qs);
```

### Puertas (statevector)

- **1 qubit:** H, X, Y, Z, S, S†, T, T†, Rx, Ry, Rz, Phase  
- **2 qubits:** CNOT, CZ, SWAP, CP  
- **3 qubits:** Toffoli (CCX), CSWAP (Fredkin)  
- **Ruido:** bit-flip, phase-flip, depolarizing, amplitude damping  

Convención: **qubit 0 = LSB**.

## API estabilizadores (rápida)

```c
StabState *st = stab_create(64);
stab_h(st, 0);
for (int i = 0; i < 63; i++)
    stab_cnot(st, i, i + 1);   // GHZ-64
int b = stab_measure(st, 0);
stab_free(st);
```

Solo Clifford: H, S, S†, X, Y, Z, CNOT, CZ, SWAP + medida Z.

## Demos de algoritmos (`main.c`)

1. Superposición (Hadamard)  
2. Bell Φ+  
3. Deutsch  
4. Grover (2 qubits, marca `|11⟩`)  
5. Teleportación  
6. QFT₃  

## QML vs ML clásico (`qml_compare`)

Comparación a tres bandas en datasets 2D (blobs, círculos, XOR):

| | Logística | MLP | VQC |
|--|-----------|-----|-----|
| Modelo | `σ(w·x+b)` | 2→8(tanh)→1 | angle encode + RY/CNOT |
| Params | 3 | 33 | 4 |

Mensaje: el VQC puede ganar a un modelo **lineal**; el **MLP** es el baseline serio de IA. No hay ventaja cuántica práctica en este régimen (simulado en CPU).

## Limitaciones

- Statevector: memoria \(O(2^n)\); práctico ~12 qubits.  
- Ruido: trayectorias estocásticas (no matriz densidad exacta \(4^n\)).  
- Estabilizadores: solo Clifford (sin T, Rx genérico ni VQC).  
- Proyecto **educativo**, no un backend de producción tipo Qiskit Aer.

## Licencia

Código de ejemplo / educativo. Úsalo, modifícalo y compártelo libremente.
