// Simulador Fotovoltaico A.S.T. — Frontend
// En localhost usa automáticamente el servidor de desarrollo (dev-server.js).
// Para producción: pega aquí la URL del Web App desplegado y la misma API_KEY
// configurada en Propiedades del script del backend (ver SETUP.md).
const IS_LOCAL_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_URL = IS_LOCAL_DEV ? '/api' : "https://script.google.com/macros/s/AKfycbzoQEhDRLY8xohAVBq4FMNn8DzB37f_euWCRI1K-mNDCqijFCM3Ip6YFVd5c4l_6fPQ_A/exec";
const API_KEY = IS_LOCAL_DEV ? 'dev-local' : "804d3433-e8b4-4135-9040-efac68ebcea2";

let zonasCache = [];
let catalogoCache = [];
let equipoEditandoId = null;
let zonaEditandoCiudad = null;
let ultimoResultado = null;
let ultimosDatosCliente = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await cargarZonas();
    await cargarCatalogoAdmin();
    await cargarZonasAdmin();

    document.getElementById('btnCalcular').addEventListener('click', calcular);
    document.getElementById('btnPropuesta').addEventListener('click', generarPropuesta);
    document.getElementById('metodoDimensionamiento').addEventListener('change', toggleMetodo);
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => mostrarVista(btn.dataset.view));
    });

    document.getElementById('filtroTipo').addEventListener('change', renderCatalogoTabla);
    document.getElementById('btnNuevoEquipo').addEventListener('click', () => abrirFormularioEquipo());
    document.getElementById('btnCancelarEquipo').addEventListener('click', cerrarFormularioEquipo);
    document.getElementById('btnGuardarEquipo').addEventListener('click', guardarEquipo);
    document.getElementById('fTipo').addEventListener('change', actualizarCamposFormularioEquipo);

    document.getElementById('btnNuevaZona').addEventListener('click', () => abrirFormularioZona());
    document.getElementById('btnCancelarZona').addEventListener('click', cerrarFormularioZona);
    document.getElementById('btnGuardarZona').addEventListener('click', guardarZonaForm);

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

// ── Administración de catálogo (equipos y proveedores) ─────────────────────

const CAMPOS_POR_TIPO = {
    Panel: ['campo-panel'],
    Inversor: ['campo-inversor'],
    Bateria: ['campo-bateria'],
    CableDC: ['campo-cable-proteccion'],
    CableAC: ['campo-cable-proteccion'],
    ProteccionDC: ['campo-cable-proteccion'],
    ProteccionAC: ['campo-cable-proteccion']
};
const NOMBRE_TIPO = {
    Panel: 'Panel', Inversor: 'Inversor', Bateria: 'Batería', Estructura: 'Estructura',
    CableDC: 'Cable DC', CableAC: 'Cable AC', ProteccionDC: 'Protección DC',
    ProteccionAC: 'Protección AC', DPS: 'DPS', ConectorMC4: 'Conector MC4',
    PuestaATierra: 'Puesta a tierra', Medidor: 'Medidor'
};

async function cargarCatalogoAdmin() {
    const res = await callApi('getCatalogo');
    if (res.success) catalogoCache = res.data;
    renderCatalogoTabla();
}

function renderCatalogoTabla() {
    const filtro = document.getElementById('filtroTipo').value;
    const cuerpo = document.getElementById('catalogoCuerpo');
    const items = catalogoCache.filter(it => !filtro || it.tipo === filtro);

    if (items.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="6" style="color:#999;">Sin equipos todavía. Usa "Agregar equipo".</td></tr>';
        return;
    }

    cuerpo.innerHTML = items.map(it => `
        <tr>
            <td>${NOMBRE_TIPO[it.tipo] || it.tipo}</td>
            <td>${it.marca || ''} ${it.modelo || ''}</td>
            <td>${it.proveedor || '—'}</td>
            <td>${formatCOP(it.precio)}</td>
            <td><span class="chip ${it.activo ? '' : 'inactivo'}">${it.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td style="white-space:nowrap;">
                <button class="btn-fila" data-editar="${it.id}">Editar</button>
                <button class="btn-fila eliminar" data-eliminar="${it.id}">Eliminar</button>
            </td>
        </tr>`).join('');

    cuerpo.querySelectorAll('[data-editar]').forEach(btn =>
        btn.addEventListener('click', () => abrirFormularioEquipo(btn.dataset.editar)));
    cuerpo.querySelectorAll('[data-eliminar]').forEach(btn =>
        btn.addEventListener('click', () => eliminarEquipo(btn.dataset.eliminar)));
}

