import { apiClient } from '../api/client.js';
import { displayApiError } from '../utils/errors.js';
import { formatDate, formatTime, formatDateReadable } from '../utils/formatting.js';

export class InformesPage {
    constructor(container) {
        this.container = container;
        this.currentReport = 'cuotas'; // 'cuotas' | 'espacios'
        
        const today = new Date();
        this.selectedMonth = today.getMonth() + 1;
        this.selectedYear = today.getFullYear();
        this.selectedLugarId = '';
        
        this.lugares = [];
        this.data = [];
    }

    async render() {
        this.container.innerHTML = `
            <div class="page-header no-print">
                <h1>Informes Mensuales</h1>
            </div>

            <div class="filters-bar mb-4 p-3 bg-light border rounded no-print">
                <div class="form-row align-items-center">
                    <div class="form-group col-md-3 mb-md-0">
                        <select class="form-control" id="report-type" title="Tipo de Informe">
                            <option value="cuotas" ${this.currentReport === 'cuotas' ? 'selected' : ''}>Resumen Cuotas Pagadas</option>
                            <option value="padron" ${this.currentReport === 'padron' ? 'selected' : ''}>Padrón Detallado de Socios</option>
                            <option value="espacios" ${this.currentReport === 'espacios' ? 'selected' : ''}>Alquiler de Espacios</option>
                            <option value="consolidado" ${this.currentReport === 'consolidado' ? 'selected' : ''}>Liquidación Mensual (Cuotas + Alquiler)</option>
                        </select>
                    </div>
                    <div class="form-group col-md-2 mb-md-0">
                        <select class="form-control" id="report-month" title="Seleccionar Mes">
                            ${this.generateMonthOptions()}
                        </select>
                    </div>
                    <div class="form-group col-md-2 mb-md-0">
                        <input type="number" class="form-control" id="report-year" value="${this.selectedYear}" placeholder="Año" title="Año">
                    </div>
                    <div class="form-group col-md-3 mb-md-0">
                        <select class="form-control" id="report-lugar" title="Sede / Club">
                            <option value="">Todas las Sedes</option>
                            <!-- Populated dynamically -->
                        </select>
                    </div>
                    <div class="form-group col-md-2 mb-md-0">
                        <button id="print-report-btn" class="btn btn-outline-secondary btn-block">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
            </div>

            <div id="report-content" class="report-container">
                <!-- Data will be rendered here -->
            </div>
        `;

        await this.loadInitialData();
        this.attachEvents();
        await this.loadReport();
    }

    generateMonthOptions() {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months.map((m, i) => `<option value="${i + 1}" ${this.selectedMonth === i + 1 ? 'selected' : ''}>${m}</option>`).join('');
    }

    async loadInitialData() {
        try {
            const res = await apiClient.get('/lugares');
            // Filtrar para mostrar solo los lugares "padres" (los que no tienen parent_id)
            this.lugares = (res.data || []).filter(l => !l.parent_id);
            
            const lugarSelect = this.container.querySelector('#report-lugar');
            if (lugarSelect) {
                lugarSelect.innerHTML = '<option value="">Todas las Sedes</option>' + 
                    this.lugares.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
            }
        } catch (error) { console.error(error); }
    }

    attachEvents() {
        this.container.querySelector('#report-type').onchange = (e) => {
            this.currentReport = e.target.value;
            this.loadReport();
        };
        this.container.querySelector('#report-month').onchange = (e) => {
            this.selectedMonth = parseInt(e.target.value, 10);
            this.loadReport();
        };
        this.container.querySelector('#report-year').oninput = (e) => {
            this.selectedYear = parseInt(e.target.value, 10);
            this.loadReport();
        };
        this.container.querySelector('#report-lugar').onchange = (e) => {
            this.selectedLugarId = e.target.value;
            this.loadReport();
        };
        this.container.querySelector('#print-report-btn').onclick = () => window.print();
    }

