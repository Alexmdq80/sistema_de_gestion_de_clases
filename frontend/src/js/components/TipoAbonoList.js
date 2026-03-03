/**
 * TipoAbonoList Component
 * List of tipos de abono
 */

import { displayApiError, showSuccess } from '../utils/errors.js';
import { makeRequest } from '../api/client.js';
import { formatTime } from '../utils/formatting.js';

export class TipoAbonoList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onEdit: options.onEdit || (() => {}),
      onDelete: options.onDelete || (() => {}),
      onShowHistory: options.onShowHistory || (() => {})
    };
    this.tiposAbono = [];
    this.horarios = [];
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Tipos de Abono Registrados</h2>
        </div>
        
        <div id="tipos-abono-list">
          <div class="spinner"></div>
        </div>
      </div>
    `;

    this.loadData();
  }

  async loadData() {
    const listContainer = this.container.querySelector('#tipos-abono-list');
    if (!listContainer) return;

    try {
      listContainer.innerHTML = '<div class="spinner"></div>';

      const [tiposResult, horariosResult] = await Promise.all([
        makeRequest('/tipos-abono', 'GET', null, true),
        makeRequest('/horarios', 'GET', null, true)
      ]);
      
      this.tiposAbono = tiposResult.data || [];
      this.horarios = horariosResult.data || [];

      this.renderList();
    } catch (error) {
      displayApiError(error, listContainer);
    }
  }

  renderList() {
    const listContainer = this.container.querySelector('#tipos-abono-list');
    if (!listContainer) return;

    if (this.tiposAbono.length === 0) {
      listContainer.innerHTML = '<p class="text-center text-muted">No se encontraron tipos de abono</p>';
      return;
    }

    const listHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Lugar</th>
            <th>Horarios Válidos</th>
            <th>Duración / Límite</th>
            <th>Precio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${this.tiposAbono.map(tipoAbono => `
            <tr>
              <td>
                <strong>${this.escapeHtml(tipoAbono.nombre)}</strong>
                ${tipoAbono.descripcion ? `<br><small class="text-muted">${this.escapeHtml(tipoAbono.descripcion)}</small>` : ''}
              </td>
              <td>
                <span class="badge ${tipoAbono.categoria === 'particular' ? 'badge-info' : (tipoAbono.categoria === 'compartida' ? 'badge-warning' : 'badge-primary')}">
                    ${this.formatCategoria(tipoAbono.categoria)}
                </span>
              </td>
              <td>${this.escapeHtml(tipoAbono.lugar_nombre || '-')}</td>
              <td>
                ${(tipoAbono.categoria === 'particular' || tipoAbono.categoria === 'compartida') ? '<em>Agenda flexible</em>' : this.renderHorariosBadges(tipoAbono.horarios)}
              </td>
              <td>
                ${(tipoAbono.categoria === 'particular' || tipoAbono.categoria === 'compartida') ? '<em>Sin vencimiento</em>' : (tipoAbono.duracion_dias !== 0 ? tipoAbono.duracion_dias + ' días' : '<em>Clase suelta</em>')}
                ${tipoAbono.categoria === 'grupal' ? `<br><small class="text-muted">${tipoAbono.clases_por_semana} clase${tipoAbono.clases_por_semana > 1 ? 's' : ''}/sem.</small>` : ''}
                ${tipoAbono.categoria === 'compartida' ? `<br><small class="text-info">Compartida: ${tipoAbono.max_personas} pers.</small>` : ''}
              </td>
              <td>${tipoAbono.precio !== null && tipoAbono.precio !== undefined ? '$' + parseFloat(tipoAbono.precio).toFixed(2) : '-'}</td>
              <td>
                <div class="flex gap-2">
                    <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${tipoAbono.id}">Editar</button>
                    <button class="btn btn-info btn-sm" data-action="history" data-id="${tipoAbono.id}">Historial</button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-id="${tipoAbono.id}">Eliminar</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    listContainer.innerHTML = listHTML;

    // Attach event listeners
    listContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        const id = parseInt(btn.getAttribute('data-id'), 10);
        this.handleAction(action, id);
      });
    });
  }

  renderHorariosBadges(horarioIds) {
    if (!horarioIds || horarioIds.length === 0) return '<span class="text-muted">Sin horarios</span>';
    
    return horarioIds.map(id => {
        const h = this.horarios.find(h => h.id === id);
        if (!h) return '';
        return `<span class="badge" title="${h.actividad_nombre} en ${h.lugar_nombre}">
            ${this.formatDiaShort(h.dia_semana)} ${formatTime(h.hora_inicio)}
        </span>`;
    }).join(' ');
  }

  formatDiaShort(dia) {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[dia] || dia;
  }

  formatCategoria(categoria) {
    const map = {
        'grupal': 'Grupal',
        'particular': 'Particular',
        'compartida': 'Compartida',
        'otro': 'Otro'
    };
    return map[categoria] || categoria;
  }

  handleAction(action, id) {
    const tipoAbono = this.tiposAbono.find(p => p.id === id);

    switch (action) {
      case 'edit':
        this.options.onEdit(tipoAbono);
        break;
      case 'history':
        this.options.onShowHistory(tipoAbono);
        break;
      case 'delete':
        if (confirm(`¿Está seguro de que desea eliminar el tipo de abono "${tipoAbono.nombre}"?`)) {
          this.deleteTipoAbono(id);
        }
        break;
    }
  }

  async deleteTipoAbono(id) {
    try {
      await makeRequest(`/tipos-abono/${id}`, 'DELETE', null, true);
      showSuccess('Tipo de abono eliminado correctamente', this.container);
      this.loadData();
      if (this.options.onDelete) {
        this.options.onDelete(id);
      }
    } catch (error) {
      displayApiError(error, this.container);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default TipoAbonoList;
