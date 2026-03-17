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
                                <td><strong>$${parseFloat(d.monto).toFixed(2)}</strong></td>
                                <td><span class="badge ${this.getBadgeClass(d.estado)}">${d.estado.toUpperCase()}</span></td>
                                <td>
                                    ${d.estado === 'pendiente' ? `
                                        <button class="btn btn-sm btn-success pay-deuda-btn" data-id="${d.id}" data-tipo="${d.tipo}" title="Pagar total"><i class="fas fa-check"></i> Pagar</button>
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
        const msg = tipo === 'abono' 
            ? '¿Registrar el pago total del saldo pendiente de este abono?' 
            : '¿Marcar esta deuda como pagada?';
        if (!confirm(msg)) return;
        try {
            await apiClient.put(`/deudas/${id}/pagar?tipo=${tipo}`);
            showSuccess(tipo === 'abono' ? 'Pago registrado y saldo cancelado' : 'Deuda pagada');
            await this.loadData();
        } catch (error) { displayApiError(error); }
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
