import { formatDateWithDay } from '../utils/formatting.js';

export class ClaseList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onSelect: options.onSelect || (() => {}),
      onDelete: options.onDelete || (() => {}),
      onCloseClase: options.onCloseClase || (() => {}),
      onEdit: options.onEdit || (() => {})
    };
    this.clases = [];
  }

  setClases(clases) {
    this.clases = clases;
  }

  formatTipo(tipo) {
    if (tipo === 'grupal') {
        return 'Grupal (Horario fijo)';
    }
    return 'Particular/Compartida (Horario flexible)';
  }

  render() {
    const statusBadges = {
      'programada': 'badge-info',
      'realizada': 'badge-success',
      'cancelada': 'badge-danger',
      'suspendida': 'badge-warning',
      'cerrada': 'badge-dark',
      'sin_actividad': 'badge-secondary'
    };

    this.container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Horario</th>
              <th>Profesor</th>
              <th>Tipo</th>
              <th>Actividad</th>
              <th>Lugar</th>
              <th>Estado</th>
              <th>Asistentes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${this.clases.length === 0 ? '<tr><td colspan="9" class="text-center">No hay clases registradas en este periodo</td></tr>' : ''}
            ${this.clases.map(c => `
              <tr class="${c.estado === 'cancelada' || c.estado === 'suspendida' || c.estado === 'cerrada' || c.estado === 'sin_actividad' ? 'table-light text-muted' : ''}">
                <td><strong>${formatDateWithDay(c.fecha)}</strong></td>
                <td>${c.hora.substring(0, 5)} - ${c.hora_fin.substring(0, 5)}</td>
                <td><small>${c.profesor_nombre || '<span class="text-muted">No asignado</span>'}</small></td>
                <td>
                    <span class="badge ${c.tipo === 'grupal' ? 'badge-primary' : 'badge-info'}">
                        ${this.formatTipo(c.tipo)}
                    </span>
                </td>
                <td>${c.actividad_nombre || '-'}</td>
                <td>${c.lugar_nombre || '-'}</td>
                <td>
                  <span class="badge ${statusBadges[c.estado] || 'badge-secondary'}">
                    ${(c.estado === 'sin_actividad' ? 'Sin Actividad' : c.estado.charAt(0).toUpperCase() + c.estado.slice(1))}
                  </span>
                  ${c.pago_espacio_realizado ? `
                    <span class="badge badge-success ml-1" title="Costo de espacio pagado">
                      <i class="fas fa-check-circle"></i> Pagada
                    </span>
                  ` : ''}
                </td>
                <td>
                  ${c.estado === 'cancelada' || c.estado === 'suspendida' || c.estado === 'sin_actividad' ? '-' : `
                    <span class="badge ${c.asistentes_count > 0 ? 'badge-primary' : 'badge-light'}">
                      ${c.asistentes_count} presentes
                    </span>
                  `}
                </td>
                <td>
                  ${c.estado !== 'cerrada' ? `
                    <div class="d-flex flex-column gap-1">
                      <button class="btn ${c.estado === 'programada' ? 'btn-primary' : 'btn-secondary'} btn-sm attendance-btn" data-id="${c.id}">
                        ${c.estado === 'programada' ? 'Tomar Asistencia' : 'Gestionar'}
                      </button>
                      <button class="btn btn-outline-primary btn-sm edit-btn" data-id="${c.id}">
                        <i class="fas fa-edit"></i> Editar
                      </button>
                      ${c.estado === 'realizada' ? `
                        <button class="btn btn-dark btn-sm close-btn" data-id="${c.id}">
                          Cerrar
                        </button>
                      ` : ''}
                      ${!c.pago_espacio_realizado ? `
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${c.id}">
                          Eliminar
                        </button>
                      ` : ''}
                    </div>
                  ` : `
                    <button class="btn btn-outline-secondary btn-sm attendance-btn" data-id="${c.id}">
                      Ver Detalles
                    </button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    this.container.querySelectorAll('.attendance-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'), 10);
        const clase = this.clases.find(c => c.id === id);
        this.options.onSelect(clase);
      });
    });

    this.container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.target.closest('.edit-btn').getAttribute('data-id'), 10);
          const clase = this.clases.find(c => c.id === id);
          this.options.onEdit(clase);
        });
      });

    this.container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'), 10);
        if (confirm('¿Está seguro de que desea eliminar esta sesión de clase? No afectará al horario semanal.')) {
          this.options.onDelete(id);
        }
      });
    });

    this.container.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'), 10);
        if (confirm('¿Está seguro de que desea cerrar esta clase? Una vez cerrada, no se podrán realizar más modificaciones en la asistencia ni en los datos de la clase.')) {
          this.options.onCloseClase(id);
        }
      });
    });
  }
}

export default ClaseList;
