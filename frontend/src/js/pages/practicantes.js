/**
 * Practicantes Page
 * Main page for managing practicantes
 */

import PracticanteForm from '../components/PracticanteForm.js';
import PracticanteList from '../components/PracticanteList.js';
import PracticanteDetail from '../components/PracticanteDetail.js';
import PracticanteHistory from '../components/PracticanteHistory.js';
import { showSuccess, displayApiError } from '../utils/errors.js'; // Import displayApiError for error handling
import { practicanteApi } from '../api/client.js'; // Import practicanteApi to fetch individual practicante

export class PracticantesPage {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            initialPracticanteId: options.initialPracticanteId || null,
            openPaymentModalInitially: options.openPaymentModalInitially || false,
        };
        this.currentView = 'list'; // 'list', 'form', 'detail', 'history'
        this.selectedPracticante = null;
        this.currentPracticantesList = [];
        this.filterActivoState = 'active'; // 'active', 'inactive', 'all'
    }

    async render() {
        this.container.innerHTML = `
      <div id="practicantes-page">
        <div id="practicantes-header" class="flex justify-between items-center" style="margin-bottom: 2rem;">
          <h1>Gestión de Practicantes</h1>
          <div class="flex items-center space-x-4">
            <div class="relative inline-block text-left">
              <button type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" id="activo-filter-btn" aria-haspopup="true" aria-expanded="true">
                Estado: <span id="activo-filter-text">Activos</span>
                <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <div class="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 hidden" id="activo-filter-dropdown">
                <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="activo-filter-btn">
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem" data-filter="active">Activos</a>
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem" data-filter="inactive">Archivados</a>
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem" data-filter="all">Todos</a>
                </div>
              </div>
            </div>
            <button id="new-practicante-btn" class="btn">+ Nuevo Practicante</button>
          </div>
        </div>
        
        <div id="practicantes-content">
          <!-- Content will be dynamically loaded -->
        </div>
      </div>
    `;

        this.attachEvents();

        if (this.options.initialPracticanteId) {
            await this.loadAndShowPracticanteDetail(this.options.initialPracticanteId, this.options.openPaymentModalInitially);
        } else {
            this.showList();
        }
    }

    attachEvents() {
        const newBtn = this.container.querySelector('#new-practicante-btn');
        newBtn.addEventListener('click', () => {
            this.showForm();
        });

        const activoFilterBtn = this.container.querySelector('#activo-filter-btn');
        const activoFilterDropdown = this.container.querySelector('#activo-filter-dropdown');
        const activoFilterText = this.container.querySelector('#activo-filter-text');

        activoFilterBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            activoFilterDropdown.classList.toggle('hidden');
        });

        activoFilterDropdown.querySelectorAll('a').forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                this.filterActivoState = event.target.dataset.filter;
                activoFilterText.textContent = event.target.textContent;
                activoFilterDropdown.classList.add('hidden');
                this.showList(); // Refresh list with new filter
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!activoFilterDropdown.contains(event.target) && !activoFilterBtn.contains(event.target)) {
                activoFilterDropdown.classList.add('hidden');
            }
        });
    }

    async loadAndShowPracticanteDetail(practicanteId, openPaymentModal = false) {
        try {
            const response = await practicanteApi.getById(practicanteId);
            this.selectedPracticante = response.data;
            if (this.selectedPracticante) {
                this.showDetail(this.selectedPracticante, openPaymentModal);
            } else {
                displayApiError({ message: 'Practicante no encontrado.' }, this.container);
                this.showList(); // Fallback to list
            }
        } catch (error) {
            console.error('Error loading practicante detail:', error);
            displayApiError(error, this.container);
            this.showList(); // Fallback to list on error
        }
    }

    showList() {
        this.currentView = 'list';
        const content = this.container.querySelector('#practicantes-content');

        content.innerHTML = '<div id="list-container"></div><div id="detail-container" style="margin-top: 2rem;"></div>';

        const listContainer = content.querySelector('#list-container');
        const detailContainer = content.querySelector('#detail-container');

        const list = new PracticanteList(listContainer, {
            filterActivo: this.filterActivoState === 'active' ? true : (this.filterActivoState === 'inactive' ? false : undefined),
            onLoad: (list) => {
                this.currentPracticantesList = list;
            },
            onSelect: (practicante) => {
                this.selectedPracticante = practicante;
                this.showDetail(practicante);
            },
            onEdit: (practicante) => {
                this.showForm(practicante);
            },
            onDelete: () => {
                this.selectedPracticante = null;
                if (detailContainer) {
                    detailContainer.innerHTML = '';
                }
            },
            onPayAbono: (practicante) => { // Handle onPayAbono event
                this.selectedPracticante = practicante;
                this.showDetail(practicante, true); // Pass true to open payment modal
            },
            onReceiveCuota: (practicante) => {
                this.selectedPracticante = practicante;
                this.showDetail(practicante, false, true); // Pass true to open cuota modal
            },
            onShowHistory: (practicante) => {
                this.showHistory(practicante);
            }
        });

        list.render();
    }

    showForm(practicante = null) {
        this.currentView = 'form';
        const content = this.container.querySelector('#practicantes-content');

        content.innerHTML = '<div id="form-container"></div>';
        const formContainer = content.querySelector('#form-container');

        const form = new PracticanteForm(formContainer, {
            practicante: practicante,
            onSuccess: (data) => {
                const message = practicante
                    ? 'Practicante actualizado correctamente'
                    : 'Practicante creado correctamente';
                showSuccess(message, this.container);
                this.showList();
            },
            onCancel: () => {
                this.showList();
            }
        });

        form.render();
    }

    showDetail(practicante, openPaymentModal = false, openCuotaModal = false) { 
        this.currentView = 'detail';
        const content = this.container.querySelector('#practicantes-content');

        content.innerHTML = '<div id="detail-container"></div>';
        const detailContainer = content.querySelector('#detail-container');

        const currentIndex = this.currentPracticantesList.findIndex(p => p.id === practicante.id);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < this.currentPracticantesList.length - 1 && currentIndex !== -1;

        const detail = new PracticanteDetail(detailContainer, {
            onEdit: (p) => this.showForm(p),
            onClose: () => {
                this.showList();
            },
            onPrev: hasPrev ? () => {
                const prevPracticante = this.currentPracticantesList[currentIndex - 1];
                this.showDetail(prevPracticante);
            } : null,
            onNext: hasNext ? () => {
                const nextPracticante = this.currentPracticantesList[currentIndex + 1];
                this.showDetail(nextPracticante);
            } : null,
            openPaymentModal: openPaymentModal,
            openCuotaModal: openCuotaModal 
        });

        detail.render(practicante);
    }

    showHistory(practicante) {
        this.currentView = 'history';
        const content = this.container.querySelector('#practicantes-content');

        content.innerHTML = '<div id="history-container"></div>';
        const historyContainer = content.querySelector('#history-container');

        const history = new PracticanteHistory(historyContainer, {
            practicante: practicante,
            onClose: () => {
                this.showList();
            }
        });

        history.render();
    }
}

export default PracticantesPage;
