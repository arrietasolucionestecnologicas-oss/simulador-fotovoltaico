// Servidor de desarrollo LOCAL — sirve www/ y emula el backend de Apps Script
// ejecutando el Code.gs REAL dentro de un sandbox (no es una copia/duplicado de la lógica).
// Solo la generación de PDF vía Google Docs/Drive se reemplaza por una vista previa HTML,
// porque esa parte depende de servicios de Google que no existen fuera de Apps Script.
// Uso: node dev-server.js  →  http://localhost:8744
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = __dirname;
const WWW_DIR = path.join(ROOT, 'www');
const CODE_GS_PATH = path.join(ROOT, 'backend-appscript', 'clone-real', 'Code.gs');
const DEV_DATA_DIR = path.join(ROOT, 'dev-data');
const PORT = 8744;

// ── Base de datos en memoria (mismo formato que getValues() de un Sheet real) ──
const db = {
  Catalogo: JSON.parse(fs.readFileSync(path.join(DEV_DATA_DIR, 'catalogo.json'), 'utf8')),
  ParametrosZona: JSON.parse(fs.readFileSync(path.join(DEV_DATA_DIR, 'zonas.json'), 'utf8')),
  Cotizaciones: JSON.parse(fs.readFileSync(path.join(DEV_DATA_DIR, 'cotizaciones.json'), 'utf8'))
};

const ARCHIVO_POR_HOJA = { Catalogo: 'catalogo.json', ParametrosZona: 'zonas.json', Cotizaciones: 'cotizaciones.json' };

function persistir_(nombre) {
  fs.writeFileSync(path.join(DEV_DATA_DIR, ARCHIVO_POR_HOJA[nombre]), JSON.stringify(db[nombre], null, 2));
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
          persistir_(nombre);
        }
      };
    },
    getLastColumn: function () { return (db[nombre][0] || []).length; },
    appendRow: function (fila) {
      db[nombre].push(fila);
      persistir_(nombre);
    },
    deleteRow: function (row) {
      db[nombre].splice(row - 1, 1);
      persistir_(nombre);
    },
    setFrozenRows: function () {},
    getLastRow: function () { return db[nombre].length; }
  };
}

// ── Shims mínimos de los servicios de Apps Script que Code.gs necesita ──
const devProps = { SHEET_ID: 'dev-local', DOC_TEMPLATE_ID: 'dev-local', PDF_FOLDER_ID: null, API_KEY: null };
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
vm.runInContext(fs.readFileSync(CODE_GS_PATH, 'utf8'), sandbox, { filename: 'Code.gs' });

// ── Vista previa local de la propuesta (reemplaza el PDF real de Google Docs) ──
const propuestas = new Map();

