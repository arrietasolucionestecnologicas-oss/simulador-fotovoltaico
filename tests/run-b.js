// Fase B — Paso 9 (regresión) para los Golden Cases B01-B08.
// Cada caso llama `run(sandbox)` (definido en golden-cases-b.js) y compara contra
// `expectedOutput` congelado — capturado en vivo, no calculado a mano.
'use strict';
const path = require('path');
const { crearSandboxGAS } = require('../gas-sandbox');
const casos = require('./golden-cases-b');
const { diferencias } = require('./compare');

const { sandbox } = crearSandboxGAS({ dataDir: path.join(__dirname, 'fixtures'), persistirCambios: false });

let totalPass = 0, totalFail = 0;

console.log('=== Fase B — Golden Cases B01-B08 ===\n');

casos.forEach(function (caso) {
  let obtenido, error = null;
  try {
    obtenido = caso.run(sandbox);
  } catch (e) {
    error = e;
  }

  if (error) {
    totalFail++;
    console.log('✗ FAIL  ' + caso.name + '  — ' + caso.notes);
    console.log('        excepción: ' + error.message);
    return;
  }

  const diffs = diferencias(caso.expectedOutput, obtenido, '');
  if (diffs.length === 0) {
    totalPass++;
    console.log('✓ PASS  ' + caso.name + '  — ' + caso.notes);
  } else {
    totalFail++;
    console.log('✗ FAIL  ' + caso.name + '  — ' + caso.notes);
    diffs.forEach(function (d) {
      console.log('        campo: ' + d.ruta);
      console.log('          esperado: ' + JSON.stringify(d.esperado));
      console.log('          obtenido: ' + JSON.stringify(d.obtenido));
    });
  }
});

console.log('\n' + totalPass + ' PASS / ' + totalFail + ' FAIL de ' + casos.length + ' Golden Cases B.');

if (totalFail > 0) {
  console.log('\nDETENIDO — no se actualiza expectedOutput automáticamente.');
  process.exit(1);
}
console.log('\nTodos los Golden Cases B pasan.');
process.exit(0);
