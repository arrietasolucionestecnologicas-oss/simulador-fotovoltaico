// Fase A — Paso 8: prueba de regresión contra los Golden Cases (ENGINEERING.md, secciones
// "REGLA DE REGRESIÓN" y "TESTING OBLIGATORIO").
//
// Corre `legacyCalculationEngine()` (alias de `calcularSistema()`, Code.gs sin cambios) contra
// cada Golden Case y compara el resultado, campo por campo, contra `expectedLegacyOutput`
// congelado en golden-cases.js. Si algo cambió: SE DETIENE y explica exactamente qué, dónde y
// compara valor esperado vs. obtenido — nunca actualiza el expected value automáticamente.
//
// Uso:  node tests/run.js
'use strict';
const path = require('path');
const { crearSandboxGAS } = require('../gas-sandbox');
const casos = require('./golden-cases');

const FIX_MIXTO = path.join(__dirname, 'fixtures');
const FIX_INCOMPATIBLE = path.join(__dirname, 'fixtures-incompatible');

const motores = {
  mixto: crearSandboxGAS({ dataDir: FIX_MIXTO, persistirCambios: false }).sandbox,
  incompatible: crearSandboxGAS({ dataDir: FIX_INCOMPATIBLE, persistirCambios: false }).sandbox
};

/** Compara dos valores recursivamente y acumula diferencias como rutas tipo "bom.items[2].precio". */
function diferencias(esperado, obtenido, ruta) {
  const salida = [];
  if (esperado === obtenido) return salida;

  const tipoE = esperado === null ? 'null' : typeof esperado;
  const tipoO = obtenido === null ? 'null' : typeof obtenido;

  if (tipoE !== tipoO) {
    salida.push({ ruta: ruta || '(raíz)', esperado: esperado, obtenido: obtenido });
    return salida;
  }

  if (Array.isArray(esperado)) {
    if (!Array.isArray(obtenido) || esperado.length !== obtenido.length) {
      salida.push({ ruta: ruta || '(raíz)', esperado: '[array de ' + esperado.length + ']', obtenido: Array.isArray(obtenido) ? '[array de ' + obtenido.length + ']' : obtenido });
      return salida;
    }
    esperado.forEach(function (v, i) {
      salida.push.apply(salida, diferencias(v, obtenido[i], (ruta || '') + '[' + i + ']'));
    });
    return salida;
  }

  if (tipoE === 'object' && esperado !== null) {
    const claves = Object.keys(esperado);
    claves.forEach(function (k) {
      salida.push.apply(salida, diferencias(esperado[k], obtenido ? obtenido[k] : undefined, (ruta ? ruta + '.' : '') + k));
    });
    return salida;
  }

  salida.push({ ruta: ruta || '(raíz)', esperado: esperado, obtenido: obtenido });
  return salida;
}

let totalPass = 0;
let totalFail = 0;
const resultadosPorCaso = [];

casos.forEach(function (caso) {
  const motor = motores[caso.engine];
  if (!motor) throw new Error('Motor desconocido para ' + caso.name + ': ' + caso.engine);

  let obtenido;
  let errorInesperado = null;
  try {
    obtenido = motor.legacyCalculationEngine(caso.input);
  } catch (e) {
    errorInesperado = e;
  }

  if (errorInesperado) {
    totalFail++;
    resultadosPorCaso.push({ name: caso.name, pass: false, motivo: 'legacyCalculationEngine lanzó una excepción: ' + errorInesperado.message });
    return;
  }

  const diffs = diferencias(caso.expectedLegacyOutput, obtenido, '');
  if (diffs.length === 0) {
    totalPass++;
    resultadosPorCaso.push({ name: caso.name, pass: true });
  } else {
    totalFail++;
    resultadosPorCaso.push({ name: caso.name, pass: false, diffs: diffs });
  }
});

console.log('=== Fase A — Golden Cases ===\n');
resultadosPorCaso.forEach(function (r) {
  const caso = casos.find(function (c) { return c.name === r.name; });
  if (r.pass) {
    console.log('✓ PASS  ' + r.name + '  — ' + caso.notes);
  } else {
    console.log('✗ FAIL  ' + r.name + '  — ' + caso.notes);
    if (r.motivo) {
      console.log('        ' + r.motivo);
    } else {
      r.diffs.forEach(function (d) {
        console.log('        campo: ' + d.ruta);
        console.log('          esperado: ' + JSON.stringify(d.esperado));
        console.log('          obtenido: ' + JSON.stringify(d.obtenido));
      });
    }
  }
});

console.log('\n' + totalPass + ' PASS / ' + totalFail + ' FAIL de ' + casos.length + ' Golden Cases.');

if (totalFail > 0) {
  console.log('\nDETENIDO — hay resultados que cambiaron respecto al legacy congelado. No se');
  console.log('actualiza expectedLegacyOutput automáticamente (regla de Fase A, Paso 8).');
  process.exit(1);
}

console.log('\nTodos los Golden Cases pasan. Fase A: ningún resultado de cálculo cambió.');
process.exit(0);
