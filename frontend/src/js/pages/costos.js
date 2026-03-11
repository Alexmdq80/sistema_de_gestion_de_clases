import { apiClient } from '../api/client.js';
import { displayApiError, showSuccess } from '../utils/errors.js';
import { formatDate, formatTime, formatDateDashes } from '../utils/formatting.js';

export class CostosPage {
    constructor(container) {
        this.container = container;
        
        const today = new Date();
        this.selectedMonth = today.getMonth();
        this.selectedYear = today.getFullYear();
        
        this.clases = [];
        this.movimientos = [];
        this.categorias = [];
        this.filters = {};
        this.updateFiltersFromMonthYear();
    }

    updateFiltersFromMonthYear() {
        let firstDay, lastDay;
        const currentLugarId = this.filters.lugar_id;

        if (this.selectedMonth === 'all') {
            // Rango de todo el año
            firstDay = new Date(this.selectedYear, 0, 1);
            lastDay = new Date(this.selectedYear, 11, 31, 23, 59, 59);
        } else {
            // Rango del mes específico
            firstDay = new Date(this.selectedYear, this.selectedMonth, 1);
            lastDay = new Date(this.selectedYear, parseInt(this.selectedMonth) + 1, 0);
        }
        
        const formatDateStr = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        this.filters = {
            fecha_inicio: formatDateStr(firstDay),
            fecha_fin: formatDateStr(lastDay),
            lugar_id: currentLugarId
        };
    }

