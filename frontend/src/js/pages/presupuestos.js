import { apiClient, practicanteApi } from '../api/client.js';
import { displayApiError, showSuccess, showError } from '../utils/errors.js';

export class PresupuestosPage {
    constructor(container) {
        this.container = container;
        this.tiposAbono = [];
        this.lugares = [];
        this.state = {
            id: null, // ID del presupuesto si ya existe
            cliente: '',
            practicanteId: null,
            fecha: new Date().toISOString().split('T')[0],
            items: [{ id: Date.now(), descripcion: '', cantidad: 1, precioBase: 0, descuento: 0, precio: 0, abonoId: '' }],
            observaciones: '',
            asistencia: [],
            selectedAsistenciaIds: new Set(),
            modalFilters: { desde: '', hasta: '', tipo: 'flexible' },
            historial: []
        };
    }

    async render() {
        this.container.innerHTML = `
            <div class="page-header mb-4 no-print flex justify-between items-center">
                <div>
                    <h1>Generador de Presupuestos</h1>
                    <p class="text-muted">Arma un presupuesto rápido incluyendo asistencias, créditos y cuotas sociales.</p>
                </div>
                <div class="flex gap-2">
                    <button id="btn-historial" class="btn btn-outline-info"><i class="fas fa-history mr-1"></i> Historial</button>
                    <button id="btn-limpiar" class="btn btn-outline-danger"><i class="fas fa-trash-alt mr-1"></i> Limpiar</button>
                    <button id="btn-guardar" class="btn btn-success"><i class="fas fa-save mr-1"></i> Guardar</button>
                    <button id="btn-imprimir" class="btn btn-primary"><i class="fas fa-print mr-1"></i> Imprimir</button>
                </div>
            </div>

            <div class="card p-4 shadow-sm mb-4 print-container">
                <div class="print-header mb-4" style="display: none;">
                    <div class="flex justify-between items-center border-bottom pb-4 mb-4">
                        <div class="flex items-center">
                            <img src="/src/assets/logo.png" alt="Logo" style="height: 60px; margin-right: 15px;">
                            <div>
                                <h2 class="mb-0">PRESUPUESTO</h2>
                                <p class="text-muted mb-0">Sistema de Gestión de Clases</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="mb-0 font-weight-bold">Fecha: <span id="print-fecha-val"></span></p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-2 gap-4 mb-4 no-print">
                    <div class="form-group position-relative">
                        <label class="font-weight-bold flex justify-between">
                            <span>Nombre del Cliente / Practicante</span>
                            <span id="badge-registrado" class="badge badge-success" style="display: none;"><i class="fas fa-check-circle mr-1"></i> Registrado</span>
                        </label>
                        <div class="input-group">
                            <input type="text" id="input-cliente" class="form-control" placeholder="Busca un alumno o escribe un nombre..." value="${this.state.cliente}" autocomplete="off">
                            <div class="input-group-append">
                                <button id="btn-buscar-practicante" class="btn btn-info" type="button" title="Seleccionar de la lista"><i class="fas fa-search-plus mr-1"></i></button>
                                <button id="btn-clear-practicante" class="btn btn-outline-danger" type="button" style="display: none;" title="Deseleccionar"><i class="fas fa-user-minus"></i></button>
                                <button id="btn-importar-asistencia" class="btn btn-outline-primary" type="button" title="Importar asistencia"><i class="fas fa-calendar-check mr-1"></i> Asistencia</button>
                            </div>
                        </div>
                        <div id="search-results" class="search-results-dropdown shadow" style="display: none;"></div>
                    </div>
                    <div class="form-group">
                        <label class="font-weight-bold">Fecha del Presupuesto</label>
                        <input type="date" id="input-fecha" class="form-control" value="${this.state.fecha}">
                    </div>
                </div>

                <div class="print-only mb-4">
                    <p class="mb-1"><strong>Dirigido a:</strong> <span id="print-cliente-val"></span></p>
                    <p><strong>Fecha de emisión:</strong> <span id="print-fecha-display"></span></p>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered table-hover">
                        <thead class="bg-light">
                            <tr>
                                <th style="width: 35%;">Descripción / Concepto</th>
                                <th style="width: 10%;" class="text-center">Cant.</th>
                                <th style="width: 15%;" class="text-right">Precio Base</th>
                                <th style="width: 10%;" class="text-right">Desc. %</th>
                                <th style="width: 15%;" class="text-right">Precio Final</th>
                                <th style="width: 15%;" class="text-right">Subtotal</th>
                                <th style="width: 5%;" class="text-center no-print"></th>
                            </tr>
                        </thead>
                        <tbody id="items-container"></tbody>
                        <tfoot>
                            <tr id="row-total-sin-descuento" style="display: none;">
                                <td colspan="5" class="text-right text-muted small">TOTAL SIN DESCUENTO</td>
                                <td id="total-sin-descuento" class="text-right text-muted small text-strikethrough">$0.00</td>
                                <td class="no-print"></td>
                            </tr>
                            <tr id="row-ahorro" style="display: none;">
                                <td colspan="5" class="text-right text-success font-weight-bold">AHORRO TOTAL</td>
                                <td id="total-ahorro" class="text-right text-success font-weight-bold">-$0.00</td>
                                <td class="no-print"></td>
                            </tr>
                            <tr>
                                <td colspan="5" class="text-right font-weight-bold">TOTAL ESTIMADO</td>
                                <td id="total-presupuesto" class="text-right font-weight-bold h4 mb-0 text-primary">$0.00</td>
                                <td class="no-print"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="flex justify-between mt-3 no-print">
                    <div class="flex gap-2">
                        <button id="btn-add-item" class="btn btn-outline-primary"><i class="fas fa-plus mr-1"></i> Ítem Manual</button>
                        <button id="btn-add-cuota-social" class="btn btn-outline-secondary"><i class="fas fa-id-card mr-1"></i> Cuota Social</button>
                    </div>
                </div>

                <div class="mt-4">
                    <label class="font-weight-bold no-print">Observaciones Generales</label>
                    <textarea id="input-observaciones" class="form-control" rows="3" placeholder="Notas adicionales...">${this.state.observaciones}</textarea>
                </div>

                <div class="print-only mt-5 pt-4 border-top text-muted small">
                    <p class="mb-0 text-center text-italic">Este presupuesto es de carácter informativo y tiene una validez de 15 días.</p>
                </div>
            </div>

            <!-- MODAL: HISTORIAL DE PRESUPUESTOS -->
            <div id="modal-historial" class="modal-backdrop no-print" style="display: none;">
                <div class="modal-content-custom shadow-lg">
                    <div class="modal-header-custom border-bottom bg-info text-white">
                        <h4 class="mb-0"><i class="fas fa-history mr-2"></i> Historial de Presupuestos</h4>
                        <button id="close-modal-historial" class="btn-close text-white">&times;</button>
                    </div>
                    <div class="modal-body-custom p-4">
                        <div class="input-group mb-3">
                            <input type="text" id="search-historial" class="form-control" placeholder="Buscar por cliente...">
                            <div class="input-group-append"><span class="input-group-text"><i class="fas fa-search"></i></span></div>
                        </div>
                        <div class="table-responsive" style="max-height: 400px;">
                            <table class="table table-sm table-hover">
                                <thead class="bg-light sticky-top">
                                    <tr><th>Fecha</th><th>Cliente</th><th class="text-right">Total</th><th class="text-right">Acciones</th></tr>
                                </thead>
                                <tbody id="historial-items"></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer-custom border-top p-3 text-right"><button id="btn-cancel-modal-historial" class="btn btn-secondary">Cerrar</button></div>
                </div>
            </div>

            <!-- MODAL: SELECCIÓN DE PRACTICANTE -->
            <div id="modal-select-practicante" class="modal-backdrop no-print" style="display: none;">
                <div class="modal-content-custom shadow-lg">
                    <div class="modal-header-custom border-bottom bg-info text-white">
                        <h4 class="mb-0"><i class="fas fa-users mr-2"></i> Seleccionar Practicante</h4>
                        <button id="close-modal-practicante" class="btn-close text-white">&times;</button>
                    </div>
                    <div class="modal-body-custom p-4">
                        <div class="input-group mb-3">
                            <input type="text" id="modal-search-practicante" class="form-control" placeholder="Buscar alumno...">
                            <div class="input-group-append"><span class="input-group-text"><i class="fas fa-search"></i></span></div>
                        </div>
                        <div class="table-responsive" style="max-height: 400px;">
                            <table class="table table-sm table-hover"><thead class="bg-light sticky-top"><tr><th>Nombre</th><th>DNI</th><th class="text-right">Acción</th></tr></thead><tbody id="practicantes-modal-list"></tbody></table>
                        </div>
                    </div>
                    <div class="modal-footer-custom border-top p-3 text-right"><button id="btn-cancel-modal-practicante" class="btn btn-secondary">Cerrar</button></div>
                </div>
            </div>

            <!-- MODAL: ASISTENCIA -->
            <div id="modal-asistencia" class="modal-backdrop no-print" style="display: none;">
                <div class="modal-content-custom shadow-lg">
                    <div class="modal-header-custom border-bottom bg-primary text-white">
                        <h4 class="mb-0"><i class="fas fa-calendar-alt mr-2"></i> Importar Asistencia / Créditos</h4>
                        <button id="close-modal-asistencia" class="btn-close text-white">&times;</button>
                    </div>
                    <div class="modal-body-custom p-0">
                        <div class="p-3 bg-light border-bottom small">
                            <div class="form-row align-items-end">
                                <div class="col-md-3"><label class="mb-1 font-weight-bold">Desde</label><input type="date" id="modal-filter-desde" class="form-control form-control-sm"></div>
                                <div class="col-md-3"><label class="mb-1 font-weight-bold">Hasta</label><input type="date" id="modal-filter-hasta" class="form-control form-control-sm"></div>
                                <div class="col-md-4"><label class="mb-1 font-weight-bold">Tipo</label><select id="modal-filter-tipo" class="form-control form-control-sm"><option value="">Todas</option><option value="flexible" selected>Particulares</option><option value="grupal">Grupales</option></select></div>
                                <div class="col-md-2"><button id="btn-refresh-asistencia" class="btn btn-sm btn-block btn-primary"><i class="fas fa-filter"></i></button></div>
                            </div>
                        </div>
                        <div class="p-4">
                            <p id="asistencia-practicante-name" class="h5 mb-3 text-primary"></p>
                            <div class="table-responsive" style="max-height: 350px;">
                                <table class="table table-sm table-hover">
                                    <thead class="bg-light sticky-top"><tr><th style="width: 40px;"><input type="checkbox" id="check-all-asistencia"></th><th>Fecha</th><th>Actividad</th><th>Lugar</th><th>Estado</th><th>Tipo</th></tr></thead>
                                    <tbody id="asistencia-items"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer-custom border-top p-3 text-right">
                        <button id="btn-cancel-modal-asistencia" class="btn btn-secondary mr-2">Cerrar</button>
                        <button id="btn-confirm-asistencia" class="btn btn-primary" disabled>Agregar Seleccionadas (0)</button>
                    </div>
                </div>
            </div>

            <style>
                @media screen { .print-only { display: none !important; } }
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } .card { border: none !important; box-shadow: none !important; padding: 0 !important; } .print-header { display: block !important; } #input-observaciones { border: none !important; padding: 0 !important; resize: none !important; overflow: hidden !important; } body { background: white !important; } .table thead th { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact; } }
                .search-results-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; z-index: 1050; max-height: 200px; overflow-y: auto; border-radius: 0 0 8px 8px; }
                .search-result-item { padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.2s; }
                .search-result-item:hover { background-color: #e9ecef; }
                .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000; }
                .modal-content-custom { background: white; border-radius: 12px; width: 95%; max-width: 850px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
                .text-strikethrough { text-decoration: line-through; }
                .sticky-top { position: sticky; top: 0; background: #f8f9fa; z-index: 5; }
                .flex { display: flex; } .justify-between { justify-content: space-between; } .grid { display: grid; } .grid-2 { grid-template-columns: repeat(2, 1fr); } .gap-2 { gap: 0.5rem; }
            </style>
        `;

        await this.loadAbonos();
        await this.loadLugares();
        this.renderItems();
        this.attachEvents();
        this.updatePracticanteUI();
        this.calculate();
    }

