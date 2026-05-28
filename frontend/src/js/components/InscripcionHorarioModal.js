/**
 * InscripcionHorarioModal Component
 * Modal for managing weekly schedule inscriptions for a practicante
 */

import { makeRequest } from '../api/client.js';
import { displayApiError, showSuccess, showError } from '../utils/errors.js';

export class InscripcionHorarioModal {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            onClose: options.onClose || (() => {}),
            onSuccess: options.onSuccess || (() => {})
        };
        this.practicante = null;
    }

    render(practicante) {
        this.practicante = practicante;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('horarios-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div id="horarios-modal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header flex justify-between items-center" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem;">
                        <h2 style="margin: 0;">Inscripción a Horarios: ${this.escapeHtml(practicante.nombre_completo)}</h2>
                        <span class="close-button" id="close-horarios-modal" style="cursor: pointer; font-size: 1.5rem;">&times;</span>
                    </div>
                    
                    <div class="modal-body">
                        <p class="text-muted mb-4">Seleccione los horarios semanales a los que asiste el alumno habitualmente.</p>
                        <div id="horarios-inscripcion-list" class="card p-3 bg-light border">
                            <div class="loader text-center p-3">Cargando horarios disponibles...</div>
                        </div>
                    </div>

                    <div class="modal-footer flex gap-2 justify-end" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                        <button id="save-horarios-btn" class="btn btn-primary">Guardar Cambios</button>
                        <button id="cancel-horarios-btn" class="btn btn-secondary">Cancelar</button>
                    </div>
                </div>
            </div>

            <style>
                .modal {
                    display: none;
                    position: fixed;
                    z-index: 1000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                }
                .modal-content {
                    background-color: #fefefe;
                    margin: 5% auto;
                    padding: 20px;
                    border: 1px solid #888;
                    width: 90%;
                    max-width: 800px;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .close-button:hover {
                    color: var(--primary-color);
                }
                .hover-bg-light:hover {
                    background-color: #f8f9fa;
                }
            </style>
        `;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'horarios-modal-container';
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv);

        this.attachEvents(modalDiv);
        this.loadHorarios(modalDiv);
    }

    attachEvents(modalDiv) {
        const closeBtn = modalDiv.querySelector('#close-horarios-modal');
        const cancelBtn = modalDiv.querySelector('#cancel-horarios-btn');
        const saveBtn = modalDiv.querySelector('#save-horarios-btn');

        const closeModal = () => {
            modalDiv.remove();
            this.options.onClose();
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        saveBtn.addEventListener('click', async () => {
            await this.saveInscriptions(modalDiv);
        });

        // Close when clicking outside
        window.onclick = (event) => {
            if (event.target == modalDiv.querySelector('#horarios-modal')) {
                closeModal();
            }
        };
    }

    async loadHorarios(modalDiv) {
        const listContainer = modalDiv.querySelector('#horarios-inscripcion-list');
        
        try {
            const [horariosRes, inscripcionesRes] = await Promise.all([
                makeRequest('/horarios?activo=true&tipo=grupal', 'GET', null, true),
                makeRequest(`/horarios/practicante/${this.practicante.id}`, 'GET', null, true)
            ]);
            
            const horarios = horariosRes.data;
            const inscriptosIds = (inscripcionesRes.data || []).map(i => i.horario_id);
            
            if (horarios.length === 0) {
                listContainer.innerHTML = '<div class="text-center text-muted py-3">No hay horarios semanales activos configurados.</div>';
                return;
            }

            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            
            listContainer.innerHTML = `
                <div style="max-height: 400px; overflow-y: auto;">
                    ${horarios.map(h => `
                        <div class="form-check p-2 border-bottom hover-bg-light" style="display: flex; align-items: flex-start; gap: 0.75rem;">
                            <input class="horario-checkbox" type="checkbox" value="${h.id}" id="h-${h.id}" ${inscriptosIds.includes(h.id) ? 'checked' : ''} style="width: 1.25rem; height: 1.25rem; margin-top: 0.2rem; cursor: pointer;">
                            <label class="form-check-label" for="h-${h.id}" style="cursor: pointer; flex: 1;">
                                <div style="font-weight: 600;">
                                    ${dias[h.dia_semana]} ${h.hora_inicio.substring(0,5)} - ${h.hora_fin.substring(0,5)}
                                    <span class="badge ${h.tipo === 'grupal' ? 'badge-info' : 'badge-warning'}" style="font-size: 0.7rem; margin-left: 0.5rem; vertical-align: middle;">
                                        ${h.tipo.charAt(0).toUpperCase() + h.tipo.slice(1)}
                                    </span>
                                </div>
                                <div class="small text-muted">${this.escapeHtml(h.actividad_nombre)} | ${this.escapeHtml(h.lugar_nombre)}</div>
                                <div class="small text-muted">Profesor: ${this.escapeHtml(h.profesor_nombre || 'No asignado')}</div>
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            listContainer.innerHTML = '<div class="alert alert-danger">Error al cargar horarios</div>';
            console.error(error);
        }
    }

    async saveInscriptions(modalDiv) {
        const saveBtn = modalDiv.querySelector('#save-horarios-btn');
        const originalText = saveBtn.textContent;
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';

            const selectedHorarios = Array.from(modalDiv.querySelectorAll('.horario-checkbox:checked'))
                                          .map(cb => parseInt(cb.value, 10));
            
            await makeRequest(`/horarios/practicante/${this.practicante.id}`, 'POST', { horarioIds: selectedHorarios }, true);

            showSuccess('Horarios actualizados correctamente', document.body);
            modalDiv.remove();
            this.options.onSuccess();
        } catch (error) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            displayApiError(error, modalDiv.querySelector('.modal-content'));
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default InscripcionHorarioModal;
