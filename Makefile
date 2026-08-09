# Makefile para el simulador cuántico
# Windows (MinGW): make
# Linux/macOS:     make

CC      = gcc
CFLAGS  = -O2 -Wall -Wextra -std=c11
LDFLAGS = -lm

.PHONY: all clean run run-qml run-noise run-stab

all: quantum_sim qml_compare noise_demo stab_demo

quantum_sim: quantum_sim.o main.o
	$(CC) $(CFLAGS) -o $@ quantum_sim.o main.o $(LDFLAGS)

qml_compare: quantum_sim.o qml_compare.o
	$(CC) $(CFLAGS) -o $@ quantum_sim.o qml_compare.o $(LDFLAGS)

noise_demo: quantum_sim.o noise_demo.o
	$(CC) $(CFLAGS) -o $@ quantum_sim.o noise_demo.o $(LDFLAGS)

stab_demo: stabilizer.o stab_demo.o
	$(CC) $(CFLAGS) -o $@ stabilizer.o stab_demo.o $(LDFLAGS)

quantum_sim.o qml_compare.o noise_demo.o main.o: quantum_sim.h
stabilizer.o stab_demo.o: stabilizer.h

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

run: quantum_sim
	./quantum_sim

run-qml: qml_compare
	./qml_compare

run-noise: noise_demo
	./noise_demo

run-stab: stab_demo
	./stab_demo

clean:
	rm -f *.o quantum_sim quantum_sim.exe qml_compare qml_compare.exe \
	      noise_demo noise_demo.exe stab_demo stab_demo.exe
