// Sandbox compartido para ejecutar los archivos .gs REALES de backend-appscript/clone-real/
// dentro de Node, sin duplicar su lógica. Usado por dev-server.js (desarrollo interactivo) y
// por tests/run.js (Golden Cases, Fase A). Apps Script concatena todos sus archivos .gs en un
// mismo contexto de ejecución global — este módulo reproduce exactamente eso cargando cada
// archivo, en orden, dentro del mismo vm.Context.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const CODE_DIR = path.join(__dirname, 'backend-appscript', 'clone-real');

// Orden de carga: Code.gs primero (motor legacy), luego las piezas de Fase A que dependen de
// que STATUS/calcularSistema ya existan en el contexto al momento en que se LLAMEN (no al
// momento en que se DEFINEN, por hoisting de function declarations).
const ARCHIVOS_GS = ['Code.gs', 'Status.gs', 'Legacy.gs', 'ProjectModel.gs', 'Audit.gs'];

/**
 * dataDir: carpeta con catalogo.json / zonas.json / cotizaciones.json (mismo formato que
 *          getValues() de un Sheet real: array de arrays, primera fila = encabezados).
 * persistirCambios: si true, appendRow/setValues/deleteRow escriben de vuelta a disco (como
 *          dev-server.js). Si false, los cambios quedan solo en memoria (para tests, que no
 *          deben modificar los fixtures en disco).
 */
function crearSandboxGAS(opciones) {
  const dataDir = opciones.dataDir;
  const persistirCambios = opciones.persistirCambios !== false;

  const db = {
    Catalogo: JSON.parse(fs.readFileSync(path.join(dataDir, 'catalogo.json'), 'utf8')),
    ParametrosZona: JSON.parse(fs.readFileSync(path.join(dataDir, 'zonas.json'), 'utf8')),
    Cotizaciones: JSON.parse(fs.readFileSync(path.join(dataDir, 'cotizaciones.json'), 'utf8'))
  };
  const archivoPorHoja = { Catalogo: 'catalogo.json', ParametrosZona: 'zonas.json', Cotizaciones: 'cotizaciones.json' };

  function persistir(nombre) {
    if (!persistirCambios) return;
    fs.writeFileSync(path.join(dataDir, archivoPorHoja[nombre]), JSON.stringify(db[nombre], null, 2));
  }

  function makeSheet(nombre) {
    return {
      getDataRange: function () {
        return { getValues: function () { return db[nombre].map(function (r) { return r.slice(); }); } };
      },
      getRange: function (row, col, numRows, numCols) {
        return {
          getValues: function () {
            const out = [];
            for (let r = 0; r < (numRows || 1); r++) {
              const fila = db[nombre][row - 1 + r] || [];
              out.push(fila.slice(col - 1, col - 1 + (numCols || 1)));
            }
            return out;
          },
          setValues: function (valores) {
            valores.forEach(function (fila, i) {
              const destino = db[nombre][row - 1 + i] || (db[nombre][row - 1 + i] = []);
              fila.forEach(function (v, j) { destino[col - 1 + j] = v; });
            });
            persistir(nombre);
          }
        };
      },
      getLastColumn: function () { return (db[nombre][0] || []).length; },
      appendRow: function (fila) { db[nombre].push(fila); persistir(nombre); },
      deleteRow: function (row) { db[nombre].splice(row - 1, 1); persistir(nombre); },
      setFrozenRows: function () {},
      getLastRow: function () { return db[nombre].length; }
    };
  }

  const devProps = { SHEET_ID: 'sandbox', DOC_TEMPLATE_ID: 'sandbox', PDF_FOLDER_ID: null, API_KEY: null };
  const sandbox = {
    PropertiesService: { getScriptProperties: function () { return { getProperty: function (k) { return devProps[k]; } }; } },
    SpreadsheetApp: { openById: function () { return { getSheetByName: function (n) { return db[n] ? makeSheet(n) : null; } }; } },
    Utilities: {
      getUuid: function () { return crypto.randomUUID(); },
      formatDate: function (date, tz, fmt) {
        const d = date;
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return fmt.indexOf('yyyy-MM-dd') === 0
          ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
          : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
      }
    },
    console: console
  };

  vm.createContext(sandbox);
  ARCHIVOS_GS.forEach(function (nombreArchivo) {
    const ruta = path.join(CODE_DIR, nombreArchivo);
    vm.runInContext(fs.readFileSync(ruta, 'utf8'), sandbox, { filename: nombreArchivo });
  });

  return { sandbox: sandbox, db: db };
}

module.exports = { crearSandboxGAS: crearSandboxGAS, CODE_DIR: CODE_DIR, ARCHIVOS_GS: ARCHIVOS_GS };
