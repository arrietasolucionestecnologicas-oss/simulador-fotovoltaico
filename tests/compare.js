// Comparación profunda compartida por tests/run.js (Golden Cases A) y tests/run-b.js
// (Golden Cases B) — un solo lugar para la lógica de diff, no una copia en cada runner.
'use strict';

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
    Object.keys(esperado).forEach(function (k) {
      salida.push.apply(salida, diferencias(esperado[k], obtenido ? obtenido[k] : undefined, (ruta ? ruta + '.' : '') + k));
    });
    return salida;
  }

  salida.push({ ruta: ruta || '(raíz)', esperado: esperado, obtenido: obtenido });
  return salida;
}

module.exports = { diferencias: diferencias };
