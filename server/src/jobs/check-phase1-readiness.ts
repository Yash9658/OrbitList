import { getPhase1Readiness } from "../config/phase1-readiness.js";

const readiness = getPhase1Readiness();

console.log(`${readiness.phase}`);
console.log(`Status: ${readiness.status}`);
console.log(readiness.summary);
console.log("");

for (const item of readiness.items) {
  console.log(`- [${item.status}] ${item.key}: ${item.message}`);
}

if (readiness.status === "blocked") {
  process.exitCode = 1;
}
