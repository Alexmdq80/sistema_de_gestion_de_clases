/**
 * PracticanteList Component
 * List of practicantes with search functionality
 */

import { formatDateReadable } from '../utils/formatting.js';
import { displayApiError, showSuccess } from '../utils/errors.js';
import { practicanteApi } from '../api/client.js';
import { navigate } from '../router.js'; // Import navigate

export class PracticanteList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onSelect: options.onSelect || (() => {}),
      onEdit: options.onEdit || (() => {}),
      onDelete: options.onDelete || (() => {}),
      onShowHistory: options.onShowHistory || (() => {}),
      onReceiveCuota: options.onReceiveCuota || (() => {}),
      onPayAbono: options.onPayAbono || (() => {}),
      onShowHorarios: options.onShowHorarios || (() => {}),
      onLoad: options.onLoad || (() => {}),
      filterActivo: options.filterActivo, // New option for filtering active status
    };
    this.practicantes = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.searchTerm = '';
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="flex justify-between items-center">
            <h2 class="card-title">Practicantes</h2>
            <button id="print-all-btn" class="btn btn-outline-info">
              <i class="fas fa-print"></i> Imprimir Información de Salud de Todos
            </button>
          </div>
          <div class="flex gap-2" style="margin-top: 1rem;">
            <input 
              type="text" 
              id="search-input" 
              placeholder="Buscar por nombre, teléfono o email..."
              style="flex: 1; padding: 0.5rem;"
              value="${this.searchTerm}"
            />
            <button id="search-btn" class="btn">Buscar</button>
            <button id="clear-search-btn" class="btn btn-secondary">Limpiar</button>
          </div>
        </div>
        
        <div id="practicantes-list">
          <div class="spinner"></div>
        </div>

        <div id="pagination" style="margin-top: 1rem; text-align: center;"></div>
      </div>

      <!-- Hidden area for printing all practicantes -->
      <div id="print-area" class="print-only"></div>

      <style>
        @media print {
            /* Hide everything in the body by default */
            body > * {
                display: none !important;
            }
            
            /* Show only the app and main content containers but not their usual children */
            #app, #main-content, #practicantes-page, #practicantes-content, #list-container {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* Specifically hide headers, footers, nav, and the main card when printing the full list */
            header, footer, nav, #practicantes-header, .card, #pagination, .spinner, .btn, .badge {
                display: none !important;
            }
            
            /* Show the print area explicitly */
            #print-area {
                display: block !important;
                visibility: visible !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
            }

            #print-area table th:first-child,
            #print-area table td:first-child {
                position: sticky;
                left: 0;
                background-color: #fff;
                z-index: 10;
                border-right: 2px solid #000 !important;
            }

            #print-area table th:first-child {
                background-color: #eee;
            }

            table {
                width: 100% !important;
                border-collapse: collapse !important;
                font-size: 9px !important;
            }
            th, td {
                border: 1px solid #000 !important;
                padding: 4px !important;
                text-align: left !important;
                word-break: break-word !important;
            }
            th {
                background-color: #eee !important;
                -webkit-print-color-adjust: exact;
                font-weight: bold !important;
            }

            /* Prevent wrapping for specific columns to fit content */
            #print-area table th:nth-child(1),
            #print-area table td:nth-child(1),
            #print-area table th:nth-child(2),
            #print-area table td:nth-child(2),
            #print-area table th:nth-child(3),
            #print-area table td:nth-child(3),
            #print-area table th:nth-child(5),
            #print-area table td:nth-child(5),
            #print-area table th:nth-child(6),
            #print-area table td:nth-child(6),
            #print-area table th:nth-child(7),
            #print-area table td:nth-child(7) {
                white-space: nowrap;
            }
        }
        .print-only {
            display: none;
        }
      </style>
    `;

    this.attachEvents();
    this.loadPracticantes();
  }

  attachEvents() {
    const searchInput = this.container.querySelector('#search-input');
    const searchBtn = this.container.querySelector('#search-btn');
    const clearBtn = this.container.querySelector('#clear-search-btn');
    const printAllBtn = this.container.querySelector('#print-all-btn');

    if (printAllBtn) {
        printAllBtn.addEventListener('click', () => this.printAll());
    }

    // Search on button click
    searchBtn.addEventListener('click', () => {
      this.searchTerm = searchInput.value.trim();
      this.currentPage = 1;
      this.loadPracticantes();
    });

    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchTerm = searchInput.value.trim();
        this.currentPage = 1;
        this.loadPracticantes();
      }
    });

    // Clear search
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchTerm = '';
      this.currentPage = 1;
      this.loadPracticantes();
    });
  }

  async loadPracticantes() {
    const listContainer = this.container.querySelector('#practicantes-list');
    const paginationContainer = this.container.querySelector('#pagination');

    try {
      listContainer.innerHTML = '<div class="spinner"></div>';

      const params = {
        page: this.currentPage,
        limit: 20
      };

      if (this.searchTerm) {
        params.search = this.searchTerm;
      }
      if (this.options.filterActivo !== undefined) {
        params.activo = this.options.filterActivo;
      }

      const result = await practicanteApi.getAll(params.search, params.page, params.limit, params.activo); // Use practicanteApi.getAll
      this.practicantes = result.data || [];
      this.totalPages = result.pagination?.totalPages || 1;
      this.currentPage = result.pagination?.page || 1;

      this.renderList();
      this.renderPagination();
      this.options.onLoad(this.practicantes);
    } catch (error) {
      displayApiError(error, listContainer);
    }
  }

  renderList() {
    const listContainer = this.container.querySelector('#practicantes-list');

    if (this.practicantes.length === 0) {
      listContainer.innerHTML = '<p class="text-center text-muted">No se encontraron practicantes</p>';
      return;
    }

    const listHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Último Abono</th>
            <th>Mes Abono</th>
            <th title="Última Cuota Social Recibida (Pago del alumno)">C.S. Recibida</th>
            <th title="Última Cuota Social Pagada (Rendido al club)">C.S. Pagada</th>
            <th>Clases Rest.</th>
            <th>Teléfono</th>
            <th>Acciones</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${this.practicantes.map(practicante => `
            <tr>
              <td><strong>${this.escapeHtml(practicante.nombre_completo)}</strong></td>
              <td style="font-size: 0.85rem;">${practicante.ultimo_abono_nombre ? this.escapeHtml(practicante.ultimo_abono_nombre) : '<span class="text-muted">-</span>'}</td>
              <td>${practicante.ultimo_abono_mes ? this.escapeHtml(practicante.ultimo_abono_mes) : '<span class="text-muted">-</span>'}</td>
              <td style="background-color: #f0fdf4;">${practicante.ultima_cuota_social_recibida_mes ? this.escapeHtml(practicante.ultima_cuota_social_recibida_mes) : '<span class="text-muted">-</span>'}</td>
              <td style="background-color: #fef2f2;">${practicante.ultima_cuota_social_pagada_mes ? this.escapeHtml(practicante.ultima_cuota_social_pagada_mes) : '<span class="text-muted">-</span>'}</td>
              <td class="text-center">
                ${practicante.clases_restantes !== null ? `
                  <span class="badge ${practicante.clases_restantes <= 1 ? 'badge-danger' : 'badge-info'}">
                    ${practicante.clases_restantes}
                  </span>
                ` : '<span class="text-muted">-</span>'}
              </td>
              <td>${practicante.telefono ? this.escapeHtml(practicante.telefono) : '-'}</td>
              <td>
                <button 
                  class="btn btn-primary" 
                  data-action="pay" 
                  data-id="${practicante.id}"
                  style="margin-right: 0.5rem;"
                >
                  Pagar Abono
                </button>
                <button 
                  class="btn btn-outline-primary" 
                  data-action="horarios" 
                  data-id="${practicante.id}"
                  style="margin-right: 0.5rem;"
                >
                  Horarios
                </button>
                ${practicante.socio_count > 0 ? `
                <button 
                  class="btn btn-success" 
                  data-action="cuota" 
                  data-id="${practicante.id}"
                  style="margin-right: 0.5rem;"
                >
                  Recibir Cuota
                </button>
                ` : ''}
                <button 
                  class="btn" 
                  data-action="view" 
                  data-id="${practicante.id}"
                  style="margin-right: 0.5rem;"
                >
                  Ver
                </button>
                <button 
                  class="btn btn-info" 
                  data-action="history" 
                  data-id="${practicante.id}"
                  style="margin-right: 0.5rem;"
                >
                  Historial
                </button>
                <button 
                  class="btn btn-secondary" 
                  data-action="edit" 
                  data-id="${practicante.id}"
                  style="margin-right: 0.5rem;"
                >
                  Editar
                </button>
                <button 
                  class="btn ${practicante.activo ? 'btn-warning' : 'btn-success'}" 
                  data-action="toggle-activo" 
                  data-id="${practicante.id}"
                  data-activo="${practicante.activo}"
                  style="margin-right: 0.5rem;"
                >
                  ${practicante.activo ? 'Archivar' : 'Desarchivar'}
                </button>
                <button 
                  class="btn btn-danger" 
                  data-action="delete" 
                  data-id="${practicante.id}"
                >
                  Eliminar
                </button>
              </td>
              <td>
                <span class="badge ${practicante.activo ? 'badge-success' : 'badge-secondary'}">
                  ${practicante.activo ? 'Activo' : 'Archivado'}
                </span>
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

  renderPagination() {
    const paginationContainer = this.container.querySelector('#pagination');

    if (this.totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }

    paginationContainer.innerHTML = `
      <div class="flex gap-2" style="justify-content: center; align-items: center;">
        <button 
          class="btn btn-secondary" 
          ${this.currentPage === 1 ? 'disabled' : ''}
          data-page="${this.currentPage - 1}"
        >
          Anterior
        </button>
        ${pages.map(page => `
          <button 
            class="btn ${page === this.currentPage ? '' : 'btn-secondary'}"
            data-page="${page}"
          >
            ${page}
          </button>
        `).join('')}
        <button 
          class="btn btn-secondary" 
          ${this.currentPage === this.totalPages ? 'disabled' : ''}
          data-page="${this.currentPage + 1}"
        >
          Siguiente
        </button>
      </div>
    `;

    paginationContainer.querySelectorAll('button[data-page]').forEach(btn => {
      if (!btn.disabled) {
        btn.addEventListener('click', (e) => {
          this.currentPage = parseInt(btn.getAttribute('data-page'), 10);
          this.loadPracticantes();
        });
      }
    });
  }

  handleAction(action, id) {
    const practicante = this.practicantes.find(p => p.id === id);

    switch (action) {
      case 'view':
        this.options.onSelect(practicante);
        break;
      case 'edit':
        this.options.onEdit(practicante);
        break;
      case 'history':
        this.options.onShowHistory(practicante);
        break;
      case 'delete':
        if (confirm(`¿Está seguro de que desea eliminar a ${practicante.nombre_completo}?`)) {
          this.deletePracticante(id);
        }
        break;
      case 'pay': // Handle the new 'pay' action
        this.options.onPayAbono(practicante);
        break;
      case 'horarios':
        this.options.onShowHorarios(practicante);
        break;
      case 'cuota':
        this.options.onReceiveCuota(practicante);
        break;
      case 'toggle-activo':
        this.togglePracticanteActivo(id, practicante.activo);
        break;
    }
  }

  async deletePracticante(id) {
    try {
      await practicanteApi.delete(id); // Use practicanteApi.delete
      showSuccess('Practicante eliminado correctamente', this.container);
      this.loadPracticantes();
      if (this.options.onDelete) {
        this.options.onDelete(id);
      }
    } catch (error) {
      displayApiError(error, this.container);
    }
  }

  async togglePracticanteActivo(id, currentActivoStatus) {
    const newActivoStatus = !currentActivoStatus;
    const actionText = newActivoStatus ? 'desarchivar' : 'archivar';
    if (!confirm(`¿Está seguro de que desea ${actionText} este practicante?`)) {
      return;
    }

    try {
      await practicanteApi.update(id, { activo: newActivoStatus });
      showSuccess(`Practicante ${newActivoStatus ? 'desarchivado' : 'archivado'} correctamente`, this.container);
      this.loadPracticantes();
    } catch (error) {
      displayApiError(error, this.container);
    }
  }

  async printAll() {
    const printArea = this.container.querySelector('#print-area');
    const originalText = this.container.querySelector('#print-all-btn').innerHTML;
    
    try {
        this.container.querySelector('#print-all-btn').disabled = true;
        this.container.querySelector('#print-all-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        
        // Fetch all practicantes (up to 1000 as per backend limit)
        const result = await practicanteApi.getAll('', 1, 1000);
        const allPracticantes = result.data || [];

        if (allPracticantes.length === 0) {
            alert('No hay practicantes para imprimir.');
            return;
        }

        let html = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h1>Listado General - Información de Salud</h1>
                <p>Fecha de reporte: ${new Date().toLocaleDateString('es-ES')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Nombre Completo</th>
                        <th>DNI</th>
                        <th>Fecha Nac.</th>
                        <th>Información de Salud (Méd/Alér/Med/Lim)</th>
                        <th>Contacto Emergencia</th>
                        <th>Servicio Emergencia</th>
                        <th>Obra Social / Afiliado</th>
                    </tr>
                </thead>
                <tbody>
                    ${allPracticantes.map(p => `
                        <tr>
                            <td><strong>${this.escapeHtml(p.nombre_completo)}</strong></td>
                            <td>${p.dni || '-'}</td>
                            <td>${p.fecha_nacimiento ? formatDateReadable(p.fecha_nacimiento) : '-'}</td>
                            <td>
                                ${p.condiciones_medicas ? `<b>Méd:</b> ${this.escapeHtml(p.condiciones_medicas)}<br>` : ''}
                                ${p.alergias ? `<b>Alérg:</b> ${this.escapeHtml(p.alergias)}<br>` : ''}
                                ${p.medicamentos ? `<b>Medic:</b> ${this.escapeHtml(p.medicamentos)}<br>` : ''}
                                ${p.limitaciones_fisicas ? `<b>Limit:</b> ${this.escapeHtml(p.limitaciones_fisicas)}` : ''}
                                ${!p.condiciones_medicas && !p.alergias && !p.medicamentos && !p.limitaciones_fisicas ? '-' : ''}
                            </td>
                            <td>
                                ${p.emergencia_nombre ? `${this.escapeHtml(p.emergencia_nombre)}<br>(${p.emergencia_telefono || 'S/T'})` : '-'}
                            </td>
                            <td>
                                ${p.emergencia_servicio ? `${this.escapeHtml(p.emergencia_servicio)}<br>(${p.emergencia_servicio_telefono || 'S/T'})` : '-'}
                            </td>
                            <td>
                                ${p.obra_social ? `${this.escapeHtml(p.obra_social)}<br>${p.obra_social_nro || 'S/N'}` : '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        printArea.innerHTML = html;
        window.print();
    } catch (error) {
        console.error('Error preparing print:', error);
        alert('Error al preparar el listado para imprimir.');
    } finally {
        this.container.querySelector('#print-all-btn').disabled = false;
        this.container.querySelector('#print-all-btn').innerHTML = originalText;
    }
  }

  formatGenero(genero) {
    const map = {
      'M': 'Masc.',
      'F': 'Fem.',
      'Otro': 'Otro',
      'Prefiero no decir': 'P.N.D.'
    };
    return map[genero] || genero || '-';
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
  }
}

export default PracticanteList;