    async render() {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        this.container.innerHTML = `
            <div class="page-header">
                <h1>Flujo de Caja</h1>
            </div>

            <div class="filters-bar mb-4 p-3 bg-light border rounded">
                <div class="form-row align-items-center">
                    <div class="form-group col-md-3 mb-md-0">
                        <select class="form-control" id="costo-month" title="Seleccionar Mes">
                            <option value="all" ${this.selectedMonth === 'all' ? 'selected' : ''}>Todos los meses</option>
                            ${months.map((m, i) => `<option value="${i}" ${this.selectedMonth === i ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group col-md-2 mb-md-0">
                        <input type="number" class="form-control" id="costo-year" value="${this.selectedYear}" placeholder="Año">
                    </div>
                    <div class="form-group col-md-3 mb-md-0">
                        <select class="form-control" id="costo-lugar" title="Sede / Club">
                            <option value="">Todas las Sedes</option>
                            <!-- Populated dynamically -->
                        </select>
                    </div>
                    <div class="form-group col-md-2 mb-md-0">
                        <button id="costo-filter-btn" class="btn btn-primary btn-block">
                            Aplicar Filtro
                        </button>
                    </div>
                    <div class="form-group col-md-2 mb-md-0">
                        <button id="add-movimiento-btn" class="btn btn-success btn-block" title="Nuevo Movimiento">
                            <i class="fas fa-plus"></i> + Movimiento
                        </button>
                    </div>
                </div>
                <div class="form-row mt-2">
                    <div class="col-md-10">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="filter-by-mes-abono-caja" ${this.filterByMesAbono ? 'checked' : ''}>
                            <label class="form-check-label small text-muted" for="filter-by-mes-abono-caja">
                                <i class="fas fa-info-circle"></i> Usar <strong>Mes de Abono</strong> para filtrar ingresos (en lugar de fecha de cobro real)
                            </label>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <button id="manage-cats-btn" class="btn btn-outline-info btn-sm btn-block" title="Configurar Categorías">
                            <i class="fas fa-cog"></i> Categorías
                        </button>
                    </div>
                </div>
            </div>

            <div id="costos-summary" class="mb-4"></div>

            <div id="costos-content">
                <div class="loader text-center p-5">Cargando datos...</div>
            </div>

            <!-- Modal para Movimiento de Caja -->
            <div id="movimiento-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Nuevo Movimiento de Caja</h2>
                        <span class="close-movimiento-modal close-button">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="movimiento-form">
                            <div class="form-group">
                                <label for="mov-tipo">Tipo de Movimiento:</label>
                                <select id="mov-tipo" class="form-control" required>
                                    <option value="ingreso">Ingreso (Entrada de dinero)</option>
                                    <option value="egreso">Egreso (Gasto/Salida de dinero)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="mov-lugar">Sede / Lugar:</label>
                                <select id="mov-lugar" class="form-control">
                                    <option value="">Global / Sin Sede</option>
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="mov-categoria">Categoría:</label>
                                <select id="mov-categoria" class="form-control" required>
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="mov-monto">Importe ($):</label>
                                <input type="number" id="mov-monto" class="form-control" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label for="mov-fecha">Fecha:</label>
                                <input type="date" id="mov-fecha" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="mov-descripcion">Descripción / Notas:</label>
                                <textarea id="mov-descripcion" class="form-control" rows="2" placeholder="Ej: Venta remera talle L"></textarea>
                            </div>
                            <div class="form-actions mt-4">
                                <button type="submit" class="btn btn-success">Guardar Movimiento</button>
                                <button type="button" class="btn btn-secondary cancel-movimiento-modal">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Modal para fecha de pago -->
            <div id="pago-fecha-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Registrar Fecha de Pago</h2>
                        <span class="close-pago-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="pago-fecha-form">
                            <input type="hidden" id="pago-clase-id">
                            <div class="form-group">
                                <label for="input-fecha-pago">Fecha en que se realizó el pago:</label>
                                <input type="date" id="input-fecha-pago" class="form-control" required>
                            </div>

                            <div class="form-group bg-light p-2 border rounded mb-3">
                                <label for="input-monto-referencia" class="text-muted mb-0">Costo Estándar (Referencia para esta sesión):</label>
                                <input type="number" id="input-monto-referencia" class="form-control" step="0.01">
                                <small class="text-muted">Calculado automáticamente, pero puede ajustarlo si el club cambió la tarifa base hoy.</small>
                            </div>

                            <div class="form-group">
                                <label for="input-monto-pago" class="font-weight-bold text-primary">Importe Final Pagado ($):</label>
                                <input type="number" id="input-monto-pago" class="form-control form-control-lg border-primary" step="0.01" required>
                                <small class="text-info">Puede modificar este monto en caso de descuentos o bonificaciones.</small>
                            </div>

                            <div id="charge-options-section" class="mt-4 p-3 bg-light border rounded" style="display: none;">
                               <h4>Opciones de Cobro</h4>
                               <div class="form-check mb-2">
                                   <input class="form-check-input" type="checkbox" id="charge-salon-cost">
                                   <label class="form-check-label" for="charge-salon-cost">
                                       Cargar costo del salón a los practicantes
                                   </label>
                               </div>
                               <div id="practicantes-to-charge-section" style="display: none;">
                                   <p class="small text-muted mb-2">Seleccione a quién(es) cargar el costo:</p>
                                   <div id="reserved-practicantes-list" class="pl-4">
                                       <!-- Practitioners will be loaded here -->
                                   </div>
                               </div>
                            </div>
                            <div class="form-actions mt-4">
                                <button type="submit" class="btn btn-success">Confirmar Pago</button>
                                <button type="button" class="btn btn-secondary cancel-pago-modal">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Modal para Categorías de Caja -->
            <div id="categoria-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Configurar Categorías</h2>
                        <span class="close-categoria-modal close-button">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="add-categoria-form" class="mb-4">
                            <div class="input-group">
                                <input type="text" id="new-cat-nombre" class="form-control" placeholder="Nueva categoría..." required>
                                <div class="input-group-append">
                                    <button type="submit" class="btn btn-primary">Añadir</button>
                                </div>
                            </div>
                        </form>
                        <ul id="categorias-list" class="list-group">
                            <!-- Populated dynamically -->
                        </ul>
                    </div>
                </div>
            </div>
        `;

        this.attachEvents();
        await this.loadInitialData();
        await this.loadData();
    }

    async loadInitialData() {
        try {
            const res = await apiClient.get('/lugares');
            // Show only parent places
            this.lugares = (res.data || []).filter(l => !l.parent_id);
            
            const filterLugar = this.container.querySelector('#costo-lugar');
            if (filterLugar) {
                filterLugar.innerHTML = '<option value="">Todas las Sedes</option>' + 
                    this.lugares.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
            }

            const modalLugar = this.container.querySelector('#mov-lugar');
            if (modalLugar) {
                modalLugar.innerHTML = '<option value="">Global / Sin Sede</option>' + 
                    this.lugares.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
            }
        } catch (error) { console.error(error); }
    }

    attachEvents() {
        this.container.querySelector('#costo-filter-btn').onclick = () => {
            const monthVal = this.container.querySelector('#costo-month').value;
            this.selectedMonth = monthVal === 'all' ? 'all' : parseInt(monthVal, 10);
            this.selectedYear = parseInt(this.container.querySelector('#costo-year').value, 10);
            this.filterByMesAbono = this.container.querySelector('#filter-by-mes-abono-caja').checked;
            
            const lugarId = this.container.querySelector('#costo-lugar').value;
            this.filters.lugar_id = lugarId || undefined;

            this.updateFiltersFromMonthYear();
            this.loadData();
        };

        // Movimiento Caja Modal
        const movModal = this.container.querySelector('#movimiento-modal');
        const movCatSelect = movModal.querySelector('#mov-categoria');

this.container.querySelector('#add-movimiento-btn').onclick = () => {
    // Populate categories dynamically
    movCatSelect.innerHTML = this.categorias.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    if (this.categorias.length === 0) movCatSelect.innerHTML = '<option value="General">General</option>';

    movModal.querySelector('#movimiento-form').reset();
    movModal.querySelector('#mov-fecha').value = new Date().toISOString().split('T')[0];
    movModal.style.display = 'block';
};

this.container.querySelector('.close-movimiento-modal').onclick = () => movModal.style.display = 'none';
this.container.querySelector('.cancel-movimiento-modal').onclick = () => movModal.style.display = 'none';

// Categorias Modal
const catModal = this.container.querySelector('#categoria-modal');
const catsList = catModal.querySelector('#categorias-list');

this.container.querySelector('#manage-cats-btn').onclick = () => {
    this.renderCategoriesList(catsList);
    catModal.style.display = 'block';
};

this.container.querySelector('.close-categoria-modal').onclick = () => catModal.style.display = 'none';

this.container.querySelector('#add-categoria-form').onsubmit = async (e) => {
    e.preventDefault();
    const nombre = this.container.querySelector('#new-cat-nombre').value;
    try {
        await apiClient.post('/categorias-caja', { nombre });
        this.container.querySelector('#new-cat-nombre').value = '';
        // Reload categories
        const res = await apiClient.get('/categorias-caja');        this.categorias = res.data;
        this.renderCategoriesList(catsList);
    } catch (error) { displayApiError(error); }
};

this.container.querySelector('#movimiento-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        tipo: movModal.querySelector('#mov-tipo').value,
        lugar_id: movModal.querySelector('#mov-lugar').value || null,
        categoria: movModal.querySelector('#mov-categoria').value,
        monto: parseFloat(movModal.querySelector('#mov-monto').value),
        fecha: movModal.querySelector('#mov-fecha').value,
        descripcion: movModal.querySelector('#mov-descripcion').value
    };

    try {
        await apiClient.post('/caja', data);
        showSuccess('Movimiento registrado');
        movModal.style.display = 'none';
        await this.loadData();
    } catch (error) { displayApiError(error); }
};

// Pago Modal events (ya existentes)
const modal = this.container.querySelector('#pago-fecha-modal');
const chargeSalonCheckbox = this.container.querySelector('#charge-salon-cost');
        const practicantesSection = this.container.querySelector('#practicantes-to-charge-section');

        chargeSalonCheckbox.onchange = () => {
            practicantesSection.style.display = chargeSalonCheckbox.checked ? 'block' : 'none';
        };

        this.container.querySelector('.close-pago-modal').onclick = () => modal.style.display = 'none';
        this.container.querySelector('.cancel-pago-modal').onclick = () => modal.style.display = 'none';
        
        const montoRefInput = this.container.querySelector('#input-monto-referencia');
        const montoPagoInput = this.container.querySelector('#input-monto-pago');

        montoRefInput.oninput = () => {
            montoPagoInput.value = montoRefInput.value;
        };

        this.container.querySelector('#pago-fecha-form').onsubmit = async (e) => {
            e.preventDefault();
            const id = parseInt(this.container.querySelector('#pago-clase-id').value, 10);
            const fecha = this.container.querySelector('#input-fecha-pago').value;
            const monto = parseFloat(montoPagoInput.value);
            const montoRef = parseFloat(montoRefInput.value);
            
            const chargeOptions = {
                cobrar_salon: chargeSalonCheckbox.checked,
                practicantes_ids: Array.from(this.container.querySelectorAll('.practicante-charge-checkbox:checked'))
                    .map(cb => parseInt(cb.value, 10)),
                monto_pago_espacio: monto,
                monto_referencia_espacio: montoRef
            };

            await this.submitPayment(id, true, fecha, chargeOptions);
            modal.style.display = 'none';
        };

        window.onclick = (event) => {
            if (event.target == modal) modal.style.display = 'none';
        };
    }

    async loadData() {
        const content = this.container.querySelector('#costos-content');
        try {
            // Parámetros para pagos: si filtramos por mes de abono, usamos mes/año. Si no, rango de fechas.
            const pagosParams = { 
                filter_by_mes_abono: this.filterByMesAbono || false
            };

            if (this.filterByMesAbono) {
                if (this.selectedMonth !== 'all') {
                    pagosParams.mes = this.selectedMonth + 1; // Backend espera 1-12
                }
                pagosParams.anio = this.selectedYear;
            } else {
                pagosParams.fecha_inicio = this.filters.fecha_inicio;
                pagosParams.fecha_fin = this.filters.fecha_fin;
            }

            const results = await Promise.allSettled([
                apiClient.get('/asistencia/clases', this.filters),
                apiClient.get('/caja', this.filters),
                apiClient.get('/categorias-caja'),
                apiClient.get('/pagos', pagosParams)
            ]);
            
            this.clases = results[0].status === 'fulfilled' ? results[0].value.data : [];
            this.movimientos = results[1].status === 'fulfilled' ? results[1].value.data : [];
            this.categorias = results[2].status === 'fulfilled' ? (results[2].value.data || []) : [];
            this.pagosAbonos = results[3].status === 'fulfilled' ? results[3].value.data : [];
            
            if (results.some(r => r.status === 'rejected')) {
                console.error('Some requests failed:', results.filter(r => r.status === 'rejected'));
            }

            this.renderList(content);
            this.renderSummary();
        } catch (error) {
            console.error('Error loading data:', error);
            displayApiError(error, content);
        }
    }

    // Obtiene lo que el club espera recibir (Costo Estándar/Referencia)
    getExpectedCost(clase) {
        if (clase.monto_referencia_espacio !== null) {
            return parseFloat(clase.monto_referencia_espacio);
        }
        // Cálculo teórico si no hay referencia manual
        if (clase.tipo_tarifa === 'por_clase') {
            return parseFloat(clase.costo_tarifa);
        } else {
            const start = new Date(`2000-01-01T${clase.hora}`);
            const end = new Date(`2000-01-01T${clase.hora_fin}`);
            const diffHours = (end - start) / (1000 * 60 * 60);
            return parseFloat(clase.costo_tarifa) * diffHours;
        }
    }

    // Obtiene lo que realmente se pagó
    getPaidAmount(clase) {
        if (clase.pago_espacio_realizado && clase.monto_pago_espacio !== null) {
            return parseFloat(clase.monto_pago_espacio);
        }
        return 0;
    }

    renderCategoriesList(container) {
        container.innerHTML = this.categorias.map(c => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${c.nombre}
                <button class="btn btn-sm btn-outline-danger delete-cat-btn" data-id="${c.id}">Eliminar</button>
            </li>
        `).join('') || '<li class="list-group-item text-center text-muted">No hay categorías configuradas</li>';

        container.querySelectorAll('.delete-cat-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('¿Desea eliminar esta categoría?')) {
                    try {
                        await apiClient.delete(`/categorias-caja/${btn.dataset.id}`);
                        const res = await apiClient.get('/categorias-caja');
                        this.categorias = res.data;
                        this.renderCategoriesList(container);
                    } catch (error) { displayApiError(error); }
                }
            };
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderSummary() {
        const summaryDiv = this.container.querySelector('#costos-summary');
        
        // Clases (Egresos al club)
        const totalPaidClases = this.clases.reduce((acc, c) => acc + this.getPaidAmount(c), 0);
        const totalExpectedClases = this.clases.reduce((acc, c) => acc + this.getExpectedCost(c), 0);
        
        // Ingresos por Abonos (Cobros reales a practicantes)
        const totalIngresosAbonos = (this.pagosAbonos || [])
            .filter(p => p.pago_tipo === 'ingreso' && p.categoria)
            .reduce((acc, p) => acc + (parseFloat(p.monto) - (p.pago_socio_id ? 8000 : 0)), 0); // Assuming 8000 if linked, but better use real logic

        // Let's use a more precise classification for the summary
        let sumIngresosAbonos = 0;
        let sumIngresosCuotas = 0;
        let sumEgresosClub = totalPaidClases; // Classes already calculated
        let sumEgresosCuotas = 0;

        (this.pagosAbonos || []).forEach(p => {
            const monto = Math.abs(parseFloat(p.monto));
            if (p.pago_tipo === 'ingreso') {
                if (p.tipo_abono_nombre === 'Recepción Cuota Social' || !p.categoria) {
                    sumIngresosCuotas += monto;
                } else {
                    // It's a class subscription. If it has a linked social fee, we should ideally split it.
                    // Based on our backend logic, p.monto in "ingreso" includes the social fee.
                    // For now, let's keep it simple: if it's an abono, it's abono income.
                    sumIngresosAbonos += monto;
                }
            } else if (p.pago_tipo === 'egreso' && p.tipo_abono_nombre === 'Egreso Cuota Social (Club)') {
                sumEgresosCuotas += monto;
            }
        });

        // Caja Extra
        const totalIngresosExtra = this.movimientos.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
        const totalEgresosExtra = this.movimientos.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);