    async loadAbonos() { try { const res = await apiClient.get('/tipos-abono'); this.tiposAbono = res.data || []; } catch (e) { console.error(e); } }
    async loadLugares() { try { const res = await apiClient.get('/lugares'); this.lugares = res.data || []; } catch (e) { console.error(e); } }

    renderItems() {
        const body = this.container.querySelector('#items-container');
        if (!body) return; body.innerHTML = '';
        this.state.items.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const hasDiscount = item.descuento > 0;
            tr.innerHTML = `
                <td class="p-2">
                    <div class="no-print">
                        <select class="form-control form-control-sm mb-1 select-abono" data-index="${idx}"><option value="">-- Carga rápida --</option>${this.tiposAbono.map(a => `<option value="${a.id}" ${item.abonoId == a.id ? 'selected' : ''}>${a.nombre} ($${a.precio})</option>`).join('')}</select>
                        <textarea class="form-control form-control-sm input-descripcion" data-index="${idx}" rows="2">${item.descripcion}</textarea>
                    </div>
                    <div class="print-only" style="white-space: pre-wrap;">${item.descripcion || '-'}</div>
                </td>
                <td class="text-center p-2 align-middle">
                    <input type="number" class="form-control form-control-sm text-center input-cantidad no-print" data-index="${idx}" value="${item.cantidad}" min="1">
                    <span class="print-only">${item.cantidad}</span>
                </td>
                <td class="text-right p-2 align-middle">
                    <input type="number" class="form-control form-control-sm text-right input-precio-base no-print" data-index="${idx}" value="${item.precioBase || item.precio}" step="100">
                    <div class="no-print text-strikethrough small text-muted" style="${hasDiscount ? 'display: block;' : 'display: none;'}">$${this.formatNumber(item.precioBase || item.precio)}</div>
                    <span class="print-only ${hasDiscount ? 'text-strikethrough small text-muted' : ''}" style="${hasDiscount ? 'display: block;' : ''}">$${this.formatNumber(item.precioBase || item.precio)}</span>
                </td>
                <td class="text-right p-2 align-middle">
                    <div class="no-print" style="display: flex; align-items: center; gap: 4px;">
                        <input type="number" class="form-control form-control-sm text-right input-descuento" data-index="${idx}" value="${item.descuento || 0}" min="0" max="100">
                        <span>%</span>
                    </div>
                    <span class="print-only">${item.descuento || 0}%</span>
                </td>
                <td class="text-right p-2 align-middle">
                    <input type="number" class="form-control form-control-sm text-right input-precio no-print" data-index="${idx}" value="${item.precio}" step="100">
                    <span class="print-only font-weight-bold" style="color: var(--success-color);">$${this.formatNumber(item.precio)}</span>
                </td>
                <td class="text-right p-2 align-middle font-weight-bold" style="${item.precio < 0 ? 'color: #dc3545;' : ''}">$${this.formatNumber(item.cantidad * item.precio)}</td>
                <td class="text-center p-2 no-print align-middle"><button class="btn btn-sm btn-link text-danger btn-remove-item" data-index="${idx}"><i class="fas fa-trash-alt"></i></button></td>
            `;
            body.appendChild(tr);
        });
        this.attachItemEvents();
    }

    attachItemEvents() {
        this.container.querySelectorAll('.select-abono').forEach(el => el.onchange = (e) => {
            const a = this.tiposAbono.find(x => x.id == e.target.value);
            if (a) {
                const idx = e.target.dataset.index;
                const p = parseFloat(a.precio);
                this.state.items[idx] = { ...this.state.items[idx], abonoId: a.id, descripcion: a.nombre, precioBase: p, precio: p, descuento: 0 };
                this.renderItems(); this.calculate();
            }
        });
        this.container.querySelectorAll('.input-descripcion').forEach(el => el.oninput = (e) => { 
            const idx = e.target.dataset.index; this.state.items[idx].descripcion = e.target.value; 
            const tr = e.target.closest('tr'); tr.querySelector('td:first-child .print-only').textContent = e.target.value;
            this.calculate(); 
        });
        this.container.querySelectorAll('.input-cantidad').forEach(el => el.oninput = (e) => { 
            const idx = e.target.dataset.index; this.state.items[idx].cantidad = parseInt(e.target.value) || 0; 
            this.calculate(); this.updateRowSubtotal(e.target);
        });
        this.container.querySelectorAll('.input-precio-base').forEach(el => el.oninput = (e) => {
            const idx = e.target.dataset.index;
            const item = this.state.items[idx];
            item.precioBase = parseFloat(e.target.value) || 0;
            // Update final price based on base and current discount
            item.precio = item.precioBase * (1 - (item.descuento / 100));
            this.calculate(); this.updateRowSubtotal(e.target);
        });
        this.container.querySelectorAll('.input-descuento').forEach(el => el.oninput = (e) => {
            const idx = e.target.dataset.index;
            const item = this.state.items[idx];
            item.descuento = parseFloat(e.target.value) || 0;
            // Update final price based on base and new discount
            item.precio = item.precioBase * (1 - (item.descuento / 100));
            this.calculate(); this.updateRowSubtotal(e.target);
        });
        this.container.querySelectorAll('.input-precio').forEach(el => el.oninput = (e) => { 
            const idx = e.target.dataset.index;
            const item = this.state.items[idx];
            item.precio = parseFloat(e.target.value) || 0; 
            // Update discount based on new final price and base price
            if (item.precioBase > 0) {
                item.descuento = Math.round((1 - (item.precio / item.precioBase)) * 100);
            }
            this.calculate(); this.updateRowSubtotal(e.target);
        });
        this.container.querySelectorAll('.btn-remove-item').forEach(el => el.onclick = (e) => { this.state.items.splice(e.currentTarget.dataset.index, 1); this.renderItems(); this.calculate(); });
    }

    updateRowSubtotal(input) {
        const row = input.closest('tr'); const idx = input.dataset.index; const item = this.state.items[idx];
        const hasDiscount = item.descuento > 0.01;
        const cantSpan = row.querySelector('td:nth-child(2) .print-only'); if (cantSpan) cantSpan.textContent = item.cantidad;
        
        const baseHint = row.querySelector('td:nth-child(3) .no-print.text-strikethrough');
        if (baseHint) {
            baseHint.textContent = `$${this.formatNumber(item.precioBase || item.precio)}`;
            baseHint.style.display = hasDiscount ? 'block' : 'none';
        }

        const baseSpan = row.querySelector('td:nth-child(3) .print-only'); 
        if (baseSpan) {
            baseSpan.textContent = `$${this.formatNumber(item.precioBase || item.precio)}`;
            if (hasDiscount) {
                baseSpan.classList.add('text-strikethrough', 'small', 'text-muted');
                baseSpan.style.display = 'block';
            } else {
                baseSpan.classList.remove('text-strikethrough', 'small', 'text-muted');
                baseSpan.style.display = '';
            }
        }

        const descSpan = row.querySelector('td:nth-child(4) .print-only'); if (descSpan) descSpan.textContent = `${item.descuento || 0}%`;
        
        const precioSpan = row.querySelector('td:nth-child(5) .print-only'); 
        if (precioSpan) {
            precioSpan.textContent = `$${this.formatNumber(item.precio)}`;
            precioSpan.style.color = hasDiscount ? 'var(--success-color)' : '';
        }
        
        // Sync inputs
        const precioBaseInput = row.querySelector('.input-precio-base');
        const descuentoInput = row.querySelector('.input-descuento');
        const precioInput = row.querySelector('.input-precio');
        
        if (precioBaseInput && input !== precioBaseInput) precioBaseInput.value = (item.precioBase || 0).toFixed(2);
        if (descuentoInput && input !== descuentoInput) descuentoInput.value = (item.descuento || 0);
        if (precioInput && input !== precioInput) precioInput.value = (item.precio || 0).toFixed(2);

        const subtotalEl = row.querySelectorAll('td')[5];
        subtotalEl.textContent = `$${this.formatNumber(item.cantidad * item.precio)}`;
        subtotalEl.style.color = item.precio < 0 ? '#dc3545' : '';
    }

    attachEvents() {
        const getEl = (id) => this.container.querySelector(`#${id}`);
        getEl('btn-add-item').onclick = () => { this.state.items.push({ id: Date.now(), descripcion: '', cantidad: 1, precioBase: 0, descuento: 0, precio: 0, abonoId: '' }); this.renderItems(); };
        getEl('btn-add-cuota-social').onclick = () => {
            const defaultSocialFee = this.lugares.find(l => l.costo_cuota_social > 0);
            const p = defaultSocialFee ? parseFloat(defaultSocialFee.costo_cuota_social) : 0;
            this.state.items.push({ id: Date.now(), descripcion: 'Cuota Social', cantidad: 1, precioBase: p, precio: p, descuento: 0, abonoId: '' });
            this.renderItems(); this.calculate();
        };
        getEl('btn-limpiar').onclick = () => { if (confirm('¿Limpiar todo?')) { 
            this.state = { ...this.state, id: null, cliente: '', practicanteId: null, items: [{ id: Date.now(), descripcion: '', cantidad: 1, precio: 0, abonoId: '' }], observaciones: '' };
            this.render(); 
        }};
        getEl('btn-guardar').onclick = () => this.savePresupuesto();
        getEl('btn-historial').onclick = () => this.openHistorialModal();
        getEl('btn-imprimir').onclick = () => { 
            const f = getEl('input-fecha').value; const c = getEl('input-cliente').value; 
            this.container.querySelector('#print-cliente-val').textContent = c; 
            this.container.querySelector('#print-fecha-val').textContent = this.formatDate(f); 
            this.container.querySelector('#print-fecha-display').textContent = this.formatDate(f); 
            window.print(); 
        };

        const inputCliente = getEl('input-cliente');
        inputCliente.oninput = async (e) => {
            this.state.cliente = e.target.value;
            if (this.state.practicanteId) { this.state.practicanteId = null; this.updatePracticanteUI(); }
            if (this.state.cliente.length >= 3) await this.searchPracticantesAutocompletar(this.state.cliente);
            else getEl('search-results').style.display = 'none';
        };

        getEl('input-observaciones').oninput = (e) => { this.state.observaciones = e.target.value; };
        getEl('btn-buscar-practicante').onclick = () => this.openPracticanteModal();
        getEl('btn-clear-practicante').onclick = () => { this.state.cliente = ''; this.state.practicanteId = null; inputCliente.value = ''; this.updatePracticanteUI(); };
        getEl('btn-importar-asistencia').onclick = () => { if (!this.state.practicanteId) { alert('Seleccione un practicante.'); return; } this.openAttendanceModal(); };

        // Modales events
        getEl('close-modal-historial').onclick = () => this.closeHistorialModal();
        getEl('btn-cancel-modal-historial').onclick = () => this.closeHistorialModal();
        getEl('search-historial').oninput = (e) => this.loadHistorialData(e.target.value);
        getEl('close-modal-practicante').onclick = () => this.closePracticanteModal();
        getEl('btn-cancel-modal-practicante').onclick = () => this.closePracticanteModal();
        getEl('btn-refresh-asistencia').onclick = () => this.loadAsistenciaData();
        getEl('close-modal-asistencia').onclick = () => this.closeAsistenciaModal();
        getEl('btn-cancel-modal-asistencia').onclick = () => this.closeAsistenciaModal();
        getEl('btn-confirm-asistencia').onclick = () => this.confirmAsistencia();
    }

    async savePresupuesto() {
        if (!this.state.cliente) { showError('El nombre es obligatorio'); return; }
        try {
            const total = this.state.items.reduce((s, i) => s + (i.cantidad * i.precio), 0);
            const payload = { practicante_id: this.state.practicanteId, cliente_nombre: this.state.cliente, fecha: this.state.fecha, total: total, observaciones: this.state.observaciones, items: this.state.items.filter(i => i.descripcion) };
            await apiClient.post('/presupuestos', payload);
            showSuccess('Guardado correctamente.');
        } catch (e) { displayApiError(e); }
    }

    async openHistorialModal() { this.container.querySelector('#modal-historial').style.display = 'flex'; await this.loadHistorialData(); }
    closeHistorialModal() { this.container.querySelector('#modal-historial').style.display = 'none'; }

    async loadHistorialData(q = '') {
        const body = this.container.querySelector('#historial-items');
        body.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i></td></tr>';
        try {
            const res = await apiClient.get('/presupuestos', { search: q });
            this.state.historial = res.data || [];
            if (this.state.historial.length === 0) { body.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay presupuestos.</td></tr>'; return; }
            body.innerHTML = this.state.historial.map(p => `
                <tr>
                    <td>${this.formatDate(p.fecha)}</td>
                    <td><strong>${p.cliente_nombre || p.practicante_nombre}</strong></td>
                    <td class="text-right">$${this.formatNumber(p.total)}</td>
                    <td class="text-right">
                        <button class="btn btn-sm btn-primary btn-load-p" data-id="${p.id}"><i class="fas fa-folder-open"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-p" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
            body.querySelectorAll('.btn-load-p').forEach(btn => btn.onclick = (e) => this.loadPresupuesto(e.currentTarget.dataset.id));
            body.querySelectorAll('.btn-delete-p').forEach(btn => btn.onclick = (e) => this.deletePresupuesto(e.currentTarget.dataset.id));
        } catch (e) { body.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Error.</td></tr>'; }
    }

    async loadPresupuesto(id) {
        try {
            const res = await apiClient.get(`/presupuestos/${id}`);
            const p = res.data;
            this.state = {
                ...this.state,
                id: p.id,
                cliente: p.cliente_nombre || p.practicante_nombre,
                practicanteId: p.practicante_id,
                fecha: (p.fecha && p.fecha.includes('T')) ? p.fecha.split('T')[0] : p.fecha,
                observaciones: p.observaciones || '',
                items: p.items.map(i => ({ 
                    id: i.id, 
                    descripcion: i.descripcion, 
                    cantidad: i.cantidad, 
                    precioBase: i.precio_base ? parseFloat(i.precio_base) : parseFloat(i.precio_unitario),
                    descuento: i.descuento ? parseFloat(i.descuento) : 0,
                    precio: parseFloat(i.precio_unitario), 
                    abonoId: i.abono_id 
                }))
            };
            this.render(); this.closeHistorialModal(); showSuccess('Presupuesto cargado.');
        } catch (e) { displayApiError(e); }
    }

    async deletePresupuesto(id) {
        if (!confirm('¿Eliminar este presupuesto del historial?')) return;
        try {
            await apiClient.delete(`/presupuestos/${id}`);
            await this.loadHistorialData();
            showSuccess('Eliminado.');
        } catch (e) { displayApiError(e); }
    }

    // Métodos auxiliares de practicantes y asistencia
    async searchPracticantesAutocompletar(q) { try { const res = await practicanteApi.getAll(q); const resBox = this.container.querySelector('#search-results'); if (res.data && res.data.length > 0) { resBox.innerHTML = res.data.map(p => `<div class="search-result-item" data-id="${p.id}" data-nombre="${p.nombre_completo}"><i class="fas fa-user-circle mr-2"></i> ${p.nombre_completo}</div>`).join(''); resBox.style.display = 'block'; resBox.querySelectorAll('.search-result-item').forEach(x => x.onclick = () => { this.state.cliente = x.dataset.nombre; this.state.practicanteId = parseInt(x.dataset.id); this.container.querySelector('#input-cliente').value = this.state.cliente; resBox.style.display = 'none'; this.updatePracticanteUI(); }); } else resBox.style.display = 'none'; } catch (e) { console.error(e); } }
    updatePracticanteUI() { const isSel = !!this.state.practicanteId; this.container.querySelector('#badge-registrado').style.display = isSel ? 'inline-block' : 'none'; this.container.querySelector('#btn-clear-practicante').style.display = isSel ? 'block' : 'none'; const b = this.container.querySelector('#btn-importar-asistencia'); if (isSel) { b.classList.replace('btn-outline-primary', 'btn-primary'); } else { b.classList.replace('btn-primary', 'btn-outline-primary'); } }
    async openPracticanteModal() { this.container.querySelector('#modal-select-practicante').style.display = 'flex'; await this.loadPracticantesModal(); }
    async loadPracticantesModal(q = '') { const body = this.container.querySelector('#practicantes-modal-list'); body.innerHTML = '<tr><td colspan="3" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i></td></tr>'; try { const res = await practicanteApi.getAll(q); const list = res.data || []; body.innerHTML = list.map(p => `<tr><td class="align-middle"><strong>${p.nombre_completo}</strong></td><td class="align-middle small">${p.dni || '-'}</td><td class="text-right"><button class="btn btn-sm btn-primary btn-select-p" data-id="${p.id}" data-nombre="${p.nombre_completo}">Seleccionar</button></td></tr>`).join(''); body.querySelectorAll('.btn-select-p').forEach(x => x.onclick = () => { this.state.cliente = x.dataset.nombre; this.state.practicanteId = parseInt(x.dataset.id); this.container.querySelector('#input-cliente').value = this.state.cliente; this.updatePracticanteUI(); this.closePracticanteModal(); }); } catch (e) { body.innerHTML = '<tr><td colspan="3">Error.</td></tr>'; } }
    closePracticanteModal() { this.container.querySelector('#modal-select-practicante').style.display = 'none'; }
    async openAttendanceModal() { this.container.querySelector('#modal-asistencia').style.display = 'flex'; this.container.querySelector('#asistencia-practicante-name').textContent = this.state.cliente; this.state.selectedAsistenciaIds.clear(); this.updateConfirmButton(); await this.loadAsistenciaData(); }
    async loadAsistenciaData() { const body = this.container.querySelector('#asistencia-items'); body.innerHTML = '<tr><td colspan="6" class="text-center py-5"><i class="fas fa-spinner fa-spin"></i></td></tr>'; try { const p = { fecha_inicio: this.container.querySelector('#modal-filter-desde').value, fecha_fin: this.container.querySelector('#modal-filter-hasta').value, tipo: this.container.querySelector('#modal-filter-tipo').value }; const res = await apiClient.get(`/asistencia/practicante/${this.state.practicanteId}`, p); this.state.asistencia = res.data || []; this.renderAsistenciaItems(); } catch (e) { body.innerHTML = '<tr><td colspan="6">Error.</td></tr>'; } }
    renderAsistenciaItems() {
        const body = this.container.querySelector('#asistencia-items');
        const filt = this.state.asistencia.filter(a => 
            (a.clase_estado === 'programada' && !a.pago_espacio_realizado) || 
            ((a.clase_estado === 'cancelada' || a.clase_estado === 'suspendida') && a.pago_espacio_realizado)
        );

        if (filt.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center py-5">No hay clases.</td></tr>';
            return;
        }

        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        body.innerHTML = filt.map(a => {
            const fechaLimpia = (typeof a.fecha === 'string' && a.fecha.includes('T')) ? a.fecha.split('T')[0] : a.fecha;
            const [y, m, d] = fechaLimpia.split('-');
            const fechaObj = new Date(y, m - 1, d);
            const nombreDia = diasSemana[fechaObj.getDay()];
            const esCred = a.clase_estado !== 'programada';
            
            const hasNC = a.nota_credito_practicante_id !== null && a.nota_credito_practicante_id !== undefined;
            const badgeNC = hasNC ? `<span class="badge badge-success ml-1" title="Se generó una nota de crédito por $${a.nota_credito_practicante_monto}"><i class="fas fa-check"></i> NC</span>` : '';

            return `
                <tr class="${esCred ? 'table-warning' : ''}">
                    <td class="text-center align-middle">
                        <input type="checkbox" class="check-asistencia" data-id="${a.clase_id}" ${this.state.selectedAsistenciaIds.has(a.clase_id) ? 'checked' : ''}>
                    </td>
                    <td class="align-middle">
                        <div class="font-weight-bold">${nombreDia} ${d}/${m}/${y}</div>
                        <div class="small text-muted"><i class="far fa-clock mr-1"></i>${a.hora.substring(0, 5)} hs</div>
                    </td>
                    <td class="align-middle">
                        ${a.actividad_nombre} ${!a.ya_anotado ? '<span class="badge badge-light border ml-1">No anotado</span>' : ''}
                    </td>
                    <td class="align-middle small">${a.lugar_nombre}</td>
                    <td class="align-middle text-center">
                        <span class="badge ${esCred ? 'badge-danger' : 'badge-primary'}">${esCred ? 'CRÉDITO' : 'Programada'}</span>
                        ${esCred ? badgeNC : ''}
                    </td>
                    <td class="align-middle">
                        <span class="badge ${a.clase_tipo === 'flexible' ? 'badge-info' : 'badge-secondary'}">
                            ${a.clase_tipo === 'flexible' ? 'Particular' : 'Grupal'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        body.querySelectorAll('.check-asistencia').forEach(x => x.onchange = (e) => {
            const id = parseInt(x.dataset.id);
            if (e.target.checked) this.state.selectedAsistenciaIds.add(id);
            else this.state.selectedAsistenciaIds.delete(id);
            this.updateConfirmButton();
        });
    }
    updateConfirmButton() { const b = this.container.querySelector('#btn-confirm-asistencia'); b.disabled = this.state.selectedAsistenciaIds.size === 0; b.textContent = `Agregar Seleccionadas (${this.state.selectedAsistenciaIds.size})`; }
    closeAsistenciaModal() { this.container.querySelector('#modal-asistencia').style.display = 'none'; }
    confirmAsistencia() { const sel = this.state.asistencia.filter(a => this.state.selectedAsistenciaIds.has(a.clase_id)); const groups = {}; sel.forEach(a => { const isCred = a.clase_estado !== 'programada'; const k = `${a.actividad_nombre} (${a.lugar_nombre})${isCred ? ' [CRÉDITO]' : ''}`; if (!groups[k]) groups[k] = { count: 0, dates: [], totalRef: 0, obs: [], isCred }; groups[k].count++; groups[k].dates.push(this.formatDateShort(a.fecha)); if (a.monto_referencia_espacio) groups[k].totalRef += parseFloat(a.monto_referencia_espacio); if (a.clase_observaciones) groups[k].obs.push(a.clase_observaciones); }); if (this.state.items.length === 1 && !this.state.items[0].descripcion && this.state.items[0].precio === 0) this.state.items = []; Object.keys(groups).forEach(k => { const g = groups[k]; let desc = `${k}\nSesiones: ${g.dates.join(', ')}`; if (g.obs.length > 0) desc += `\nNotas: ${[...new Set(g.obs)].join('; ')}`; const precioSugerido = g.isCred ? -(g.totalRef / g.count) : (g.totalRef / g.count); this.state.items.push({ id: Date.now() + Math.random(), descripcion: desc, cantidad: g.count, precioBase: Math.abs(precioSugerido || 0), descuento: 0, precio: precioSugerido || 0, abonoId: '' }); }); this.renderItems(); this.calculate(); this.closeAsistenciaModal(); showSuccess('Importado.'); }
    calculate() { 
        const totalConDesc = this.state.items.reduce((s, i) => s + (i.cantidad * i.precio), 0);
        const totalSinDesc = this.state.items.reduce((s, i) => s + (i.cantidad * (i.precioBase || i.precio)), 0);
        const ahorro = totalSinDesc - totalConDesc;

        const rowSinDesc = this.container.querySelector('#row-total-sin-descuento');
        const rowAhorro = this.container.querySelector('#row-ahorro');
        
        if (ahorro > 0.01) {
            rowSinDesc.style.display = 'table-row';
            rowAhorro.style.display = 'table-row';
            this.container.querySelector('#total-sin-descuento').textContent = `$${this.formatNumber(totalSinDesc)}`;
            this.container.querySelector('#total-ahorro').textContent = `-$${this.formatNumber(ahorro)}`;
        } else {
            rowSinDesc.style.display = 'none';
            rowAhorro.style.display = 'none';
        }

        this.container.querySelector('#total-presupuesto').textContent = `$${this.formatNumber(totalConDesc)}`; 
    }
    formatNumber(n) { return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    formatDate(d) { if (!d) return ''; const s = (typeof d === 'string' && d.includes('T')) ? d.split('T')[0] : d; const [y, m, day] = s.split('-'); return `${day}/${m}/${y}`; }
    formatDateShort(d) { if (!d) return ''; const s = (typeof d === 'string' && d.includes('T')) ? d.split('T')[0] : d; const [y, m, day] = s.split('-'); return `${day}/${m}`; }
}

export default PresupuestosPage;
