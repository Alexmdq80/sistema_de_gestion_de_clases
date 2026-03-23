import { apiClient } from '../api/client.js';
import { formatDateReadable } from '../utils/formatting.js';
import { displayApiError, showSuccess } from '../utils/errors.js';

export class DeudasPage {
    constructor(container) {
        this.container = container;
        this.deudas = [];
        this.filter = 'pendiente'; // 'pendiente', 'pagada', 'cancelada', '' (todas)
    }

    async render() {
        this.container.innerHTML = `
            <div class="page-header">
                <h1>Gestión de Deudas</h1>
                <div class="actions">
                    <select id="estado-filter" class="form-control" style="max-width: 200px;">
                        <option value="pendiente" ${this.filter === 'pendiente' ? 'selected' : ''}>Pendientes</option>
                        <option value="pagada" ${this.filter === 'pagada' ? 'selected' : ''}>Pagadas</option>
                        <option value="cancelada" ${this.filter === 'cancelada' ? 'selected' : ''}>Canceladas</option>
                        <option value="" ${this.filter === '' ? 'selected' : ''}>Todas</option>
                    </select>
                </div>
            </div>

            <div id="deudas-content">
                <div class="loader text-center p-5">Cargando deudas...</div>
            </div>

            <!-- Modal para Pago de Deuda -->
            <div id="pago-deuda-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2>Registrar Pago de Deuda</h2>
                        <span class="close-pago-modal close-button">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="pago-deuda-form">
                            <input type="hidden" id="pago-deuda-id">
                            <input type="hidden" id="pago-deuda-tipo">
                            
                            <div class="p-3 bg-light border rounded mb-3">
                                <p class="mb-1"><strong>Practicante:</strong> <span id="pago-practicante-nombre">-</span></p>
                                <p class="mb-0"><strong>Concepto:</strong> <span id="pago-concepto">-</span></p>
                            </div>

                            <div class="form-group mb-3">
                                <label for="input-monto-pactado" class="font-weight-bold">Monto Pactado / Total Deuda ($):</label>
                                <input type="number" id="input-monto-pactado" class="form-control" step="0.01" required>
                                <small class="text-muted">Monto total reconocido de la deuda.</small>
                            </div>

                            <div class="form-group mb-4">
                                <label for="input-monto-pagado" class="font-weight-bold text-success">Monto que entrega ahora ($):</label>
                                <input type="number" id="input-monto-pagado" class="form-control form-control-lg border-success" step="0.01" required>
                                <small class="text-info">Importe que el alumno abona en este momento.</small>
                            </div>

                            <div class="form-actions mt-4">
                                <button type="submit" class="btn btn-success btn-lg btn-block">Confirmar Pago</button>
                                <button type="button" class="btn btn-secondary btn-block cancel-pago-modal">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.attachEvents();
        await this.loadData();
    }

    attachEvents() {
        const filterSelect = this.container.querySelector('#estado-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                this.filter = filterSelect.value;
                this.loadData();
            });
        }

        const modal = this.container.querySelector('#pago-deuda-modal');
        const form = this.container.querySelector('#pago-deuda-form');

        this.container.querySelector('.close-pago-modal').onclick = () => modal.style.display = 'none';
        this.container.querySelector('.cancel-pago-modal').onclick = () => modal.style.display = 'none';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const id = parseInt(this.container.querySelector('#pago-deuda-id').value, 10);
            const tipo = this.container.querySelector('#pago-deuda-tipo').value;
            const monto_esperado = parseFloat(this.container.querySelector('#input-monto-pactado').value);
            const monto_pago = parseFloat(this.container.querySelector('#input-monto-pagado').value);

            try {
                await apiClient.put(`/deudas/${id}/pagar?tipo=${tipo}`, {
                    monto_esperado,
                    monto_pago
                });
                showSuccess('Pago registrado correctamente');
                modal.style.display = 'none';
                await this.loadData();
            } catch (error) { displayApiError(error); }
        };

        window.onclick = (event) => {
            if (event.target == modal) modal.style.display = 'none';
        };
    }

    async loadData() {
        const content = this.container.querySelector('#deudas-content');
        try {
            const response = await apiClient.get('/deudas', { estado: this.filter });
            this.deudas = response.data;
            this.renderList(content);
        } catch (error) {
            displayApiError(error, content);
        }
    }

    renderList(content) {
        if (this.deudas.length === 0) {
            content.innerHTML = `<p class="text-center p-5 text-muted">No se encontraron deudas ${this.filter || ''}.</p>`;
            return;
        }

        content.innerHTML = `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Practicante</th>
                            <th>Concepto</th>
                            <th>Monto</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.deudas.map(d => `
                            <tr>
                                <td>${formatDateReadable(d.fecha)}</td>
                                <td><strong>${d.practicante_nombre}</strong></td>
                                <td>
                                    <span class="badge ${d.tipo === 'abono' ? 'badge-info' : 'badge-light'} mr-1">${d.tipo.toUpperCase()}</span>
                                    ${d.concepto}
                                </td>
                                <td>
                                    <strong>$${parseFloat(d.monto).toFixed(2)}</strong>
                                    ${parseFloat(d.monto) < parseFloat(d.monto_original) ? `<br><small class="text-muted">de $${parseFloat(d.monto_original).toFixed(2)}</small>` : ''}
                                </td>
                                <td><span class="badge ${this.getBadgeClass(d.estado)}">${d.estado.toUpperCase()}</span></td>
                                <td>
                                    ${d.estado === 'pendiente' ? `
                                        <button class="btn btn-sm btn-success pay-deuda-btn" data-id="${d.id}" data-tipo="${d.tipo}" title="Pagar"><i class="fas fa-hand-holding-usd"></i> Pagar</button>
                                        <button class="btn btn-sm btn-outline-danger cancel-deuda-btn" data-id="${d.id}" data-tipo="${d.tipo}" title="Anular"><i class="fas fa-times"></i> Anular</button>
                                    ` : ''}
                                    ${d.tipo === 'manual' ? `
                                        <button class="btn btn-sm btn-outline-secondary delete-deuda-btn" data-id="${d.id}"><i class="fas fa-trash"></i></button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        content.querySelectorAll('.pay-deuda-btn').forEach(btn => {
            btn.onclick = () => this.handlePay(parseInt(btn.dataset.id), btn.dataset.tipo);
        });

        content.querySelectorAll('.cancel-deuda-btn').forEach(btn => {
            btn.onclick = () => this.handleCancel(parseInt(btn.dataset.id), btn.dataset.tipo);
        });

        content.querySelectorAll('.delete-deuda-btn').forEach(btn => {
            btn.onclick = () => this.handleDelete(parseInt(btn.dataset.id));
        });
    }

    getBadgeClass(estado) {
        const map = {
            'pendiente': 'badge-warning',
            'pagada': 'badge-success',
            'cancelada': 'badge-danger'
        };
        return map[estado] || 'badge-secondary';
    }

    async handlePay(id, tipo = 'manual') {
        const deuda = this.deudas.find(d => d.id === id && d.tipo === tipo);
        if (!deuda) return;

        const modal = this.container.querySelector('#pago-deuda-modal');
        this.container.querySelector('#pago-deuda-id').value = id;
        this.container.querySelector('#pago-deuda-tipo').value = tipo;
        this.container.querySelector('#pago-practicante-nombre').textContent = deuda.practicante_nombre;
        this.container.querySelector('#pago-concepto').textContent = deuda.concepto;
        
        const inputPactado = this.container.querySelector('#input-monto-pactado');
        const inputPagado = this.container.querySelector('#input-monto-pagado');
        
        inputPactado.value = parseFloat(deuda.monto_original).toFixed(2);
        inputPagado.value = parseFloat(deuda.monto).toFixed(2);

        modal.style.display = 'block';
        inputPagado.focus();
    }

    async handleCancel(id, tipo = 'manual') {
        const msg = tipo === 'abono' 
            ? '¿Seguro que desea cancelar este abono y anular su deuda? (El abono pasará a estado cancelado)' 
            : '¿Seguro que desea anular esta deuda?';
        if (!confirm(msg)) return;
        try {
            await apiClient.put(`/deudas/${id}/cancelar?tipo=${tipo}`);
            showSuccess(tipo === 'abono' ? 'Abono y deuda anulados' : 'Deuda anulada');
            await this.loadData();
        } catch (error) { displayApiError(error); }
    }

    async handleDelete(id) {
        if (!confirm('¿Eliminar definitivamente el registro de esta deuda?')) return;
        try {
            await apiClient.delete(`/deudas/${id}`);
            showSuccess('Registro eliminado');
            await this.loadData();
        } catch (error) { displayApiError(error); }
    }
}

export default DeudasPage;
