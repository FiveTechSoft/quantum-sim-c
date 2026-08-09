const fs = require("fs");
const vm = require("vm");
const code = fs.readFileSync("js/quantum_sim.js", "utf8");
const sandbox = {
  console,
  Math,
  Date,
  parseFloat,
  parseInt,
  isNaN,
  String,
  Array,
  Object,
  Error,
  JSON,
  Infinity,
  NaN,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const src = `# Estado de Bell
qubits 2
H 0
CNOT 0 1
PRINT
PROBS
`;
const r = sandbox.QuantumSim.runCircuit(src);
console.log("probs", r.probs);
console.log(r.log.join("\n"));
