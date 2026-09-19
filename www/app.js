// Simulador Fotovoltaico A.S.T. — Frontend
// En localhost usa automáticamente el servidor de desarrollo (dev-server.js).
// Para producción: pega aquí la URL del Web App desplegado y la misma API_KEY
// configurada en Propiedades del script del backend (ver SETUP.md).
const IS_LOCAL_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_URL = IS_LOCAL_DEV ? '/api' : "PENDIENTE_DEPLOY_URL";
const API_KEY = IS_LOCAL_DEV ? 'dev-local' : "PENDIENTE_API_KEY";

let zonasCache = [];
let ultimoResultado = null;
let ultimosDatosCliente = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await cargarZonas();
    document.getElementById('btnCalcular').addEventListener('click', calcular);
    document.getElementById('btnPropuesta').addEventListener('click', generarPropuesta);
    document.getElementById('metodoDimensionamiento').addEventListener('change', toggleMetodo);
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => mostrarVista(btn.dataset.view));
    });
    toggleMetodo();
}

function mostrarVista(nombre) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + nombre));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === nombre));
}

function habilitarNav(nombre) {
    const btn = document.querySelector('.nav-item[data-view="' + nombre + '"]');
    if (btn) btn.disabled = false;
}

function toggleMetodo() {
    const esCargabilidad = document.getElementById('metodoDimensionamiento').value === 'cargabilidad';
    document.getElementById('campoConsumo').classList.toggle('oculto', esCargabilidad);
    document.getElementById('campoDemanda').classList.toggle('oculto', !esCargabilidad);
}

async function callApi(action, payload = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, auth: API_KEY, payload })
        });
        const result = await response.json();
        setStatus(true);
        return result;
    } catch (error) {
        console.error('Error API:', error);
        setStatus(false);
        return { success: false, error: error.message };
    }
}

function setStatus(ok) {
    const dot = document.getElementById('connection-status');
    const text = document.getElementById('connection-text');
    dot.className = 'status-dot ' + (ok ? 'bg-success' : 'bg-danger');
    text.textContent = ok ? 'Listo' : 'Sin conexión con el backend';
}

async function cargarZonas() {
    const res = await callApi('getZonas');
    const select = document.getElementById('ciudad');
    if (res.success && res.data.length) {
        zonasCache = res.data;
        select.innerHTML = zonasCache.map(z => `<option value="${z.ciudad}">${z.ciudad}</option>`).join('');
    } else {
        select.innerHTML = '<option value="Barranquilla">Barranquilla</option>';
    }
}

function leerFormulario() {
    const esCargabilidad = document.getElementById('metodoDimensionamiento').value === 'cargabilidad';
    return {
        cliente: document.getElementById('cliente').value.trim(),
        tipoCliente: document.getElementById('tipoCliente').value,
        direccion: document.getElementById('direccion').value.trim(),
        ciudad: document.getElementById('ciudad').value,
        consumoMensualKWh: esCargabilidad ? 0 : Number(document.getElementById('consumoMensual').value),
        demandaMaximaKW: esCargabilidad ? Number(document.getElementById('demandaMaxima').value) : 0,
        sistemaHibrido: document.getElementById('sistemaHibrido').checked
    };
}

async function calcular() {
    const datos = leerFormulario();
    if (!datos.consumoMensualKWh && !datos.demandaMaximaKW) {
        alert('Ingresa el consumo mensual (kWh) o la demanda máxima del recibo (kW).');
        return;
    }

    const btn = document.getElementById('btnCalcular');
    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Calculando...';

    const res = await callApi('calcular', datos);

    btn.disabled = false;
    btn.innerText = textoOriginal;

    if (!res.success) {
        alert('Error: ' + res.error);
        return;
    }

    ultimoResultado = res.data;
    ultimosDatosCliente = datos;
    mostrarResultado(res.data);
}

