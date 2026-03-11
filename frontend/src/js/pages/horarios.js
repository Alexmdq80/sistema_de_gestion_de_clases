import { apiClient } from '../api/client.js';
import { displayApiError, showSuccess } from '../utils/errors.js';
import { HorarioList } from '../components/HorarioList.js';
import { HorarioForm } from '../components/HorarioForm.js';
import { HorarioGrid } from '../components/HorarioGrid.js';

export class HorariosPage {
  constructor(container) {
    this.container = container;
    this.currentView = 'list'; // 'list', 'grid', 'form'
    this.selectedHorario = null;
    this.filters = {
      actividad_id: '',
      lugar_id: '',
      dia_semana: ''
    };
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-header">
        <h1>Gestión de Horarios Semanales</h1>
        <div class="actions btn-group">
          <button id="view-list-btn" class="btn ${this.currentView === 'list' ? 'btn-primary' : 'btn-outline-primary'} no-print">Listado</button>
          <button id="view-grid-btn" class="btn ${this.currentView === 'grid' ? 'btn-primary' : 'btn-outline-primary'} no-print">Grilla Semanal</button>
          <button id="print-horarios-btn" class="btn btn-outline-secondary ml-2 no-print" title="Imprimir Grilla">
            <i class="fas fa-print"></i> Imprimir
          </button>
          <button id="new-horario-btn" class="btn btn-success ml-2 no-print">+ Nuevo Horario</button>
        </div>
      </div>
      
      <div id="horarios-content">
        <!-- Content will be rendered here -->
      </div>
    `;

    this.attachEvents();
    await this.renderView();
  }

  async renderView() {
    const content = this.container.querySelector('#horarios-content');
    
    if (this.currentView === 'list' || this.currentView === 'grid') {
      content.innerHTML = '<div class="loader">Cargando horarios...</div>';
      try {
        const response = await apiClient.get('/horarios', this.filters);
        
        if (this.currentView === 'list') {
          const list = new HorarioList(content, {
            onEdit: (horario) => {
              this.selectedHorario = horario;
              this.currentView = 'form';
              this.renderView();
            },
            onDelete: async (id) => {
              try {
                await apiClient.delete(`/horarios/${id}`);
                showSuccess('Horario eliminado');
                this.renderView();
              } catch (error) {
                displayApiError(error);
              }
            },
            onShowHistory: (horario) => {
              alert('Historial de: ' + horario.actividad_nombre);
            }
          });
          list.setHorarios(response.data);
          list.render();
        } else {
          const grid = new HorarioGrid(content, {
            onEdit: (horario) => {
              this.selectedHorario = horario;
              this.currentView = 'form';
              this.renderView();
            }
          });
          grid.setHorarios(response.data);
          grid.render();
        }
      } catch (error) {
        displayApiError(error);
      }
    } else if (this.currentView === 'form') {
      const form = new HorarioForm(content, {
        horario: this.selectedHorario,
        onSuccess: () => {
          this.currentView = 'list';
          this.selectedHorario = null;
          this.renderView();
        },
        onCancel: () => {
          this.currentView = 'list';
          this.selectedHorario = null;
          this.renderView();
        }
      });
      await form.render();
    }
  }

  attachEvents() {
    const listBtn = this.container.querySelector('#view-list-btn');
    const gridBtn = this.container.querySelector('#view-grid-btn');
    const printBtn = this.container.querySelector('#print-horarios-btn');
    const newBtn = this.container.querySelector('#new-horario-btn');

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    if (listBtn) {
      listBtn.addEventListener('click', () => {
        this.currentView = 'list';
        this.render();
      });
    }

    if (gridBtn) {
      gridBtn.addEventListener('click', () => {
        this.currentView = 'grid';
        this.render();
      });
    }

    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.selectedHorario = null;
        this.currentView = 'form';
        this.renderView();
      });
    }
  }
}

export default HorariosPage;
