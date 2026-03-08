/**
 * PracticanteForm Component
 * Form for creating and editing practicantes
 */

import { validateField, clearFieldError, showFieldError } from '../utils/validation.js';
import { displayApiError, showError } from '../utils/errors.js';
import { makeRequest } from '../api/client.js';
import { formatDate } from '../utils/formatting.js';

export class PracticanteForm {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onSuccess: options.onSuccess || (() => {}),
      onCancel: options.onCancel || (() => {}),
      practicante: options.practicante || null
    };
    this.isEditing = !!this.options.practicante;
  }

  render() {
    const practicante = this.options.practicante || {};
    
    this.container.innerHTML = `
      <div class="form-container-centered" style="display: flex; justify-content: center; width: 100%;">
        <form id="practicante-form" class="card" style="width: 80%; max-width: 800px; margin: 2rem 0;">
          <div class="card-header">
            <h2 class="card-title" style="font-size: 2rem; color: var(--primary-color);">
              ${this.isEditing ? `Editar: ${this.escapeHtml(practicante.nombre_completo)}` : 'Nuevo Practicante'}
            </h2>
          </div>
          
          <div class="form-body" style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-group">
              <label for="nombre_completo">Nombre Completo *</label>
              <input 
                type="text" 
                id="nombre_completo" 
                name="nombre_completo" 
                class="form-control"
                value="${practicante.nombre_completo || ''}"
                required
              />
            </div>

            <div class="form-group">
              <label for="dni">DNI (Documento Nacional de Identidad)</label>
              <input 
                type="text" 
                id="dni" 
                name="dni" 
                class="form-control"
                value="${practicante.dni || ''}"
                placeholder="Ej: 12.345.678"
              />
            </div>

            <div class="form-group">
              <label for="fecha_nacimiento">Fecha de Nacimiento</label>
              <input 
                type="date" 
                id="fecha_nacimiento" 
                name="fecha_nacimiento" 
                class="form-control"
                value="${formatDate(practicante.fecha_nacimiento)}"
              />
            </div>

            <div class="form-group">
              <label for="genero">Género</label>
              <select id="genero" name="genero" class="form-control">
                <option value="">Seleccionar...</option>
                <option value="M" ${practicante.genero === 'M' ? 'selected' : ''}>Masculino</option>
                <option value="F" ${practicante.genero === 'F' ? 'selected' : ''}>Femenino</option>
                <option value="Otro" ${practicante.genero === 'Otro' ? 'selected' : ''}>Otro</option>
                <option value="Prefiero no decir" ${practicante.genero === 'Prefiero no decir' ? 'selected' : ''}>Prefiero no decir</option>
              </select>
            </div>

            <div class="form-group">
              <label for="telefono">Teléfono *</label>
              <input 
                type="tel" 
                id="telefono" 
                name="telefono" 
                class="form-control"
                value="${practicante.telefono || ''}"
                placeholder="+1234567890"
              />
            </div>

            <div class="form-group">
              <label for="email">Email *</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                class="form-control"
                value="${practicante.email || ''}"
                placeholder="usuario@example.com"
              />
            </div>

            <div class="form-group">
              <label for="direccion">Dirección</label>
              <textarea 
                id="direccion" 
                name="direccion" 
                class="form-control"
                rows="2"
              >${practicante.direccion || ''}</textarea>
            </div>

            <div class="form-group">
              <label for="condiciones_medicas">Condiciones Médicas</label>
              <textarea 
                id="condiciones_medicas" 
                name="condiciones_medicas" 
                class="form-control"
                rows="2"
              >${practicante.condiciones_medicas || ''}</textarea>
            </div>

            <div class="form-group">
              <label for="medicamentos">Medicamentos</label>
              <textarea 
                id="medicamentos" 
                name="medicamentos" 
                class="form-control"
                rows="2"
              >${practicante.medicamentos || ''}</textarea>
            </div>

            <div class="form-group">
              <label for="limitaciones_fisicas">Limitaciones Físicas</label>
              <textarea 
                id="limitaciones_fisicas" 
                name="limitaciones_fisicas" 
                class="form-control"
                rows="2"
              >${practicante.limitaciones_fisicas || ''}</textarea>
            </div>

            <div class="form-group">
              <label for="alergias">Alergias</label>
              <textarea 
                id="alergias" 
                name="alergias" 
                class="form-control"
                rows="2"
              >${practicante.alergias || ''}</textarea>
            </div>

            <h3 class="section-title mt-4 mb-2" style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem;">Contacto de Emergencia</h3>
            
            <div class="form-group">
              <label for="emergencia_nombre">Nombre de Contacto</label>
              <input type="text" id="emergencia_nombre" name="emergencia_nombre" class="form-control" value="${practicante.emergencia_nombre || ''}" />
            </div>
            
            <div class="form-group">
              <label for="emergencia_telefono">Teléfono de Contacto</label>
              <input type="tel" id="emergencia_telefono" name="emergencia_telefono" class="form-control" value="${practicante.emergencia_telefono || ''}" />
            </div>

            <div class="form-group">
              <label for="obra_social">Obra Social</label>
              <input type="text" id="obra_social" name="obra_social" class="form-control" value="${practicante.obra_social || ''}" />
            </div>
            
            <div class="form-group">
              <label for="obra_social_nro">Nro. de Afiliado</label>
              <input type="text" id="obra_social_nro" name="obra_social_nro" class="form-control" value="${practicante.obra_social_nro || ''}" />
            </div>

            <div class="form-group">
              <label for="emergencia_servicio">Servicio de Emergencia</label>
              <input type="text" id="emergencia_servicio" name="emergencia_servicio" class="form-control" value="${practicante.emergencia_servicio || ''}" />
            </div>
            
            <div class="form-group">
              <label for="emergencia_servicio_telefono">Teléfono Servicio Emerg.</label>
              <input type="tel" id="emergencia_servicio_telefono" name="emergencia_servicio_telefono" class="form-control" value="${practicante.emergencia_servicio_telefono || ''}" />
            </div>

            <h3 class="section-title mt-4 mb-2" style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem;">Información Adicional</h3>
            
            <div class="form-group">
              <label for="ocupacion">Ocupación</label>
              <input type="text" id="ocupacion" name="ocupacion" class="form-control" value="${practicante.ocupacion || ''}" />
            </div>
            
            <div class="form-group">
              <label for="estudios">Estudios</label>
              <input type="text" id="estudios" name="estudios" class="form-control" value="${practicante.estudios || ''}" />
            </div>

            <div class="form-group checkbox-group mb-3">
              <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                <input type="checkbox" id="actividad_fisica_actual" name="actividad_fisica_actual" style="width: 1.25rem; height: 1.25rem;" ${practicante.actividad_fisica_actual ? 'checked' : ''} />
                <span style="font-weight: 500;">¿Realiza actividad física actualmente?</span>
              </label>
            </div>

            <div id="actividad-fisica-si" style="display: ${practicante.actividad_fisica_actual ? 'block' : 'none'}">
              <div class="form-group">
                <label for="actividad_fisica_detalle">¿Qué actividad realiza?</label>
                <textarea id="actividad_fisica_detalle" name="actividad_fisica_detalle" class="form-control" rows="2">${practicante.actividad_fisica_detalle || ''}</textarea>
              </div>
            </div>

            <div id="actividad-fisica-no" style="display: ${practicante.actividad_fisica_actual ? 'none' : 'block'}">
              <div class="form-group">
                <label for="actividad_fisica_anios_inactivo">Años sin realizar actividad física</label>
                <input type="number" id="actividad_fisica_anios_inactivo" name="actividad_fisica_anios_inactivo" class="form-control" value="${practicante.actividad_fisica_anios_inactivo || ''}" />
              </div>
              <div class="form-group">
                <label for="actividad_fisica_anterior">¿Qué actividades realizaba anteriormente?</label>
                <textarea id="actividad_fisica_anterior" name="actividad_fisica_anterior" class="form-control" rows="2">${practicante.actividad_fisica_anterior || ''}</textarea>
              </div>
            </div>

            <div class="form-group">
              <label for="observaciones_adicionales">Otras observaciones importantes</label>
              <textarea id="observaciones_adicionales" name="observaciones_adicionales" class="form-control" rows="3">${practicante.observaciones_adicionales || ''}</textarea>
            </div>

            <div class="form-actions flex gap-2" style="justify-content: center; padding-top: 1rem; border-top: 1px solid var(--border-color); margin-top: 1rem;">
              <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem;">${this.isEditing ? 'Actualizar Cambios' : 'Guardar Practicante'}</button>
              <button type="button" class="btn btn-secondary" id="cancel-btn" style="padding: 0.75rem 2rem; font-size: 1rem;">Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const form = this.container.querySelector('#practicante-form');
    const cancelBtn = this.container.querySelector('#cancel-btn');
    const actividadActualCheckbox = form.querySelector('#actividad_fisica_actual');
    const actividadSiDiv = form.querySelector('#actividad-fisica-si');
    const actividadNoDiv = form.querySelector('#actividad-fisica-no');

    // Toggle activity fields
    actividadActualCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        actividadSiDiv.style.display = 'block';
        actividadNoDiv.style.display = 'none';
      } else {
        actividadSiDiv.style.display = 'none';
        actividadNoDiv.style.display = 'block';
      }
    });

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
    
    if (input.type === 'email') {
      rules.push('email');
    }
    
    if (input.type === 'tel') {
      rules.push('phone');
    }
    
    if (input.type === 'date') {
      rules.push('date');
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
    const form = this.container.querySelector('#practicante-form');
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    
    let isValid = true;
    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });

    // Validate at least one of telefono or email
    const telefono = form.querySelector('#telefono').value.trim();
    const email = form.querySelector('#email').value.trim();
    
    if (!telefono && !email) {
      showError('Al menos uno de teléfono o email debe estar presente', this.container);
      isValid = false;
    }

    return isValid;
  }

  getFormData() {
    const form = this.container.querySelector('#practicante-form');
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        if (value.trim() !== '') {
          data[key] = value.trim();
        } else {
          data[key] = null;
        }
      } else {
        data[key] = value;
      }
    }

    // Handle checkbox (FormData doesn't include unchecked checkboxes)
    data.actividad_fisica_actual = !!form.querySelector('#actividad_fisica_actual').checked;

    return data;
  }

  async submitForm() {
    const form = this.container.querySelector('#practicante-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';

      const data = this.getFormData();
      let result;

      if (this.isEditing) {
        result = await makeRequest(`/practicantes/${this.options.practicante.id}`, 'PUT', data, true); // Use makeRequest
      } else {
        result = await makeRequest('/practicantes', 'POST', data, true); // Use makeRequest
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
        showError('Error al guardar el practicante. Por favor, intente nuevamente.', this.container);
      }
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default PracticanteForm;