function mostrarResultado(r) {
    const alertas = document.getElementById('alertas');
    const grid = document.getElementById('resultadoGrid');
    const nota = document.getElementById('notaRegulatoria');
    const btnPropuesta = document.getElementById('btnPropuesta');

    alertas.innerHTML = '';
    grid.innerHTML = '';
    nota.innerHTML = '';
    btnPropuesta.classList.add('oculto');
    actualizarSidebarProyecto(null);

    habilitarNav('resumen');
    mostrarVista('resumen');

    if (r.fueraDeAlcanceAGPE) {
        alertas.innerHTML = `<div class="alerta danger">${r.mensaje}</div>`;
        return;
    }

    if (r.error) {
        alertas.innerHTML = `<div class="alerta warning">${r.error}</div>`;
        return;
    }

    const metodo = r.metodoUsado === 'cargabilidad'
        ? 'Demanda máxima: ' + r.demandaMaximaKW + ' kW'
        : 'Consumo mensual: ' + r.consumoMensualKWh + ' kWh';

    grid.innerHTML = [
        stat(r.potenciaAjustadaKwp + ' kWp', 'Potencia del sistema (' + metodo + ')'),
        stat(r.numPaneles, 'Número de paneles'),
        stat(r.panel.marca + ' ' + r.panel.modelo, 'Panel (' + r.panel.potenciaW + ' Wp)'),
        stat(r.inversor.marca + ' ' + r.inversor.modelo, 'Inversor'),
        stat(r.verificacionString.panelesPorString + ' × ' + r.verificacionString.numeroStrings, 'Paneles/string × strings'),
        stat(formatCOP(r.financiero.inversionEstimada), 'Inversión estimada (equipos + BOM + instalación)'),
        stat(formatCOP(r.financiero.ahorroMensual), 'Ahorro mensual'),
        stat(r.financiero.paybackAnos + ' años', 'Payback'),
        stat(formatCOP(r.financiero.retorno25Anos), 'Retorno a 25 años')
    ].join('');

    nota.innerHTML = `
        <strong>Chequeo regulatorio:</strong> ${r.regulatorio.referenciaResolucion}<br>
        ${r.regulatorio.notaRETIE}<br>
        ${r.regulatorio.notaLey1715}
    `;

    btnPropuesta.classList.remove('oculto');
    actualizarSidebarProyecto(r);

    if (r.diagramaSVG) {
        document.getElementById('diagramaContenedor').innerHTML = r.diagramaSVG;
        habilitarNav('diagrama');
    }

    if (r.bom) {
        mostrarBOM(r.bom);
        habilitarNav('bom');
    }
}

function actualizarSidebarProyecto(r) {
    const caja = document.getElementById('sidebarProyecto');
    if (!r) { caja.classList.add('oculto'); return; }
    document.getElementById('sidebarCliente').textContent = ultimosDatosCliente.cliente || 'Cliente sin nombre';
    document.getElementById('sidebarPotencia').textContent = r.potenciaAjustadaKwp + ' kWp';
    caja.classList.remove('oculto');
}

function mostrarBOM(bom) {
    const advertencias = document.getElementById('bomAdvertencias');
    const cuerpo = document.getElementById('bomCuerpo');

    advertencias.innerHTML = bom.advertencias.length
        ? bom.advertencias.map(a => `<div class="alerta warning">${a}</div>`).join('')
        : '';

    const filas = bom.items.map(it => `
        <tr>
            <td>${it.categoria}${it.marca ? ' — ' + it.marca + ' ' + it.modelo : ''}</td>
            <td>${it.cantidad} ${it.unidad}</td>
            <td>${formatCOP(it.precioUnitario)}</td>
            <td>${formatCOP(it.subtotal)}</td>
        </tr>`).join('');

    const filaTotal = `
        <tr>
            <td style="font-weight:700;color:var(--ast-cyan);">Total materiales</td>
            <td></td><td></td>
            <td style="font-weight:700;color:var(--ast-cyan);">${formatCOP(bom.totalMateriales)}</td>
        </tr>`;

    cuerpo.innerHTML = filas + filaTotal;
}

function stat(valor, etiqueta) {
    return `<div class="stat"><div class="valor">${valor}</div><div class="etiqueta">${etiqueta}</div></div>`;
}

function formatCOP(n) {
    return '$' + Number(n).toLocaleString('es-CO');
}

async function generarPropuesta() {
    if (!ultimosDatosCliente) return;

    const btn = document.getElementById('btnPropuesta');
    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Generando PDF...';

    const res = await callApi('generarPropuesta', ultimosDatosCliente);

    btn.disabled = false;
    btn.innerText = textoOriginal;

    if (!res.success) {
        alert('Error generando la propuesta: ' + res.error);
        return;
    }

    if (res.data.pdfUrl) {
        window.open(res.data.pdfUrl, '_blank');
    } else {
        alert('No se pudo generar el PDF para este resultado.');
    }
}