        // Balance Final de Utilidad
        const totalIngresos = sumIngresosAbonos + sumIngresosCuotas + totalIngresosExtra;
        const totalEgresos = totalEgresosExtra + sumEgresosClub + sumEgresosCuotas;
        const utilidadNeta = totalIngresos - totalEgresos;
        
        const ahorroNegociacion = totalExpectedClases - totalPaidClases;

        // Cálculo de Horas (Solo realizadas o programadas, no canceladas/suspendidas)
        const totalHoras = this.clases
            .filter(c => !['cancelada', 'suspendida'].includes(c.estado))
            .reduce((acc, c) => {
                const start = new Date(`2000-01-01T${c.hora}`);
                const end = new Date(`2000-01-01T${c.hora_fin}`);
                return acc + (end - start) / (1000 * 60 * 60);
            }, 0);
        
        const gananciaPorHora = totalHoras > 0 ? utilidadNeta / totalHoras : 0;

        summaryDiv.innerHTML = `
            <div class="grid grid-5 gap-4">
                <div class="card bg-success text-white p-3">
                    <div class="text-center">
                        <h4>Total Ingresos</h4>
                        <h2 class="mb-2">$${totalIngresos.toFixed(2)}</h2>
                    </div>
                    <div class="border-top pt-2 mt-2 small">
                        <div class="flex justify-between">
                            <span>Abonos Clases:</span>
                            <strong>$${sumIngresosAbonos.toFixed(2)}</strong>
                        </div>
                        <div class="flex justify-between">
                            <span>Cuotas Recibidas:</span>
                            <strong>$${sumIngresosCuotas.toFixed(2)}</strong>
                        </div>
                        <div class="flex justify-between">
                            <span>Ingresos Extra:</span>
                            <strong>$${totalIngresosExtra.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
                <div class="card bg-danger text-white p-3 text-center flex flex-col justify-center">
                    <h4>Total Egresos</h4>
                    <h2 class="mb-0">$${totalEgresos.toFixed(2)}</h2>
                    <small>Gastos: $${(totalEgresosExtra + sumEgresosCuotas).toFixed(2)} + Club: $${sumEgresosClub.toFixed(2)}</small>
                </div>
                <div class="card ${utilidadNeta >= 0 ? 'bg-primary' : 'bg-warning'} text-white p-3 text-center flex flex-col justify-center">
                    <h4>Utilidad Neta</h4>
                    <h2 class="mb-0">$${utilidadNeta.toFixed(2)}</h2>
                    <small>${utilidadNeta >= 0 ? 'Ganancia real del mes' : 'Déficit del mes'}</small>
                </div>
                <div class="card bg-info text-white p-3 text-center flex flex-col justify-center">
                    <p class="mb-1 text-uppercase small" style="opacity: 0.8;">Rentabilidad</p>
                    <h4 class="mb-1">$/Hora Neta</h4>
                    <h2 class="mb-0">$${gananciaPorHora.toFixed(2)}</h2>
                    <small>${totalHoras.toFixed(1)} hs de clase</small>
                </div>
                <div class="card bg-secondary text-white p-3 text-center flex flex-col justify-center">
                    <h4>Ahorro Alquiler</h4>
                    <h2 class="mb-0">$${ahorroNegociacion.toFixed(2)}</h2>
                    <small>Bonificaciones del Club</small>
                </div>
            </div>
        `;
    }

    renderList(content) {
        if (this.clases.length === 0 && this.movimientos.length === 0) {
            content.innerHTML = '<p class="text-center p-5 text-muted">No hay actividad registrada en este periodo.</p>';
            return;
        }

        content.innerHTML = `
            <div class="costos-section mb-5">
                <h3>Resumen de Alquiler de Espacio (Club)</h3>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Lugar</th>
                                <th>Esperado</th>
                                <th>Pagado</th>
                                <th>Diferencia</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.clases.map(c => {
                                const expected = this.getExpectedCost(c);
                                const paid = this.getPaidAmount(c);
                                const diff = expected - paid;
                                
                                const dateStr = formatDateDashes(c.fecha);
                                // Ensure we have YYYY-MM-DD for reliable splitting
                                const isoDate = formatDate(c.fecha);
                                const [year, month, day] = isoDate.split('-');
                                const dateObj = new Date(year, month - 1, day);
                                const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                                const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

                                const isCancelled = c.estado === 'cancelada';
                                const isSuspended = c.estado === 'suspendida';
                                
                                let estadoBadge = '';
                                if (c.pago_espacio_realizado) {
                                    estadoBadge = `<span class="badge badge-success" title="Pagado el ${formatDateDashes(c.fecha_pago_espacio)}">PAGADA</span>`;
                                } else {
                                    estadoBadge = '<span class="badge badge-warning">PENDIENTE</span>';
                                }

                                return `
                                <tr class="${isCancelled || isSuspended ? 'table-light text-muted' : ''}">
                                    <td>
                                        <div class="flex flex-col">
                                            <strong>${capitalizedDay} ${formatDateDashes(c.fecha)}</strong>
                                            <small class="text-muted">${c.hora.substring(0, 5)} hs</small>
                                        </div>
                                    </td>
                                    <td>${c.lugar_nombre}</td>
                                    <td>$${expected.toFixed(2)}</td>
                                    <td class="${c.pago_espacio_realizado ? 'text-success font-weight-bold' : 'text-muted'}">
                                        $${paid.toFixed(2)}
                                    </td>
                                    <td class="${diff > 0 ? 'text-info' : (diff < 0 ? 'text-danger' : 'text-muted')}">
                                        ${c.pago_espacio_realizado ? (diff > 0 ? `-$${diff.toFixed(2)}` : (diff < 0 ? `+$${Math.abs(diff).toFixed(2)}` : '-')) : '-'}
                                    </td>
                                    <td>${estadoBadge}</td>
                                    <td>
                                        ${!c.pago_espacio_realizado ? `
                                            <button class="btn btn-sm btn-success mark-paid-btn" data-id="${c.id}">Pagar</button>
                                        ` : `
                                            <div class="btn-group">
                                                <button class="btn btn-sm btn-outline-primary edit-payment-btn" data-id="${c.id}">Editar</button>
                                                <button class="btn btn-sm btn-outline-secondary unmark-paid-btn" data-id="${c.id}">X</button>
                                            </div>
                                        `}
                                    </td>
                                </tr>
                            `;}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="abonos-section mb-5">
                <h3>Ingresos por Abonos de Practicantes</h3>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Fecha Cobro</th>
                                <th>Practicante</th>
                                <th>Concepto / Mes</th>
                                <th>Sede</th>
                                <th>Método</th>
                                <th class="text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(this.pagosAbonos || [])
                                .filter(p => p.pago_tipo && p.pago_tipo.toLowerCase() === 'ingreso')
                                .map(p => `
                                <tr>
                                    <td>${formatDateDashes(p.fecha)}</td>
                                    <td><strong>${this.escapeHtml(p.practicante_nombre)}</strong></td>
                                    <td>${this.escapeHtml(p.tipo_abono_nombre || 'Cuota Social')} <small class="text-muted">(${p.mes_abono})</small></td>
                                    <td><small>${this.escapeHtml(p.lugar_nombre || '-')}</small></td>
                                    <td>${p.metodo_pago || '-'}</td>
                                    <td class="text-right text-success font-weight-bold">$${parseFloat(p.monto).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            ${this.pagosAbonos.length === 0 ? '<tr><td colspan="6" class="text-center text-muted">No hay cobros de abonos en este periodo.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="caja-section mb-5">
                <h3>Otros Movimientos de Caja (Ventas, Gastos, etc.)</h3>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Categoría</th>
                                <th>Descripción</th>
                                <th>Monto</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.movimientos.map(m => `
                                <tr>
                                    <td>${formatDateDashes(m.fecha)}</td>
                                    <td><span class="badge ${m.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}">${m.tipo.toUpperCase()}</span></td>
                                    <td>${m.categoria}</td>
                                    <td><small>${m.descripcion || '-'}</small></td>
                                    <td class="${m.tipo === 'ingreso' ? 'text-success' : 'text-danger'}"><strong>$${m.monto.toFixed(2)}</strong></td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-danger delete-mov-btn" data-id="${m.id}">Eliminar</button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${this.movimientos.length === 0 ? '<tr><td colspan="6" class="text-center text-muted">No hay movimientos extra en este periodo.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Eventos Clases (ya existentes)
        content.querySelectorAll('.mark-paid-btn').forEach(btn => btn.onclick = () => this.handleMarkPaid(parseInt(btn.dataset.id), true));
        content.querySelectorAll('.edit-payment-btn').forEach(btn => btn.onclick = () => this.handleMarkPaid(parseInt(btn.dataset.id), true, true));
        content.querySelectorAll('.unmark-paid-btn').forEach(btn => btn.onclick = () => this.handleMarkPaid(parseInt(btn.dataset.id), false));
        
        // Eventos Caja
        content.querySelectorAll('.delete-mov-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('¿Desea eliminar este movimiento de caja?')) {
                    try {
                        await apiClient.delete(`/caja/${btn.dataset.id}`);
                        showSuccess('Movimiento eliminado');
                        await this.loadData();
                    } catch (error) { displayApiError(error); }
                }
            };
        });
    }

    async handleMarkPaid(id, isPaid, isEdit = false) {
        if (isPaid) {
            const clase = this.clases.find(c => c.id === id);
            const modal = this.container.querySelector('#pago-fecha-modal');
            const modalTitle = modal.querySelector('h2');
            const chargeSection = this.container.querySelector('#charge-options-section');
            const practicantesList = this.container.querySelector('#reserved-practicantes-list');
            const chargeCheckbox = this.container.querySelector('#charge-salon-cost');
            const practicantesSection = this.container.querySelector('#practicantes-to-charge-section');

            modalTitle.textContent = isEdit ? 'Editar Registro de Pago' : 'Registrar Fecha de Pago';
            this.container.querySelector('#pago-clase-id').value = id;
            
            // Si es edición, usamos los valores ya guardados. Si no, calculamos sugeridos.
            if (isEdit) {
                this.container.querySelector('#input-fecha-pago').value = clase.fecha_pago_espacio;
                this.container.querySelector('#input-monto-referencia').value = parseFloat(clase.monto_referencia_espacio || 0).toFixed(2);
                this.container.querySelector('#input-monto-pago').value = parseFloat(clase.monto_pago_espacio || 0).toFixed(2);
            } else {
                const standardCost = this.getExpectedCost(clase);
                this.container.querySelector('#input-fecha-pago').value = new Date().toISOString().split('T')[0];
                this.container.querySelector('#input-monto-referencia').value = standardCost.toFixed(2);
                this.container.querySelector('#input-monto-pago').value = standardCost.toFixed(2);
            }

            // Reset charge options
            chargeCheckbox.checked = false;
            practicantesSection.style.display = 'none';
            practicantesList.innerHTML = '';

            // If class is flexible AND (cancelled OR suspended), show charge options
            if (clase && clase.tipo === 'flexible' && (clase.estado === 'cancelada' || clase.estado === 'suspendida')) {
                try {
                    // Load reserved students (those marked as 'asistio' in the attendance record)
                    const response = await apiClient.get(`/asistencia/clases/${id}/practicantes`);
                    const allPracticantes = response.data;
                    
                    // Filter only those who were checked (reserved/present)
                    const markedPracticantes = allPracticantes.filter(p => p.asistio);

                    if (markedPracticantes.length > 0) {
                        chargeSection.style.display = 'block';
                        practicantesList.innerHTML = markedPracticantes.map(p => `
                            <div class="form-check">
                                <input class="form-check-input practicante-charge-checkbox" type="checkbox" value="${p.id}" id="sc-${p.id}" checked>
                                <label class="form-check-label" for="sc-${p.id}">
                                    ${p.nombre_completo} <small class="text-muted">(${p.abono_nombre})</small>
                                </label>
                            </div>
                        `).join('');
                    } else {
                        chargeSection.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error loading practitioners', error);
                    chargeSection.style.display = 'none';
                }
            } else {
                chargeSection.style.display = 'none';
            }

            modal.style.display = 'block';
        } else {
            if (confirm('¿Desea anular el registro de pago de esta clase?')) {
                await this.submitPayment(id, false, null);
            }
        }
    }

    async submitPayment(id, isPaid, fecha, chargeOptions = {}) {
        try {
            await apiClient.put(`/asistencia/clases/${id}`, {
                pago_espacio_realizado: isPaid,
                fecha_pago_espacio: fecha,
                monto_pago_espacio: chargeOptions.monto_pago_espacio,
                monto_referencia_espacio: chargeOptions.monto_referencia_espacio,
                cobrar_salon: chargeOptions.cobrar_salon,
                practicantes_ids: chargeOptions.practicantes_ids
            });
            showSuccess(isPaid ? 'Clase marcada como pagada' : 'Pago anulado');
            await this.loadData();
        } catch (error) {
            displayApiError(error);
        }
    }
}

export default CostosPage;
