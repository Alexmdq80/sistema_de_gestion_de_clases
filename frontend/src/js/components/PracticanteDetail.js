/**
 * PracticanteDetail Component
 * Display detailed information about a practicante
 */

import { formatDateReadable } from '../utils/formatting.js';
import { makeRequest } from '../api/client.js'; // Import makeRequest
import { showSuccess, displayApiError } from '../utils/errors.js'; // Import success and error messages

export class PracticanteDetail {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onEdit: options.onEdit || (() => {}),
      onClose: options.onClose || (() => {}),
      openPaymentModal: options.openPaymentModal || false, 
      openCuotaModal: options.openCuotaModal || false 
    };

    this.practicante = null;
    this.tiposAbono = []; // To store available subscription types
    this.lugares = []; // To store available locations
    this.socios = []; // To store socio status for the practicante
    this.isEditingPayment = false;
    this.currentPagoId = null;
  }

  async render(practicante) {
    this.practicante = practicante;

    if (!practicante) {
      this.container.innerHTML = '<p class="text-muted">Seleccione un practicante para ver sus detalles</p>';
      return;
    }

    // Fetch tipos de abono, lugares and socio status for the payment modal
    try {
        const [tiposRes, lugaresRes, sociosRes] = await Promise.all([
            makeRequest('/tipos-abono', 'GET', null, true),
            makeRequest('/lugares', 'GET', null, true),
            makeRequest(`/socios?practicante_id=${practicante.id}`, 'GET', null, true)
        ]);
        this.tiposAbono = tiposRes.data;
        this.lugares = lugaresRes.data || [];
        this.socios = sociosRes.data || [];
    } catch (error) {
        console.error('Error fetching data for payment modal:', error);
    }

    this.container.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h2 class="card-title">Detalles del Practicante</h2>
          <div class="flex gap-2">
            <button id="edit-btn" class="btn">Editar</button>
            <button id="receive-cuota-btn" class="btn btn-success" style="display: none;">Recibir Cuota Social</button>
            <button id="pay-abono-btn" class="btn btn-primary">Pagar Abono</button>
            <button id="close-btn" class="btn btn-secondary">Cerrar</button>
          </div>
...
      <!-- Receive Cuota Social Modal -->
      <div id="cuota-modal" class="modal">
        <div class="modal-content">
          <span class="close-cuota-modal close-button">&times;</span>
          <h2>Recibir Pago de Cuota Social</h2>
          
          <div id="cuota-duplicate-warning" class="alert alert-warning" style="display: none;">
              <i class="fas fa-exclamation-triangle"></i> <strong>Atención:</strong> Ya existe un registro para este mes y año. No se permite duplicar el cobro.
          </div>

          <form id="receive-cuota-form">
            <div class="form-group">
                <label for="cuota-lugar-select">Lugar / Institución:</label>
                <select id="cuota-lugar-select" name="lugar_id" required>
                    <!-- Options populated dynamically -->
                </select>
            </div>

            <div class="form-group">
                <label for="cuota-monto-select">Importe Recibido:</label>
                <select id="cuota-monto-select" name="monto" required>
                    <!-- Options populated based on selected lugar -->
                </select>
            </div>

            <div class="form-group">
                <label for="cuota-fecha-input">Fecha de Pago:</label>
                <input type="date" id="cuota-fecha-input" name="fecha_pago" required />
            </div>

            <div class="form-row flex gap-2">
                <div class="form-group" style="flex: 1;">
                    <label>Mes:</label>
                    <select id="cuota-mes-select" class="form-control" required>
                        <option value="Enero">Enero</option>
                        <option value="Febrero">Febrero</option>
                        <option value="Marzo">Marzo</option>
                        <option value="Abril">Abril</option>
                        <option value="Mayo">Mayo</option>
                        <option value="Junio">Junio</option>
                        <option value="Julio">Julio</option>
                        <option value="Agosto">Agosto</option>
                        <option value="Septiembre">Septiembre</option>
                        <option value="Octubre">Octubre</option>
                        <option value="Noviembre">Noviembre</option>
                        <option value="Diciembre">Diciembre</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Año:</label>
                    <input type="number" id="cuota-anio-input" class="form-control" value="${new Date().getFullYear()}" required>
                </div>
            </div>

            <div class="form-group">
                <label for="cuota-metodo-select">Método de Pago:</label>
                <select id="cuota-metodo-select" name="metodo_pago" required>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                </select>
            </div>

            <div class="form-group">
                <label for="cuota-notas-textarea">Notas / Observaciones:</label>
                <textarea id="cuota-notas-textarea" name="observaciones" rows="2"></textarea>
            </div>

            <button type="submit" class="btn btn-success">Confirmar Recepción</button>
            <p class="error-message" id="cuota-error-message" style="display: none; color: red;"></p>
          </form>
        </div>
      </div>
        </div>

        <div class="grid grid-2" style="margin-top: 1rem;">
          <div>
            <h3>Información Personal</h3>
            <dl>
              <dt>Nombre Completo:</dt>
              <dd>${this.escapeHtml(practicante.nombre_completo)}</dd>
              
              <dt>Fecha de Nacimiento:</dt>
              <dd>${practicante.fecha_nacimiento ? formatDateReadable(practicante.fecha_nacimiento) : 'No especificada'}</dd>
              
              <dt>Género:</dt>
              <dd>${this.formatGenero(practicante.genero)}</dd>
            </dl>

            <h3>Información de Contacto</h3>
            <dl>
              <dt>Teléfono:</dt>
              <dd>${practicante.telefono || 'No especificado'}</dd>
              
              <dt>Email:</dt>
              <dd>${practicante.email || 'No especificado'}</dd>
              
              <dt>Dirección:</dt>
              <dd>${practicante.direccion || 'No especificada'}</dd>
            </dl>
          </div>

          <div>
            <h3>Información de Salud</h3>
            <dl>
              <dt>Condiciones Médicas:</dt>
              <dd>${practicante.condiciones_medicas || 'Ninguna registrada'}</dd>
              
              <dt>Medicamentos:</dt>
              <dd>${practicante.medicamentos || 'Ninguno registrado'}</dd>
              
              <dt>Limitaciones Físicas:</dt>
              <dd>${practicante.limitaciones_fisicas || 'Ninguna registrada'}</dd>
              
              <dt>Alergias:</dt>
              <dd>${practicante.alergias || 'Ninguna registrada'}</dd>
            </dl>

            <h3>Información del Sistema</h3>
            <dl>
              <dt>Fecha de Registro:</dt>
              <dd>${practicante.created_at ? formatDateReadable(practicante.created_at.split('T')[0]) : 'N/A'}</dd>
              
              <dt>Última Actualización:</dt>
              <dd>${practicante.updated_at ? formatDateReadable(practicante.updated_at.split('T')[0]) : 'N/A'}</dd>
            </dl>
          </div>
        </div>

        <div id="payment-history-section" style="margin-top: 2rem;">
            <h3>Historial de Pagos</h3>
            <div id="payment-history-content"></div>
        </div>
      </div>

      <!-- Payment Modal -->
      <div id="payment-modal" class="modal">
        <div class="modal-content">
          <span class="close-button">&times;</span>
          <h2 id="payment-modal-title">Registrar Pago de Abono</h2>
          <form id="payment-form">
            <div id="payment-create-only-fields">
                <div class="form-group">
                <label for="tipo-abono-select">Tipo de Abono:</label>
                <select id="tipo-abono-select" name="tipo_abono_id">
                    <option value="">Seleccione un tipo de abono</option>
                    ${this.tiposAbono.map(tipo => `
                        <option 
                            value="${tipo.id}" 
                            data-duracion="${tipo.duracion_dias}" 
                            data-precio="${tipo.precio}"
                            data-categoria="${tipo.categoria}"
                            data-lugar-id="${tipo.lugar_id || ''}"
                        >
                            ${tipo.nombre} ($${parseFloat(tipo.precio).toFixed(2)})
                        </option>
                    `).join('')}
                </select>
                </div>
                <div id="cantidad-group" class="form-group">
                    <label for="cantidad-input">Cantidad:</label>
                    <input type="number" id="cantidad-input" name="cantidad" value="1" min="1" />
                </div>

                <div class="form-group">
                    <label for="lugar-id-select">Lugar:</label>
                    <select id="lugar-id-select" name="lugar_id">
                        <option value="">-- Seleccione un lugar --</option>
                        ${(() => {
                            const parentIds = new Set(this.lugares.filter(l => l.parent_id).map(l => l.parent_id));
                            return this.lugares
                                .filter(l => !(!l.parent_id && parentIds.has(l.id)))
                                .map(l => `<option value="${l.id}">${l.nombre}${l.parent_nombre ? ` (${l.parent_nombre})` : ''}</option>`)
                                .join('');
                        })()}
                    </select>
                </div>

                <div id="mes-abono-group" class="form-group" style="display: none;">
                    <label for="mes-abono-select">Mes de Abono:</label>
                    <select id="mes-abono-select" name="mes_abono">
                        ${this.generateMonthOptions()}
                    </select>
                </div>

                <div class="form-group">
                    <label for="fecha-vencimiento-input">Fecha de Vencimiento:</label>
                    <input type="date" id="fecha-vencimiento-input" name="fecha_vencimiento" />
                </div>

            </div>
            
            <div class="form-group">
                <label for="fecha-pago-input">Fecha de Pago:</label>
                <input type="date" id="fecha-pago-input" name="fecha_pago" required />
            </div>

            <div id="selected-abono-details" style="margin-top: 1rem; padding: 10px; background: #f9f9f9; border-radius: 4px;"></div>
            <div class="form-group">
                <label for="metodo-pago-select">Método de Pago:</label>
                <select id="metodo-pago-select" name="metodo_pago" required>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                </select>
            </div>
            <div class="form-group">
                <label for="notas-textarea">Notas:</label>
                <textarea id="notas-textarea" name="notas" rows="3"></textarea>
            </div>
            <button type="submit" id="payment-submit-btn" class="btn btn-primary">Confirmar Pago</button>
            <p class="error-message" id="payment-error-message" style="display: none; color: red;"></p>
          </form>
        </div>
      </div>

      <style>
        dl {
          margin-bottom: 1.5rem;
        }
        dt {
          font-weight: 600;
          margin-top: 0.5rem;
          color: var(--text-muted);
        }
        dd {
          margin-left: 0;
          margin-bottom: 0.5rem;
        }
        .modal {
            display: none; 
            position: fixed; 
            z-index: 1; 
            left: 0;
            top: 0;
            width: 100%; 
            height: 100%; 
            overflow: auto; 
            background-color: rgba(0,0,0,0.4); 
            padding-top: 60px;
        }
        .modal-content {
            background-color: #fefefe;
            margin: 5% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 500px;
            border-radius: 8px;
            position: relative;
        }
        .close-button {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
        }
        .close-button:hover,
        .close-button:focus {
            color: black;
            text-decoration: none;
            cursor: pointer;
        }
      </style>
    `;

    this.attachEvents();
    this.loadPaymentHistory(); // Load payment history when rendering

    const receiveCuotaBtn = this.container.querySelector('#receive-cuota-btn');
    if (this.socios && this.socios.length > 0) {
        receiveCuotaBtn.style.display = 'inline-block';
        
            // Populate cuota lugar select
            const cuotaLugarSelect = this.container.querySelector('#cuota-lugar-select');
            const montoSelect = this.container.querySelector('#cuota-monto-select');
            
            const updateMontoOptions = (socioId) => {
                const socio = this.socios.find(s => s.id == socioId);
                if (socio && montoSelect) {
                    const general = parseFloat(socio.cuota_social_general || 0);
                    const descuento = parseFloat(socio.cuota_social_descuento || 0);
                    
                    let options = `<option value="${general}">Cuota General ($${general.toFixed(2)})</option>`;
                    if (descuento > 0) {
                        options += `<option value="${descuento}">Cuota con Descuento ($${descuento.toFixed(2)})</option>`;
                    }
                    montoSelect.innerHTML = options;
                    // Pre-select discount if available
                    if (descuento > 0) montoSelect.value = descuento;
                }
            };

            if (cuotaLugarSelect) {
                cuotaLugarSelect.innerHTML = this.socios.map(s => `
                    <option value="${s.id}">
                        ${s.lugar_nombre} (Socio Nº ${s.numero_socio})
                    </option>
                `).join('');
                
                // Set initial options
                updateMontoOptions(this.socios[0].id);
                
                cuotaLugarSelect.addEventListener('change', (e) => {
                    updateMontoOptions(e.target.value);
                });
            }
    } else {
        receiveCuotaBtn.style.display = 'none';
    }

    if (this.options.openPaymentModal) {
        this.openCreatePaymentModal();
        this.options.openPaymentModal = false; // Clear for future renders
    }

    if (this.options.openCuotaModal && this.socios && this.socios.length > 0) {
        this.container.querySelector('#cuota-modal').style.display = 'block';
        this.options.openCuotaModal = false; // Clear for future renders
    }
  }

  attachEvents() {
    const editBtn = this.container.querySelector('#edit-btn');
    const closeBtn = this.container.querySelector('#close-btn');
    const payAbonoBtn = this.container.querySelector('#pay-abono-btn');
    const paymentModal = this.container.querySelector('#payment-modal');
    const closePaymentModalBtn = paymentModal.querySelector('.close-button');
    const paymentForm = this.container.querySelector('#payment-form');
    const tipoAbonoSelect = this.container.querySelector('#tipo-abono-select');
    const fechaPagoInput = this.container.querySelector('#fecha-pago-input');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.options.onEdit(this.practicante);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.render(null);
        this.options.onClose();
      });
    }

    if (payAbonoBtn) {
        payAbonoBtn.addEventListener('click', () => {
            this.openCreatePaymentModal();
        });
    }

    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none';
        });
    }

    if (fechaPagoInput) {
        fechaPagoInput.addEventListener('change', (e) => {
            const mesAbonoSelect = this.container.querySelector('#mes-abono-select');
            if (mesAbonoSelect) {
                const selectedDate = e.target.value ? new Date(e.target.value + 'T12:00:00') : new Date();
                mesAbonoSelect.innerHTML = this.generateMonthOptions(selectedDate);
            }
        });
    }

    const receiveCuotaBtn = this.container.querySelector('#receive-cuota-btn');
    const cuotaModal = this.container.querySelector('#cuota-modal');
    const closeCuotaModalBtn = this.container.querySelector('.close-cuota-modal');
    if (receiveCuotaBtn) {
        receiveCuotaBtn.addEventListener('click', () => {
            const cuotaFechaInput = cuotaModal.querySelector('#cuota-fecha-input');
            if (cuotaFechaInput) {
                cuotaFechaInput.value = new Date().toISOString().split('T')[0];
            }
            this.checkDuplicateCuota(); // Initial check
            cuotaModal.style.display = 'block';
        });
    }
    if (closeCuotaModalBtn) {
        closeCuotaModalBtn.addEventListener('click', () => {
            cuotaModal.style.display = 'none';
        });
    }

    // Duplicate checking listeners for Cuota Social
    const cuotaLugarSelect = this.container.querySelector('#cuota-lugar-select');
    const cuotaMesSelect = this.container.querySelector('#cuota-mes-select');
    const cuotaAnioInput = this.container.querySelector('#cuota-anio-input');
    if (cuotaLugarSelect && cuotaMesSelect && cuotaAnioInput) {
        const triggerCheck = () => this.checkDuplicateCuota();
        cuotaLugarSelect.addEventListener('change', triggerCheck);
        cuotaMesSelect.addEventListener('change', triggerCheck);
        cuotaAnioInput.addEventListener('input', triggerCheck);
    }

    const receiveCuotaForm = this.container.querySelector('#receive-cuota-form');
    if (receiveCuotaForm) {
        receiveCuotaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const socio_id = receiveCuotaForm.querySelector('#cuota-lugar-select').value;
            const monto = receiveCuotaForm.querySelector('#cuota-monto-select').value;
            const fecha_pago = receiveCuotaForm.querySelector('#cuota-fecha-input').value;
            const mes = receiveCuotaForm.querySelector('#cuota-mes-select').value;
            const anio = receiveCuotaForm.querySelector('#cuota-anio-input').value;
            const metodo_pago = receiveCuotaForm.querySelector('#cuota-metodo-select').value;
            const observaciones = receiveCuotaForm.querySelector('#cuota-notas-textarea').value;
            const errorMsg = receiveCuotaForm.querySelector('#cuota-error-message');

            try {
                // Register as a STANDALONE PAYMENT in the caja (Pago model)
                await makeRequest('/pagos/social-fee', 'POST', {
                    practicante_id: this.practicante.id,
                    lugar_id: parseInt(this.socios.find(s => s.id == socio_id).lugar_id, 10),
                    monto: parseFloat(monto),
                    fecha_pago: fecha_pago,
                    mes_abono: `${mes} ${anio}`,
                    metodo_pago: metodo_pago,
                    observaciones: observaciones
                }, true);

                showSuccess('Cobro de cuota social registrado en caja correctamente.', this.container);
                cuotaModal.style.display = 'none';
                receiveCuotaForm.reset();
                this.render(this.practicante); // Refresh history to show the new payment
            } catch (err) {
                console.error(err);
                errorMsg.textContent = err.message || 'Error al registrar cobro.';
                errorMsg.style.display = 'block';
            }
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) {
            paymentModal.style.display = 'none';
        }
        if (event.target == cuotaModal) {
            cuotaModal.style.display = 'none';
        }
    });

    if (tipoAbonoSelect) {
        tipoAbonoSelect.addEventListener('change', this.updateAbonoDetails.bind(this));
    }

    const cantidadInput = this.container.querySelector('#cantidad-input');
    if (cantidadInput) {
        cantidadInput.addEventListener('input', this.updateAbonoDetails.bind(this));
    }

    const lugarIdSelect = this.container.querySelector('#lugar-id-select');
    if (lugarIdSelect) {
        lugarIdSelect.addEventListener('change', this.updateAbonoDetails.bind(this));
    }

    if (paymentForm) {
        paymentForm.addEventListener('submit', this.handlePaymentSubmit.bind(this));
    }
  }

  updateAbonoDetails() {
    const tipoAbonoSelect = this.container.querySelector('#tipo-abono-select');
    const cantidadInput = this.container.querySelector('#cantidad-input');
    const selectedOption = tipoAbonoSelect.options[tipoAbonoSelect.selectedIndex];
    const detailsDiv = this.container.querySelector('#selected-abono-details');
    const mesAbonoGroup = this.container.querySelector('#mes-abono-group');
    const fechaVencimientoInput = this.container.querySelector('#fecha-vencimiento-input');
    const fechaVencimientoGroup = fechaVencimientoInput.closest('.form-group');
    const lugarSelect = this.container.querySelector('#lugar-id-select');
    const cantidadGroup = this.container.querySelector('#cantidad-group');

    if (selectedOption && selectedOption.value) {
        const duracionAttr = selectedOption.getAttribute('data-duracion');
        const duracion = (duracionAttr === 'null' || duracionAttr === '') ? null : parseInt(duracionAttr, 10);
        const precioUnitario = parseFloat(selectedOption.getAttribute('data-precio'));
        const categoria = selectedOption.getAttribute('data-categoria');
        const isFlexible = (categoria === 'particular' || categoria === 'compartida');
        
        // Use current place if selected, otherwise use abono's default
        let lugarId = parseInt(lugarSelect.value, 10);
        if (isNaN(lugarId)) {
            const lugarDefaultId = selectedOption.getAttribute('data-lugar-id');
            lugarId = lugarDefaultId ? parseInt(lugarDefaultId, 10) : null;
            if (lugarId && lugarSelect) {
                lugarSelect.value = lugarId;
            }
        }

        // Hide quantity for group classes
        if (categoria === 'grupal') {
            cantidadGroup.style.display = 'none';
            cantidadInput.value = 1;
        } else {
            cantidadGroup.style.display = 'block';
        }

        const cantidad = parseInt(cantidadInput.value, 10) || 1;
        const totalAbono = precioUnitario * cantidad;
        
        // Show mes_abono for all types of classes
        mesAbonoGroup.style.display = 'block';

        let duracionText = '';
        if (isFlexible) {
            fechaVencimientoGroup.style.display = 'none';
            fechaVencimientoInput.value = '2099-12-31'; 
        } else if (duracion === 0) {
            duracionText = `<p><strong>Duración Sugerida:</strong> ${cantidad === 1 ? '1 Clase' : `${cantidad} Clases`}</p>`;
            fechaVencimientoGroup.style.display = 'block';
            const exp = new Date();
            fechaVencimientoInput.value = exp.toISOString().split('T')[0];
        } else {
            duracionText = `<p><strong>Duración Sugerida:</strong> ${duracion * cantidad} días totales</p>`;
            fechaVencimientoGroup.style.display = 'block';
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + (duracion * cantidad));
            fechaVencimientoInput.value = expirationDate.toISOString().split('T')[0];
        }

        detailsDiv.innerHTML = `
            <p><strong>Abono:</strong> $${totalAbono.toFixed(2)}</p>
            <p><strong>Cantidad:</strong> ${cantidad}</p>
            ${duracionText}
            <hr>
            <p style="font-size: 1.2rem; color: var(--primary-color);"><strong>Total a Pagar: $${totalAbono.toFixed(2)}</strong></p>
        `;
    } else {
        detailsDiv.innerHTML = '';
        mesAbonoGroup.style.display = 'none';
        fechaVencimientoInput.value = '';
    }
  }

  generateMonthOptions(baseDate = new Date()) {
    const options = [];
    
    // Use the baseDate to start calculating months
    // We create a new date object from baseDate to avoid modifying the original
    const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    
    // Current month and next 2 months from baseDate
    for (let i = 0; i < 3; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        options.push(`<option value="${value}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>`);
    }
    
    return options.join('');
  }

  async handlePaymentSubmit(event) {
    event.preventDefault();
    const paymentForm = this.container.querySelector('#payment-form');
    const tipoAbonoSelect = paymentForm.querySelector('#tipo-abono-select');
    const cantidadInput = paymentForm.querySelector('#cantidad-input');
    const mesAbonoSelect = paymentForm.querySelector('#mes-abono-select');
    const fechaVencimientoInput = paymentForm.querySelector('#fecha-vencimiento-input');
    const fechaPagoInput = paymentForm.querySelector('#fecha-pago-input');
    const lugarSelect = paymentForm.querySelector('#lugar-id-select');
    const metodoPagoSelect = paymentForm.querySelector('#metodo-pago-select');
    const notasTextarea = paymentForm.querySelector('#notas-textarea');
    const errorMessageElement = paymentForm.querySelector('#payment-error-message');

    const fecha_pago = fechaPagoInput.value;
    const metodo_pago = metodoPagoSelect.value;
    const notas = notasTextarea.value;

    errorMessageElement.style.display = 'none';

    try {
        const selectedOption = tipoAbonoSelect.options[tipoAbonoSelect.selectedIndex];
        if (!selectedOption || !tipoAbonoSelect.value) {
            errorMessageElement.textContent = 'Por favor, seleccione un tipo de abono.';
            errorMessageElement.style.display = 'block';
            return;
        }

        const categoria = selectedOption.getAttribute('data-categoria');
        const isFlexible = (categoria === 'particular' || categoria === 'compartida');

        const tipo_abono_id = tipoAbonoSelect.value;
        const cantidad = cantidadInput.value;
        const mes_abono = mesAbonoSelect.value;
        const fecha_vencimiento = fechaVencimientoInput.value;
        const lugar_id = lugarSelect.value;

        // Validation: lugar_id is required for flexible classes
        if (isFlexible && !lugar_id) {
            errorMessageElement.textContent = 'El lugar es obligatorio para clases particulares o compartidas.';
            errorMessageElement.style.display = 'block';
            return;
        }

        const payload = { 
            tipo_abono_id: parseInt(tipo_abono_id, 10), 
            cantidad: parseInt(cantidad, 10),
            mes_abono: mes_abono,
            fecha_vencimiento,
            fecha_pago,
            lugar_id: lugar_id ? parseInt(lugar_id, 10) : null,
            metodo_pago, 
            notas 
        };

        await makeRequest(
            `/practicantes/${this.practicante.id}/pagar`,
            'POST',
            payload, 
            true
        );
        showSuccess('Pago registrado correctamente.', this.container);
        
        this.container.querySelector('#payment-modal').style.display = 'none';
        this.render(this.practicante); // Re-render to refresh history
    } catch (error) {
        console.error('Error al registrar pago:', error);
        displayApiError(error, errorMessageElement);
    }
  }

  openCreatePaymentModal() {
    this.isEditingPayment = false;
    this.currentPagoId = null;
    
    const modal = this.container.querySelector('#payment-modal');
    modal.querySelector('#payment-modal-title').textContent = 'Registrar Pago de Abono';
    modal.querySelector('#payment-submit-btn').textContent = 'Confirmar Pago';
    
    // Reset form
    const form = modal.querySelector('#payment-form');
    form.reset();
    
    // Set default date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    form.querySelector('#fecha-pago-input').value = todayStr;
    
    // Initialize month options based on default date
    const mesAbonoSelect = form.querySelector('#mes-abono-select');
    if (mesAbonoSelect) {
        mesAbonoSelect.innerHTML = this.generateMonthOptions(today);
    }
    
    modal.style.display = 'block';
    this.updateAbonoDetails();
  }

  async loadPaymentHistory() {
    const historyContainer = this.container.querySelector('#payment-history-content');
    if (!historyContainer) return;

    historyContainer.innerHTML = '<div class="spinner"></div>'; // Show spinner

    try {
        const response = await makeRequest(`/practicantes/${this.practicante.id}/pagos`, 'GET', null, true);
        const pagos = response.data;
        this.currentPayments = pagos || [];

        if (pagos && pagos.length > 0) {
            historyContainer.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Tipo Abono</th>
                            <th>Monto</th>
                            <th>Fecha Pago</th>
                            <th>Vencimiento</th>
                            <th>Lugar</th>
                            <th>Método</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagos.map(pago => {
                            const mesText = pago.mes_abono ? ` (${pago.mes_abono})` : '';
                            const isVencimientoReal = pago.fecha_vencimiento && !pago.fecha_vencimiento.startsWith('2099');
                            const isCuotaSocial = !pago.tipo_abono_nombre || pago.tipo_abono_nombre === 'Recepción Cuota Social';
                            
                            let vencimientoHtml = '';
                            if (isVencimientoReal) {
                                vencimientoHtml = formatDateReadable(pago.fecha_vencimiento);
                            } else if (isCuotaSocial) {
                                vencimientoHtml = '<em class="text-muted">a determinar...</em>';
                            } else {
                                vencimientoHtml = '<em class="text-muted">Flexible</em>';
                            }

                            return `
                                <tr>
                                    <td>${this.escapeHtml(pago.tipo_abono_nombre || 'Recepción Cuota Social')}${mesText}</td>
                                    <td>$${parseFloat(pago.monto).toFixed(2)}</td>
                                    <td>${formatDateReadable(pago.fecha)}</td>
                                    <td>${vencimientoHtml}</td>
                                    <td>${this.escapeHtml(pago.lugar_nombre || '-')}</td>
                                    <td>${pago.metodo_pago || '-'}</td>
                                    <td>
                                        <button class="btn btn-danger btn-sm delete-pago-btn" data-id="${pago.id}">Eliminar</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
            // Attach events to buttons
            historyContainer.querySelectorAll('.delete-pago-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pagoId = e.target.getAttribute('data-id');
                    const pago = pagos.find(p => p.id == pagoId);
                    this.handleDeletePago(pago);
                });
            });
        } else {
            historyContainer.innerHTML = '<p class="text-muted">No hay historial de pagos para este practicante.</p>';
        }
    } catch (error) {
        console.error('Error fetching payment history:', error);
        displayApiError(error, historyContainer);
    }
  }

  async handleDeletePago(pago) {
    const isCuotaSocial = !pago.tipo_abono_nombre || pago.tipo_abono_nombre === 'Recepción Cuota Social';
    
    let confirmMsg = '¿Está seguro de que desea eliminar este pago? Esto también cancelará el abono asociado.';
    if (isCuotaSocial) {
        confirmMsg = '¿Está seguro de eliminar esta recepción de cuota social? También se eliminará el registro en la ficha del socio.';
    }

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        await makeRequest(`/practicantes/${this.practicante.id}/pagos/${pago.id}`, 'DELETE', null, true);
        showSuccess('Pago eliminado correctamente.', this.container);
        this.loadPaymentHistory(); // Refresh history
    } catch (error) {
        console.error('Error al eliminar pago:', error);
        alert('Error al eliminar pago: ' + (error.message || 'Error desconocido'));
    }
  }

  formatGenero(genero) {
    const map = {
      'M': 'Masculino',
      'F': 'Femenino',
      'Otro': 'Otro',
      'Prefiero no decir': 'Prefiero no decir'
    };
    return map[genero] || genero || 'No especificado';
  }

  checkDuplicateCuota() {
    const socioId = this.container.querySelector('#cuota-lugar-select').value;
    const month = this.container.querySelector('#cuota-mes-select').value;
    const year = this.container.querySelector('#cuota-anio-input').value;
    const warning = this.container.querySelector('#cuota-duplicate-warning');
    const submitBtn = this.container.querySelector('#receive-cuota-form button[type="submit"]');

    if (!this.currentPayments || !socioId) return;

    const socio = this.socios.find(s => s.id == socioId);
    if (!socio) return;

    const mesAbono = `${month} ${year}`;

    // Check in history if there's already a payment for this month and location
    // Standalone social fees have tipo_abono_nombre as 'Recepción Cuota Social'
    // and matching lugar_nombre
    const isDuplicate = this.currentPayments.some(p => 
        p.mes_abono === mesAbono && 
        p.lugar_nombre === socio.lugar_nombre &&
        (!p.tipo_abono_nombre || p.tipo_abono_nombre === 'Recepción Cuota Social')
    );

    if (isDuplicate) {
        warning.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
    } else {
        warning.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default PracticanteDetail;