    async loadReport() {
        const content = this.container.querySelector('#report-content');
        content.innerHTML = '<div class="text-center p-5">Generando informe...</div>';

        try {
            let endpoint = '';
            const params = {
                mes: this.selectedMonth,
                anio: this.selectedYear,
                lugar_id: this.selectedLugarId
            };

            if (this.currentReport === 'cuotas') {
                endpoint = '/informes/cuotas-sociales';
            } else if (this.currentReport === 'padron') {
                endpoint = '/informes/padron-socios-pagos';
            } else if (this.currentReport === 'consolidado') {
                if (!this.selectedLugarId) {
                    content.innerHTML = '<div class="alert alert-warning">Debe seleccionar una Sede específica para el informe consolidado.</div>';
                    return;
                }
                endpoint = '/informes/consolidado-sede';
            } else {
                endpoint = '/informes/alquiler-espacios';
                // For spaces we need date range
                const firstDay = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-01`;
                const lastDay = new Date(this.selectedYear, this.selectedMonth, 0).toISOString().split('T')[0];
                params.fecha_inicio = firstDay;
                params.fecha_fin = lastDay;
            }

            const res = await apiClient.get(endpoint, params);
            this.data = res.data;
            this.renderReportData(content);
        } catch (error) {
            displayApiError(error, content);
        }
    }

    renderReportHeader(title, subtitle) {
        return `
            <div class="report-header-print mb-4">
                <div class="flex items-center gap-4 border-bottom pb-3">
                    <img src="/src/assets/logo.png" alt="Logo" class="report-logo" style="height: 80px; width: auto;" onerror="this.style.display='none'">
                    <div>
                        <h2 class="mb-0">${title}</h2>
                        <h4 class="text-muted mb-0">${subtitle}</h4>
                    </div>
                </div>
            </div>
        `;
    }

    renderReportData(content) {
        if (this.data.length === 0) {
            content.innerHTML = '<div class="alert alert-info">No hay datos para los criterios seleccionados.</div>';
            return;
        }

        if (this.currentReport === 'cuotas') {
            this.renderCuotasReport(content);
        } else if (this.currentReport === 'padron') {
            this.renderPadronReport(content);
        } else if (this.currentReport === 'consolidado') {
            this.renderConsolidadoReport(content);
        } else {
            this.renderEspaciosReport(content);
        }
    }

    renderConsolidadoReport(content) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const sedeNombre = this.lugares.find(l => l.id == this.selectedLugarId)?.nombre;
        
        const { cuotas, alquileres } = this.data;
        const totalCuotas = cuotas.reduce((acc, item) => acc + parseFloat(item.monto), 0);
        const totalAlquiler = alquileres.reduce((acc, item) => acc + parseFloat(item.monto), 0);
        const totalALiquidar = totalCuotas + totalAlquiler;

        content.innerHTML = `
            <div class="report-paper p-4 bg-white border">
                ${this.renderReportHeader('Planilla de Liquidación Mensual', `Institución: ${sedeNombre} - Periodo: ${monthNames[this.selectedMonth - 1]} ${this.selectedYear}`)}

                <div class="mb-5">
                    <h3 class="border-bottom pb-2">1. Detalle de Cuotas Sociales Recaudadas</h3>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Practicante</th>
                                <th>Concepto</th>
                                <th class="text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cuotas.map(c => `
                                <tr>
                                    <td>${c.nombre_completo}</td>
                                    <td>Cuota Social ${c.mes_abono}</td>
                                    <td class="text-right">$${parseFloat(c.monto).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            ${cuotas.length === 0 ? '<tr><td colspan="3" class="text-center text-muted">No se registraron cuotas</td></tr>' : ''}
                        </tbody>
                        <tfoot>
                            <tr class="font-weight-bold bg-light">
                                <td colspan="2" class="text-right">Subtotal Cuotas:</td>
                                <td class="text-right">$${totalCuotas.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="mb-5">
                    <h3 class="border-bottom pb-2">2. Detalle de Alquiler de Espacios (Clases)</h3>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Actividad / Detalle</th>
                                <th class="text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alquileres.map(a => {
                                // Separar año, mes, día manualmente para evitar "Invalid Date"
                                const [year, month, day] = a.fecha.split('-');
                                const dateObj = new Date(year, month - 1, day);
                                const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                                const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                                
                                return `
                                <tr>
                                    <td>${capitalizedDay} ${formatDate(a.fecha)} <small class="text-muted">(${a.hora.substring(0, 5)} hs)</small></td>
                                    <td>${a.actividad_nombre}</td>
                                    <td class="text-right">$${parseFloat(a.monto).toFixed(2)}</td>
                                </tr>
                            `}).join('')}
                            ${alquileres.length === 0 ? '<tr><td colspan="3" class="text-center text-muted">No se registraron alquileres</td></tr>' : ''}
                        </tbody>
                        <tfoot>
                            <tr class="font-weight-bold bg-light">
                                <td colspan="2" class="text-right">Subtotal Alquiler:</td>
                                <td class="text-right">$${totalAlquiler.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Resumen Final de Liquidación -->
                <div class="mt-5 p-4 border border-dark rounded text-center" style="background-color: #f0f0f0;">
                    <div style="display: flex; justify-content: space-around; align-items: center;">
                        <div>
                            <p class="mb-0">Recaudación Cuotas</p>
                            <h4>$${totalCuotas.toFixed(2)}</h4>
                        </div>
                        <div style="font-size: 2rem;">+</div>
                        <div>
                            <p class="mb-0">Pago Alquiler Salón</p>
                            <h4>$${totalAlquiler.toFixed(2)}</h4>
                        </div>
                        <div style="font-size: 2rem;">=</div>
                        <div>
                            <p class="mb-0 font-weight-bold">TOTAL A LIQUIDAR AL CLUB</p>
                            <h2 class="text-primary" style="font-size: 2.5rem; font-weight: 800;">$${totalALiquidar.toFixed(2)}</h2>
                        </div>
                    </div>
                </div>

                <div class="mt-5 flex justify-between" style="padding-top: 3rem;">
                    <div style="border-top: 1px solid black; width: 200px; text-align: center;">
                        <small>Firma Responsable</small>
                    </div>
                    <div style="border-top: 1px solid black; width: 200px; text-align: center;">
                        <small>Recibido por el Club</small>
                    </div>
                </div>

                <div class="mt-5 text-right small text-muted">
                    Documento generado por el Sistema de Gestión el: ${new Date().toLocaleString()}
                </div>
            </div>
        `;
    }

    renderPadronReport(content) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const isSedeFiltered = this.selectedLugarId !== '';
        const sedeNombre = isSedeFiltered ? this.lugares.find(l => l.id == this.selectedLugarId)?.nombre : 'Todas las Sedes';

        content.innerHTML = `
            <div class="report-paper p-4 bg-white border" style="max-width: 100%; width: 100%;">
                ${this.renderReportHeader('Padrón Detallado de Socios', `${sedeNombre} - Periodo: ${monthNames[this.selectedMonth - 1]} ${this.selectedYear}`)}
                
                <div class="table-responsive">
                    <table class="table table-sm table-bordered" style="font-size: 0.85rem;">
                        <thead class="thead-light">
                            <tr>
                                <th>ID</th>
                                <th>Nº Socio</th>
                                <th>Nombre y Apellido</th>
                                <th>DNI</th>
                                <th>F. Nac.</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Domicilio</th>
                                ${!isSedeFiltered ? '<th>Sede</th>' : ''}
                                <th>Categoría Pago</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.data.map(item => `
                                <tr>
                                    <td><small class="text-muted">${item.sistema_id}</small></td>
                                    <td><strong>${item.numero_socio || '-'}</strong></td>
                                    <td>${item.nombre_completo}</td>
                                    <td>${item.dni || '-'}</td>
                                    <td>${item.fecha_nacimiento ? formatDate(item.fecha_nacimiento) : '-'}</td>
                                    <td><small>${item.telefono || '-'}</small></td>
                                    <td><small>${item.email || '-'}</small></td>
                                    <td><small>${item.direccion || '-'}</small></td>
                                    ${!isSedeFiltered ? `<td>${item.sede_nombre}</td>` : ''}
                                    <td><span class="badge badge-light">${item.categoria_cuota}</span></td>
                                    <td class="text-right">$${parseFloat(item.monto).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="mt-4 flex justify-between small text-muted">
                    <span>Total de registros: ${this.data.length}</span>
                    <span>Generado el: ${new Date().toLocaleString()}</span>
                </div>
            </div>
        `;
    }

    renderCuotasReport(content) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const isSedeFiltered = this.selectedLugarId !== '';
        const sedeNombre = isSedeFiltered ? this.lugares.find(l => l.id == this.selectedLugarId)?.nombre : 'Todas las Sedes';
        const total = this.data.reduce((acc, item) => acc + parseFloat(item.monto), 0);

        content.innerHTML = `
            <div class="report-paper p-4 bg-white border">
                ${this.renderReportHeader('Informe de Cuotas Sociales', `${sedeNombre} - Periodo: ${monthNames[this.selectedMonth - 1]} ${this.selectedYear}`)}
                
                <table class="table table-sm">
                    <thead>
                        <tr>
                            ${!isSedeFiltered ? '<th>Sede / Club</th>' : ''}
                            <th>Practicante</th>
                            <th>Mes Abonado</th>
                            <th>Fecha Cobro</th>
                            <th class="text-right">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.data.map(item => `
                            <tr>
                                ${!isSedeFiltered ? `<td>${item.lugar_nombre}</td>` : ''}
                                <td>${item.practicante_nombre}</td>
                                <td>${item.mes_abono}</td>
                                <td>${formatDate(item.fecha_pago)}</td>
                                <td class="text-right">$${parseFloat(item.monto).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="font-weight-bold" style="font-size: 1.2rem; background: #f8f9fa;">
                            <td colspan="${isSedeFiltered ? '3' : '4'}" class="text-right">TOTAL RECAUDADO:</td>
                            <td class="text-right text-success">$${total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div class="mt-5 text-right small text-muted">
                    Generado el: ${new Date().toLocaleString()}
                </div>
            </div>
        `;
    }

    renderEspaciosReport(content) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const isSedeFiltered = this.selectedLugarId !== '';
        const sedeNombre = isSedeFiltered ? this.lugares.find(l => l.id == this.selectedLugarId)?.nombre : 'Todas las Sedes';
        
        const totalEsperado = this.data.reduce((acc, item) => acc + parseFloat(item.monto_esperado || 0), 0);
        const totalPagado = this.data.reduce((acc, item) => acc + parseFloat(item.monto_pagado || 0), 0);

        content.innerHTML = `
            <div class="report-paper p-4 bg-white border">
                ${this.renderReportHeader('Informe de Alquiler de Espacios', `${sedeNombre} - Periodo: ${monthNames[this.selectedMonth - 1]} ${this.selectedYear}`)}
                
                <table class="table table-sm">
                    <thead>
                        <tr>
                            ${!isSedeFiltered ? '<th>Sede</th>' : ''}
                            <th>Fecha Clase</th>
                            <th>Actividad</th>
                            <th class="text-right">Monto Pagado</th>
                            <th>Fecha de Pago</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.data.map(item => {
                            const [year, month, day] = item.fecha.split('-');
                            const dateObj = new Date(year, month - 1, day);
                            const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                            const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

                            return `
                            <tr>
                                ${!isSedeFiltered ? `<td>${item.lugar_nombre}</td>` : ''}
                                <td>${capitalizedDay} ${formatDate(item.fecha)} <small>(${item.hora.substring(0, 5)} hs)</small></td>
                                <td>${item.actividad_nombre}</td>
                                <td class="text-right font-weight-bold">$${parseFloat(item.monto_pagado || 0).toFixed(2)}</td>
                                <td>${formatDate(item.fecha_pago)}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="font-weight-bold bg-light">
                            <td colspan="${isSedeFiltered ? '2' : '3'}" class="text-right">TOTAL PAGADO:</td>
                            <td class="text-right text-primary">$${totalPagado.toFixed(2)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                <div class="mt-5 text-right small text-muted">
                    Generado el: ${new Date().toLocaleString()}
                </div>
            </div>
        `;
    }
}

export default InformesPage;
