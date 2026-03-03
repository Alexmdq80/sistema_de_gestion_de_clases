/**
 * TipoAbonoForm Component
 * Form for creating and editing tipos de abono
 */

import { validateField, clearFieldError, showFieldError } from '../utils/validation.js';
import { displayApiError, showError } from '../utils/errors.js';
import { makeRequest } from '../api/client.js';
import { formatTime } from '../utils/formatting.js';

export class TipoAbonoForm {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onSuccess: options.onSuccess || (() => {}),
      onCancel: options.onCancel || (() => {}),
      tipoAbono: options.tipoAbono || null
    };
    this.isEditing = !!this.options.tipoAbono;
    this.horarios = [];
    this.lugares = [];
  }

  async loadInitialData() {
    try {
      const [horariosRes, lugaresRes] = await Promise.all([
        makeRequest('/horarios', 'GET', null, true),
        makeRequest('/lugares', 'GET', null, true)
      ]);
      this.horarios = horariosRes.data || [];
      this.lugares = lugaresRes.data || [];
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  }

  async render() {
    await this.loadInitialData();
    const tipoAbono = this.options.tipoAbono || { horarios: [], categoria: 'grupal' };
    
    // Identify which IDs are parents (have children) for the location filter
    const parentIds = new Set(this.lugares.filter(l => l.parent_id).map(l => l.parent_id));
    const filteredLugares = this.lugares.filter(l => {
        const isParentWithChildren = !l.parent_id && parentIds.has(l.id);
        return !isParentWithChildren;
    });

    this.container.innerHTML = `
      <form id="tipo-abono-form" class="card">
        <div class="card-header">
          <h2 class="card-title">${this.isEditing ? 'Editar Tipo de Abono' : 'Nuevo Tipo de Abono'}</h2>
        </div>
        
        <div class="form-group">
          <label for="nombre">Nombre *</label>
          <input 
            type="text" 
            id="nombre" 
            name="nombre" 
            value="${tipoAbono.nombre || ''}"
            required
          />
        </div>

        <div class="form-group">
          <label for="categoria">Tipo de Abono *</label>
          <select id="categoria" name="categoria" required>
            <option value="grupal" ${tipoAbono.categoria === 'grupal' ? 'selected' : ''}>Grupal (con horarios fijos)</option>
            <option value="particular" ${tipoAbono.categoria === 'particular' ? 'selected' : ''}>Particular (agenda flexible)</option>
            <option value="compartida" ${tipoAbono.categoria === 'compartida' ? 'selected' : ''}>Compartida (2 o más personas)</option>
            <option value="otro" ${tipoAbono.categoria === 'otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>

        <div id="lugar-group" class="form-group" style="display: none;">
          <label for="lugar_id">Lugar / Sede *</label>
          <select class="form-control" id="lugar_id" name="lugar_id">
            <option value="">Seleccione un lugar</option>
            ${filteredLugares.map(l => `<option value="${l.id}" ${tipoAbono.lugar_id == l.id ? 'selected' : ''}>${l.nombre}${l.parent_nombre ? ` (${l.parent_nombre})` : ''}</option>`).join('')}
          </select>
          <small class="text-muted">Para abonos flexibles, es necesario definir el lugar de validez.</small>
        </div>

        <div class="form-group">
          <label for="descripcion">Descripción</label>
          <textarea 
            id="descripcion" 
            name="descripcion" 
            rows="2"
          >${tipoAbono.descripcion || ''}</textarea>
        </div>

        <div class="grid grid-4 gap-2">
          <div id="duracion-group" class="form-group">
            <label for="duracion_dias">Duración (días)</label>
            <input 
              type="number" 
              id="duracion_dias" 
              name="duracion_dias" 
              value="${tipoAbono.duracion_dias !== undefined ? tipoAbono.duracion_dias : ''}"
              min="0"
            />
            <small class="text-muted">0: clases sueltas.</small>
          </div>

          <div id="clases-por-semana-group" class="form-group">
            <label for="clases_por_semana">Clases x Sem</label>
            <input 
              type="number" 
              id="clases_por_semana" 
              name="clases_por_semana" 
              value="${tipoAbono.clases_por_semana || 1}"
              min="1"
            />
          </div>

          <div id="max-personas-group" class="form-group" style="display: none;">
            <label for="max_personas">¿Entre cuántos?</label>
            <input 
              type="number" 
              id="max_personas" 
              name="max_personas" 
              value="${tipoAbono.max_personas || 2}"
              min="2"
            />
          </div>

          <div class="form-group">
            <label for="precio">Precio ($)</label>
            <input 
              type="number" 
              id="precio" 
              name="precio" 
              value="${tipoAbono.precio !== null && tipoAbono.precio !== undefined ? tipoAbono.precio : ''}"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        <div id="horarios-group" class="form-group">
          <label>Horarios Asociados</label>
          <div class="horarios-selection card" style="max-height: 200px; overflow-y: auto; padding: 0.5rem;">
            ${this.horarios.length > 0 ? this.horarios.map(h => `
                <div class="flex items-center gap-2" style="margin-bottom: 0.25rem;">
                    <input type="checkbox" name="horarios" value="${h.id}" id="h-${h.id}" 
                        ${tipoAbono.horarios.includes(h.id) ? 'checked' : ''} style="width: auto;">
                    <label for="h-${h.id}" style="margin-bottom: 0; font-weight: normal; cursor: pointer;">
                        <strong>${this.formatDia(h.dia_semana)}</strong>: ${formatTime(h.hora_inicio)} - ${h.actividad_nombre} (${h.lugar_nombre})
                    </label>
                </div>
            `).join('') : '<p class="text-muted">No hay horarios configurados.</p>'}
          </div>
          <small class="text-muted">Seleccione los horarios en los que este abono es válido.</small>
        </div>

        <div class="flex gap-2" style="margin-top: 1rem;">
          <button type="submit" class="btn">${this.isEditing ? 'Actualizar' : 'Guardar'}</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Cancelar</button>
        </div>
      </form>
    `;

    this.attachEvents();
    this.toggleFields();
  }

  toggleFields() {
    const form = this.container.querySelector('#tipo-abono-form');
    const categoriaSelect = form.querySelector('#categoria');
    const horariosGroup = form.querySelector('#horarios-group');
    const clasesPorSemanaGroup = form.querySelector('#clases-por-semana-group');
    const duracionGroup = form.querySelector('#duracion-group');
    const maxPersonasGroup = form.querySelector('#max-personas-group');
    const lugarGroup = form.querySelector('#lugar-group');
    const lugarSelect = form.querySelector('#lugar_id');

    const updateVisibility = () => {
        const val = categoriaSelect.value;
        if (val === 'particular' || val === 'compartida') {
            horariosGroup.style.display = 'none';
            clasesPorSemanaGroup.style.display = 'none';
            duracionGroup.style.display = 'none';
            maxPersonasGroup.style.display = val === 'compartida' ? 'block' : 'none';
            lugarGroup.style.display = 'block';
            lugarSelect.required = true;
        } else { // grupal / otro
            horariosGroup.style.display = 'block';
            clasesPorSemanaGroup.style.display = 'block';
            duracionGroup.style.display = 'block';
            maxPersonasGroup.style.display = 'none';
            lugarGroup.style.display = 'none';
            lugarSelect.required = false;
            clearFieldError(lugarSelect);
        }
    };

    categoriaSelect.addEventListener('change', updateVisibility);
    updateVisibility();
  }

  formatDia(dia) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[dia] || dia;
  }

  attachEvents() {
    const form = this.container.querySelector('#tipo-abono-form');
    const cancelBtn = this.container.querySelector('#cancel-btn');

    // Form validation on blur
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('blur', () => {
        this.validateField(input);
      });

      input.addEventListener('input', () => {
        clearFieldError(input);
      });
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.validateForm()) {
        await this.submitForm();
      }
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
      this.options.onCancel();
    });
  }

  validateField(input) {
    const rules = [];
    
    if (input.hasAttribute('required')) {
      rules.push('required');
    }
    
    const error = validateField(input, rules);
    if (error) {
      showFieldError(input, error);
      return false;
    } else {
      clearFieldError(input);
      return true;
    }
  }

  validateForm() {
    const form = this.container.querySelector('#tipo-abono-form');
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    
    let isValid = true;
    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });
    return isValid;
  }

  getFormData() {
    const form = this.container.querySelector('#tipo-abono-form');
    const formData = new FormData(form);
    const data = {
        horarios: []
    };
    
    // Get all checkboxes values for horarios
    const checkboxes = form.querySelectorAll('input[name="horarios"]:checked');
    checkboxes.forEach(cb => {
        data.horarios.push(parseInt(cb.value, 10));
    });

    for (const [key, value] of formData.entries()) {
      if (key === 'horarios') continue; // Handled above

      if (value !== null && value.trim() !== '') {
        // Handle numbers
        if (key === 'duracion_dias' || key === 'clases_por_semana' || key === 'max_personas' || key === 'lugar_id') {
            data[key] = parseInt(value, 10);
        } else if (key === 'precio') {
            data[key] = parseFloat(value);
        } else {
            data[key] = value.trim();
        }
      } else {
        data[key] = null;
      }
    }

    return data;
  }

  async submitForm() {
    const form = this.container.querySelector('#tipo-abono-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';

      const data = this.getFormData();
      let result;

      if (this.isEditing) {
        result = await makeRequest(`/tipos-abono/${this.options.tipoAbono.id}`, 'PUT', data, true);
      } else {
        result = await makeRequest('/tipos-abono', 'POST', data, true);
      }

      submitBtn.disabled = false;
      submitBtn.textContent = this.isEditing ? 'Actualizar' : 'Guardar';
      
      this.options.onSuccess(result.data);
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = this.isEditing ? 'Actualizar' : 'Guardar';
      
      if (error.status === 400 && error.details) {
        displayApiError(error, this.container);
      } else {
        showError('Error al guardar el tipo de abono. Por favor, intente nuevamente.', this.container);
      }
    }
  }
}

export default TipoAbonoForm;