function actualizarCamposFormularioEquipo() {
    const tipo = document.getElementById('fTipo').value;
    const clasesVisibles = CAMPOS_POR_TIPO[tipo] || [];
    document.querySelectorAll('.campo-panel, .campo-inversor, .campo-bateria, .campo-cable-proteccion')
        .forEach(el => el.classList.toggle('oculto', !clasesVisibles.some(c => el.classList.contains(c))));
}

function abrirFormularioEquipo(id) {
    equipoEditandoId = id || null;
    const item = id ? catalogoCache.find(it => it.id === id) : null;

    document.getElementById('formCatalogoTitulo').textContent = item ? 'Editar equipo' : 'Agregar equipo';
    document.getElementById('fTipo').value = item ? item.tipo : 'Panel';
    document.getElementById('fMarca').value = item ? item.marca : '';
    document.getElementById('fModelo').value = item ? item.modelo : '';
    document.getElementById('fProveedor').value = item ? item.proveedor : '';
    document.getElementById('fPrecio').value = item ? item.precio : '';
    document.getElementById('fPotenciaW').value = item ? item.potenciaW : '';
    document.getElementById('fVoc').value = item ? item.vocStc : '';
    document.getElementById('fVmp').value = item ? item.vmpStc : '';
    document.getElementById('fIsc').value = item ? item.iscStc : '';
    document.getElementById('fCoefTemp').value = item ? item.coefTempVoc : '';
    document.getElementById('fPotenciaInv').value = item ? item.potenciaW : '';
    document.getElementById('fVMaxDC').value = item ? item.voltajeMaxEntradaDC : '';
    document.getElementById('fMpptMin').value = item ? item.mpptMinV : '';
    document.getElementById('fMpptMax').value = item ? item.mpptMaxV : '';
    document.getElementById('fCorrienteMppt').value = item ? item.corrienteMaxPorMppt : '';
    document.getElementById('fNumMppt').value = item ? item.numeroMppt : '';
    document.getElementById('fCapacidad').value = item ? item.capacidadKWh : '';
    document.getElementById('fCorrienteA').value = item ? item.corrienteA : '';
    document.getElementById('fFicha').value = item ? item.fichaTecnicaURL : '';
    document.getElementById('fActivo').checked = item ? item.activo : true;

    actualizarCamposFormularioEquipo();
    document.getElementById('formCatalogoWrap').classList.remove('oculto');
}

function cerrarFormularioEquipo() {
    equipoEditandoId = null;
    document.getElementById('formCatalogoWrap').classList.add('oculto');
}

async function guardarEquipo() {
    const tipo = document.getElementById('fTipo').value;
    const esPanel = tipo === 'Panel';
    const esInversor = tipo === 'Inversor';

    const item = {
        id: equipoEditandoId || undefined,
        tipo: tipo,
        marca: document.getElementById('fMarca').value.trim(),
        modelo: document.getElementById('fModelo').value.trim(),
        proveedor: document.getElementById('fProveedor').value.trim(),
        precio: Number(document.getElementById('fPrecio').value) || 0,
        fichaTecnicaURL: document.getElementById('fFicha').value.trim(),
        activo: document.getElementById('fActivo').checked,
        potenciaW: esPanel ? Number(document.getElementById('fPotenciaW').value) || 0
            : esInversor ? Number(document.getElementById('fPotenciaInv').value) || 0 : '',
        vocStc: esPanel ? Number(document.getElementById('fVoc').value) || 0 : '',
        vmpStc: esPanel ? Number(document.getElementById('fVmp').value) || 0 : '',
        iscStc: esPanel ? Number(document.getElementById('fIsc').value) || 0 : '',
        coefTempVoc: esPanel ? Number(document.getElementById('fCoefTemp').value) || 0 : '',
        voltajeMaxEntradaDC: esInversor ? Number(document.getElementById('fVMaxDC').value) || 0 : '',
        mpptMinV: esInversor ? Number(document.getElementById('fMpptMin').value) || 0 : '',
        mpptMaxV: esInversor ? Number(document.getElementById('fMpptMax').value) || 0 : '',
        corrienteMaxPorMppt: esInversor ? Number(document.getElementById('fCorrienteMppt').value) || 0 : '',
        numeroMppt: esInversor ? Number(document.getElementById('fNumMppt').value) || 1 : '',
        capacidadKWh: tipo === 'Bateria' ? Number(document.getElementById('fCapacidad').value) || 0 : '',
        corrienteA: CAMPOS_POR_TIPO[tipo] && CAMPOS_POR_TIPO[tipo].includes('campo-cable-proteccion')
            ? Number(document.getElementById('fCorrienteA').value) || 0 : ''
    };

    if (!item.marca && !item.modelo) {
        alert('Ingresa al menos marca o modelo.');
        return;
    }

    const res = await callApi('guardarCatalogo', item);
    if (!res.success) {
        alert('Error guardando el equipo: ' + res.error);
        return;
    }
    cerrarFormularioEquipo();
    await cargarCatalogoAdmin();
}

