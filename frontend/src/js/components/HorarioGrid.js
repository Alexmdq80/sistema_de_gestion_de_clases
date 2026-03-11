import { formatTime } from '../utils/formatting.js';

export class HorarioGrid {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onEdit: options.onEdit || (() => {}),
      onDelete: options.onDelete || (() => {}),
      onShowHistory: options.onShowHistory || (() => {})
    };
    this.horarios = [];
    // We display Monday to Sunday (1 to 0 in JS Date, but we'll map 1-6, 0)
    // Actually, let's use a standard 1-7 (Mon-Sun) or just the array index from the model
    // The model uses 0 for Sunday, 1 for Monday, etc.
    this.diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.diasOrdenados = [1, 2, 3, 4, 5, 6, 0]; // Lunes a Domingo
  }

  setHorarios(horarios) {
    this.horarios = horarios;
  }

  render() {
    // Calculate hour range
    let minHour = 8;
    let maxHour = 22;

    this.horarios.forEach(h => {
      const start = parseInt(h.hora_inicio.split(':')[0], 10);
      const end = parseInt(h.hora_fin.split(':')[0], 10);
      if (start < minHour) minHour = start;
      if (end > maxHour) maxHour = end;
    });

    const hours = [];
    for (let i = minHour; i <= maxHour; i++) {
      hours.push(i);
    }

    this.container.innerHTML = `
      <div class="horario-grid-container mt-4">
        <div class="table-responsive">
          <table class="table table-bordered table-sm horario-grid">
            <thead>
              <tr>
                <th style="width: 80px;">Hora</th>
                ${this.diasOrdenados.map(d => `<th>${this.diasSemana[d]}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${hours.map(h => `
                <tr>
                  <td class="text-muted font-weight-bold" style="background: #f8fafc;">
                    ${String(h).padStart(2, '0')}:00
                  </td>
                  ${this.diasOrdenados.map(d => {
                    const classesInSlot = this.getClassesForSlot(d, h);
                    return `
                      <td class="grid-slot" data-day="${d}" data-hour="${h}">
                        ${classesInSlot.map(c => this.renderClassCard(c)).join('')}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <style>
        .horario-grid th { text-align: center; background: #f1f5f9; }
        .horario-grid td { height: 60px; vertical-align: top; padding: 2px !important; }
        .grid-slot { position: relative; min-width: 120px; }
        .class-card {
          background: #e0e7ff;
          border-left: 4px solid #4338ca;
          padding: 4px 8px;
          margin-bottom: 2px;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
          color: #1e1b4b;
        }
        .class-card:hover { transform: scale(1.02); z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .class-card.flexible { 
          border-left-color: #059669; 
          background: #dcfce7; 
          color: #064e3b;
        }
        .class-card.inactivo { opacity: 0.5; filter: grayscale(1); border-left-color: #94a3b8; }
        .class-card-title { font-weight: bold; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .class-card-time { color: inherit; opacity: 0.8; font-size: 0.7rem; }
        .class-card-lugar { display: block; font-style: italic; opacity: 0.8; }

        @media print {
          .horario-grid { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; }
          .horario-grid th, .horario-grid td { border: 1px solid #000 !important; color: #000 !important; font-size: 9px !important; }
          .horario-grid td { height: 40px !important; }
          .class-card {
             border: 1px solid #000 !important; 
             border-left: 5px solid #000 !important;
             background: #eee !important;
             color: #000 !important;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }
          .class-card.flexible { background: #f9f9f9 !important; }
        }
      </style>
    `;

    this.attachEvents();
  }

  getClassesForSlot(day, hour) {
    return this.horarios.filter(h => {
      if (h.dia_semana !== day) return false;
      const startH = parseInt(h.hora_inicio.split(':')[0], 10);
      const endH = parseInt(h.hora_fin.split(':')[0], 10);
      const endM = parseInt(h.hora_fin.split(':')[1], 10);
      
      // A class is in this slot if its start hour matches the slot hour
      // OR if it's a long class spanning this hour
      if (startH === hour) return true;
      if (hour > startH && hour < endH) return true;
      // If it ends exactly at the start of the next hour (e.g. 19:00), it's NOT in the 19:00 slot
      if (hour === endH && endM > 0) return true;
      
      return false;
    });
  }

  renderClassCard(h) {
    const isFlexible = h.tipo === 'flexible';
    return `
      <div class="class-card ${isFlexible ? 'flexible' : ''} ${!h.activo ? 'inactivo' : ''}" data-id="${h.id}" title="${h.actividad_nombre} - ${h.profesor_nombre || 'Sin asignar'}">
        <span class="class-card-title">${h.actividad_nombre}</span>
        <span class="class-card-time">${h.hora_inicio.substring(0, 5)} - ${h.hora_fin.substring(0, 5)}</span>
        <span class="class-card-lugar"><small>${h.lugar_nombre}</small></span>
      </div>
    `;
  }

  attachEvents() {
    this.container.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = parseInt(card.getAttribute('data-id'), 10);
        const horario = this.horarios.find(h => h.id === id);
        this.options.onEdit(horario);
      });
    });
  }
}

export default HorarioGrid;