function construirPropuestaHtml(datos, r) {
  const metodo = r.metodoUsado === 'cargabilidad'
    ? 'Demanda máxima del recibo: ' + r.demandaMaximaKW + ' kW'
    : 'Consumo mensual: ' + r.consumoMensualKWh + ' kWh';
  const filas = [
    ['Cliente', datos.cliente || ''],
    ['Dirección', datos.direccion || ''],
    ['Ciudad', datos.ciudad || ''],
    ['Método de dimensionamiento', metodo],
    ['Potencia del sistema', r.potenciaAjustadaKwp + ' kWp'],
    ['Número de paneles', r.numPaneles],
    ['Panel', r.panel.marca + ' ' + r.panel.modelo + ' (' + r.panel.potenciaW + ' Wp)'],
    ['Inversor', r.inversor.marca + ' ' + r.inversor.modelo],
    ['Paneles por string × strings', r.verificacionString.panelesPorString + ' × ' + r.verificacionString.numeroStrings],
    ['Inversión estimada', '$' + r.financiero.inversionEstimada.toLocaleString('es-CO')],
    ['Ahorro mensual', '$' + r.financiero.ahorroMensual.toLocaleString('es-CO')],
    ['Payback', r.financiero.paybackAnos + ' años'],
    ['Retorno a 25 años', '$' + r.financiero.retorno25Anos.toLocaleString('es-CO')]
  ];
  const bomFilas = r.bom.items.map(function (it) {
    return '<tr><td>' + it.categoria + (it.marca ? ' — ' + it.marca + ' ' + it.modelo : '') + '</td>' +
      '<td>' + it.cantidad + ' ' + it.unidad + '</td>' +
      '<td>$' + it.precioUnitario.toLocaleString('es-CO') + '</td>' +
      '<td>$' + it.subtotal.toLocaleString('es-CO') + '</td></tr>';
  }).join('');
  const advertenciasHtml = r.bom.advertencias.length
    ? '<div class="aviso">' + r.bom.advertencias.join('<br>') + '</div>' : '';

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<title>Propuesta (vista previa local)</title>' +
    '<style>body{font-family:Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#e0e0e0;padding:32px}' +
    'h1{color:#00e5ff;font-size:18px}h2{color:#00e5ff;font-size:14px;margin-top:32px}' +
    'table{border-collapse:collapse;width:100%;max-width:720px}' +
    'td,th{padding:8px 12px;border-bottom:1px solid #333;text-align:left;font-size:13px}' +
    'th{color:#00e5ff;font-size:11px;text-transform:uppercase}' +
    'td:first-child{color:#999}.bom td:first-child{color:#e0e0e0}' +
    '.nota{margin-top:24px;font-size:12px;color:#999;line-height:1.6}' +
    '.diagrama{margin-top:16px;max-width:100%;overflow-x:auto}' +
    '.aviso{background:rgba(255,176,32,.12);border:1px solid #ffb020;color:#ffb020;padding:10px 14px;border-radius:8px;margin-bottom:20px;font-size:13px}</style></head><body>' +
    '<div class="aviso">Vista previa local — el PDF real con la plantilla de marca se genera con Google Docs una vez desplegado el backend (ver SETUP.md).</div>' +
    '<h1>Propuesta técnica comercial — Sistema fotovoltaico AGPE</h1>' +
    '<table>' + filas.map(function (f) { return '<tr><td>' + f[0] + '</td><td>' + f[1] + '</td></tr>'; }).join('') + '</table>' +
    '<h2>Diagrama unifilar</h2><div class="diagrama">' + r.diagramaSVG + '</div>' +
    '<h2>Lista de materiales (BOM)</h2>' + advertenciasHtml +
    '<table class="bom"><tr><th>Ítem</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr>' + bomFilas +
    '<tr><td><strong>Total materiales</strong></td><td></td><td></td><td><strong>$' + r.bom.totalMateriales.toLocaleString('es-CO') + '</strong></td></tr></table>' +
    '<div class="nota">' + r.regulatorio.referenciaResolucion + '<br>' + r.regulatorio.notaRETIE + '<br>' + r.regulatorio.notaLey1715 + '</div>' +
    '</body></html>';
}

function generarPropuestaLocal(datos) {
  const resultado = sandbox.calcularSistema(datos);
  if (resultado.fueraDeAlcanceAGPE || resultado.error) {
    return { resultado: resultado, pdfUrl: null };
  }
  const id = crypto.randomUUID();
  propuestas.set(id, construirPropuestaHtml(datos, resultado));
  const url = '/propuesta/' + id;
  sandbox.registrarCotizacion_(datos, resultado, url);
  return { resultado: resultado, pdfUrl: url };
}

// ── Servidor HTTP ──
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/api') {
    let body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'JSON inválido' }));
      }
      try {
        let data;
        switch (parsed.action) {
          case 'calcular': data = sandbox.calcularSistema(parsed.payload || {}); break;
          case 'getCatalogo': data = sandbox.leerCatalogo_(); break;
          case 'getZonas': data = sandbox.leerZonas_(); break;
          case 'guardarCatalogo': data = sandbox.guardarItemCatalogo_(parsed.payload || {}); break;
          case 'eliminarCatalogo': data = sandbox.eliminarItemCatalogo_((parsed.payload || {}).id); break;
          case 'guardarZona': data = sandbox.guardarZona_(parsed.payload || {}); break;
          case 'eliminarZona': data = sandbox.eliminarZona_((parsed.payload || {}).ciudad); break;
          case 'generarPropuesta': data = generarPropuestaLocal(parsed.payload || {}); break;
          default:
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Acción no reconocida: ' + parsed.action }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: data }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname.indexOf('/propuesta/') === 0) {
    const id = url.pathname.split('/')[2];
    const html = propuestas.get(id);
    if (!html) { res.writeHead(404); return res.end('Propuesta no encontrada (el servidor se reinició).'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // Estáticos de www/
  let filePath = path.join(WWW_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(WWW_DIR)) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(filePath, function (err, content) {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, function () {
  console.log('Simulador Fotovoltaico A.S.T. — dev server en http://localhost:' + PORT);
});