async function eliminarEquipo(id) {
    const item = catalogoCache.find(it => it.id === id);
    if (!confirm('¿Eliminar "' + (item ? item.marca + ' ' + item.modelo : id) + '" del catálogo?')) return;

    const res = await callApi('eliminarCatalogo', { id });
    if (!res.success) {
        alert('Error eliminando: ' + res.error);
        return;
    }
    await cargarCatalogoAdmin();
}

// ── Administración de parámetros por ciudad ────────────────────────────────

async function cargarZonasAdmin() {
    const res = await callApi('getZonas');
    if (res.success) zonasCache = res.data;
    renderZonasTabla();
}

function renderZonasTabla() {
    const cuerpo = document.getElementById('zonasCuerpo');
    if (zonasCache.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="5" style="color:#999;">Sin ciudades configuradas.</td></tr>';
        return;
    }
    cuerpo.innerHTML = zonasCache.map(z => `
        <tr>
            <td>${z.ciudad}</td>
            <td>${z.hspPromedio}</td>
            <td>${z.temperaturaMinima} °C</td>
            <td>${formatCOP(z.tarifaEnergiaCOP)}</td>
            <td style="white-space:nowrap;">
                <button class="btn-fila" data-editar-zona="${z.ciudad}">Editar</button>
                <button class="btn-fila eliminar" data-eliminar-zona="${z.ciudad}">Eliminar</button>
            </td>
        </tr>`).join('');

    cuerpo.querySelectorAll('[data-editar-zona]').forEach(btn =>
        btn.addEventListener('click', () => abrirFormularioZona(btn.dataset.editarZona)));
    cuerpo.querySelectorAll('[data-eliminar-zona]').forEach(btn =>
        btn.addEventListener('click', () => eliminarZonaAdmin(btn.dataset.eliminarZona)));
}

function abrirFormularioZona(ciudad) {
    zonaEditandoCiudad = ciudad || null;
    const zona = ciudad ? zonasCache.find(z => z.ciudad === ciudad) : null;

    document.getElementById('zCiudad').value = zona ? zona.ciudad : '';
    document.getElementById('zCiudad').disabled = !!zona;
    document.getElementById('zHsp').value = zona ? zona.hspPromedio : '';
    document.getElementById('zTemp').value = zona ? zona.temperaturaMinima : '';
    document.getElementById('zTarifa').value = zona ? zona.tarifaEnergiaCOP : '';

    document.getElementById('formZonaWrap').classList.remove('oculto');
}

function cerrarFormularioZona() {
    zonaEditandoCiudad = null;
    document.getElementById('zCiudad').disabled = false;
    document.getElementById('formZonaWrap').classList.add('oculto');
}

async function guardarZonaForm() {
    const zona = {
        ciudad: document.getElementById('zCiudad').value.trim(),
        hspPromedio: Number(document.getElementById('zHsp').value) || 0,
        temperaturaMinima: Number(document.getElementById('zTemp').value) || 0,
        tarifaEnergiaCOP: Number(document.getElementById('zTarifa').value) || 0
    };
    if (!zona.ciudad) {
        alert('Ingresa el nombre de la ciudad.');
        return;
    }

    const res = await callApi('guardarZona', zona);
    if (!res.success) {
        alert('Error guardando la ciudad: ' + res.error);
        return;
    }
    cerrarFormularioZona();
    await cargarZonasAdmin();
    await cargarZonas();
}

async function eliminarZonaAdmin(ciudad) {
    if (!confirm('¿Eliminar "' + ciudad + '" de los parámetros de zona?')) return;
    const res = await callApi('eliminarZona', { ciudad });
    if (!res.success) {
        alert('Error eliminando: ' + res.error);
        return;
    }
    await cargarZonasAdmin();
    await cargarZonas();
}
