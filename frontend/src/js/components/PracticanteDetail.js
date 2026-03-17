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
      onPrev: options.onPrev || null,
      onNext: options.onNext || null,
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
        <!-- Bloque 1: Control de Navegación Superior -->
        <div id="nav-controls" style="display: flex; justify-content: center; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border-color); background-color: #fcfcfc; border-radius: 0.5rem 0.5rem 0 0; margin: -1.25rem -1.25rem 1.5rem -1.25rem;">
          <div style="display: flex; align-items: center; gap: 3rem;">
            <div style="width: 80px; display: flex; justify-content: center;">
              ${this.options.onPrev ? `
                <button id="prev-btn" class="btn btn-outline-secondary" title="Anterior" style="font-size: 2.5rem; width: 80px; height: 50px; display: flex; align-items: center; justify-content: center; font-weight: bold; border-width: 2px;">
                  &lArr;
                </button>
              ` : ''}
            </div>
            
            <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px;">Navegación</span>

            <div style="width: 80px; display: flex; justify-content: center;">
              ${this.options.onNext ? `
                <button id="next-btn" class="btn btn-outline-secondary" title="Siguiente" style="font-size: 2.5rem; width: 80px; height: 50px; display: flex; align-items: center; justify-content: center; font-weight: bold; border-width: 2px;">
                  &rArr;
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="card-header">
          <!-- Bloque 2: Nombre e Identidad -->
          <div class="text-center" style="margin-bottom: 2rem;">
            <h2 class="card-title" style="font-size: 2.75rem; color: var(--primary-color); margin-bottom: 0.25rem;">${this.escapeHtml(practicante.nombre_completo)}</h2>
            <div style="display: flex; justify-content: center; align-items: center; gap: 1rem;">
              <span class="badge badge-info">Ficha del Practicante</span>
              ${practicante.es_profesor ? '<span class="badge badge-warning">Profesor</span>' : ''}
            </div>
          </div>

          <!-- Bloque 3: Botones de Acción -->
          <div id="action-buttons" class="flex justify-center gap-2 flex-wrap" style="border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
            <button id="edit-btn" class="btn" style="padding: 0.5rem 1.5rem;">Editar Perfil</button>
            <button id="receive-cuota-btn" class="btn btn-success" style="display: none; padding: 0.5rem 1.5rem;">Recibir Cuota Social</button>
            <button id="pay-abono-btn" class="btn btn-primary" style="padding: 0.5rem 1.5rem;">Pagar Abono</button>
            <button id="print-btn" class="btn btn-outline-info" style="padding: 0.5rem 1.5rem;"><i class="fas fa-print"></i> Imprimir</button>
            <button id="close-btn" class="btn btn-secondary" style="padding: 0.5rem 1.5rem;">Cerrar</button>
          </div>
        </div>
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
                <label for="cuota-monto-input">Importe Recibido ($):</label>
                <input type="number" id="cuota-monto-input" name="monto" step="0.01" required />
                <div id="cuota-monto-shortcuts" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;"></div>
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

        <div class="grid grid-2" style="margin-top: 1rem;">
          <div>
            <h3>Información Personal</h3>
            <dl>
              <dt>Nombre Completo:</dt>
              <dd>${this.escapeHtml(practicante.nombre_completo)}</dd>

              <dt>DNI:</dt>
              <dd>${practicante.dni || 'No especificado'}</dd>
              
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

            <h3>Contacto de Emergencia</h3>
            <dl>
              <dt>Nombre de Contacto:</dt>
              <dd>${practicante.emergencia_nombre || 'No especificado'}</dd>
              
              <dt>Teléfono de Contacto:</dt>
              <dd>${practicante.emergencia_telefono || 'No especificado'}</dd>
              
              <dt>Obra Social:</dt>
              <dd>${practicante.obra_social || 'No especificada'}${practicante.obra_social_nro ? ` (Afiliado: ${practicante.obra_social_nro})` : ''}</dd>
              
              <dt>Servicio de Emergencia:</dt>
              <dd>${practicante.emergencia_servicio || 'No especificado'}${practicante.emergencia_servicio_telefono ? ` (Tel: ${practicante.emergencia_servicio_telefono})` : ''}</dd>
            </dl>

            <h3>Información Adicional</h3>
            <dl>
              <dt>Ocupación:</dt>
              <dd>${practicante.ocupacion || 'No especificada'}</dd>

              <dt>Estudios:</dt>
              <dd>${practicante.estudios || 'No especificados'}</dd>

              <dt>Actividad Física Actual:</dt>
              <dd>${practicante.actividad_fisica_actual ? `Sí - ${practicante.actividad_fisica_detalle || 'Sin detalles'}` : `No${practicante.actividad_fisica_anios_inactivo ? ` (Hace ${practicante.actividad_fisica_anios_inactivo} años)` : ''}`}</dd>
              
              ${!practicante.actividad_fisica_actual && practicante.actividad_fisica_anterior ? `
                <dt>Actividades anteriores:</dt>
                <dd>${practicante.actividad_fisica_anterior}</dd>
              ` : ''}

              <dt>Observaciones:</dt>
              <dd>${practicante.observaciones_adicionales || 'Ninguna registrada'}</dd>
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
                <label for="monto-input">Importe a Cobrar ($):</label>
                <input type="number" id="monto-input" name="monto" step="0.01" required />
            </div>

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

      <!-- Partial Payment Modal -->
      <div id="partial-payment-modal" class="modal">
        <div class="modal-content">
          <span class="close-button" id="close-partial-payment-modal">&times;</span>
          <h2 id="partial-payment-modal-title">Registrar Pago Parcial</h2>
          <form id="partial-payment-form">
            <input type="hidden" id="partial-abono-id" name="abono_id" />
            <div class="form-group">
              <label for="partial-saldo-pendiente">Saldo Pendiente:</label>
              <input type="text" id="partial-saldo-pendiente" class="form-control" readonly />
            </div>
            <div class="form-group">
              <label for="partial-monto-input">Importe a Abonar ($):</label>
              <input type="number" id="partial-monto-input" name="monto" step="0.01" required />
            </div>
            <div class="form-group">
              <label for="partial-fecha-pago-input">Fecha de Pago:</label>
              <input type="date" id="partial-fecha-pago-input" name="fecha_pago" required />
            </div>
            <div class="form-group">
              <label for="partial-metodo-pago-select">Método de Pago:</label>
              <select id="partial-metodo-pago-select" name="metodo_pago" required>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label for="partial-notas-textarea">Notas:</label>
              <textarea id="partial-notas-textarea" name="notas" rows="3"></textarea>
            </div>
            <button type="submit" id="partial-payment-submit-btn" class="btn btn-primary">Confirmar Abono</button>
            <p class="error-message" id="partial-payment-error-message" style="display: none; color: red;"></p>
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

        @media print {
            /* Hide everything in body */
            body > * {
                display: none !important;
            }
            
            /* Show only the app container and the main content where our card lives */
            #app, #main-content {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* Specifically ensure all parents of the card are visible but their other children are hidden */
            header, footer, nav {
                display: none !important;
            }

            .card {
                display: block !important;
                visibility: visible !important;
                border: none !important;
                box-shadow: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* Hide unwanted elements inside the card */
            #nav-controls, #action-buttons, .modal, .delete-pago-btn, .add-partial-btn, .btn-group, .close-button, #payment-history-section {
                display: none !important;
            }

            /* Force display of grid content in print */
            .grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 2rem !important;
            }

            /* Ensure text colors are black for printing */
            h2, h3, dt, dd, td, th, p, span, div {
                color: #000 !important;
            }
            
            dt {
                font-weight: bold !important;
                margin-top: 10px !important;
            }

            .badge {
                border: 1px solid #000;
                color: #000 !important;
                background: none !important;
            }
            
            /* Table optimization for print */
            table {
                width: 100% !important;
                border-collapse: collapse !important;
            }
            th, td {
                border-bottom: 1px solid #ddd !important;
                padding: 8px !important;
                text-align: left !important;
            }
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
            const montoInput = this.container.querySelector('#cuota-monto-input');
            const shortcutsDiv = this.container.querySelector('#cuota-monto-shortcuts');
            
            const updateMontoOptions = (socioId) => {
                const socio = this.socios.find(s => s.id == socioId);
                if (socio && montoInput) {
                    const general = parseFloat(socio.cuota_social_general || 0);
                    const descuento = parseFloat(socio.cuota_social_descuento || 0);
                    
                    // Set default value (prefer discount if available)
                    montoInput.value = (descuento > 0 ? descuento : general).toFixed(2);

                    // Add shortcut buttons
                    let shortcuts = `<button type="button" class="btn btn-sm btn-outline-info shortcut-btn" data-value="${general.toFixed(2)}">General ($${general.toFixed(2)})</button>`;
                    if (descuento > 0) {
                        shortcuts += `<button type="button" class="btn btn-sm btn-outline-success shortcut-btn" data-value="${descuento.toFixed(2)}">Descuento ($${descuento.toFixed(2)})</button>`;
                    }
                    shortcutsDiv.innerHTML = shortcuts;

                    // Attach events to shortcut buttons
                    shortcutsDiv.querySelectorAll('.shortcut-btn').forEach(btn => {
                        btn.onclick = () => {
                            montoInput.value = btn.getAttribute('data-value');
                        };
                    });
                }
            };

            if (cuotaLugarSelect) {
                cuotaLugarSelect.innerHTML = this.socios.map(s => `
                    <option value="${s.id}">
                        ${s.lugar_nombre} (Socio: ${s.numero_socio || 'S/N'})
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
    const printBtn = this.container.querySelector('#print-btn');
    const prevBtn = this.container.querySelector('#prev-btn');
    const nextBtn = this.container.querySelector('#next-btn');

    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
    const paymentModal = this.container.querySelector('#payment-modal');
    const closePaymentModalBtn = paymentModal.querySelector('.close-button');
    const paymentForm = this.container.querySelector('#payment-form');
    const tipoAbonoSelect = this.container.querySelector('#tipo-abono-select');
    const fechaPagoInput = this.container.querySelector('#fecha-pago-input');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.options.onPrev();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.options.onNext();
      });
    }

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
            const monto = receiveCuotaForm.querySelector('#cuota-monto-input').value;
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

    const partialPaymentModal = this.container.querySelector('#partial-payment-modal');
    const closePartialPaymentModalBtn = this.container.querySelector('#close-partial-payment-modal');
    const partialPaymentForm = this.container.querySelector('#partial-payment-form');

    if (closePartialPaymentModalBtn) {
      closePartialPaymentModalBtn.addEventListener('click', () => {
        partialPaymentModal.style.display = 'none';
      });
    }

    if (partialPaymentForm) {
      partialPaymentForm.addEventListener('submit', this.handlePartialPaymentSubmit.bind(this));
    }

    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) {
            paymentModal.style.display = 'none';
        }
        if (event.target == cuotaModal) {
            cuotaModal.style.display = 'none';
        }
        if (event.target == partialPaymentModal) {
            partialPaymentModal.style.display = 'none';
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

        // Show quantity for flexible classes OR single classes (duracion 0)
        const isSingleClass = (duracion === 0);
        if (isFlexible || isSingleClass) {
            cantidadGroup.style.display = 'block';
        } else {
            cantidadGroup.style.display = 'none';
            cantidadInput.value = 1;
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
            <p style="font-size: 1.1rem; color: var(--primary-color);"><strong>Total Sugerido: $${totalAbono.toFixed(2)}</strong></p>
        `;

        // Update the editable amount input
        const montoInput = this.container.querySelector('#monto-input');
        if (montoInput) {
            montoInput.value = totalAbono.toFixed(2);
        }
    } else {
        detailsDiv.innerHTML = '';
        mesAbonoGroup.style.display = 'none';
        fechaVencimientoInput.value = '';
        const montoInput = this.container.querySelector('#monto-input');
        if (montoInput) montoInput.value = '';
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
        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
        options.push(`<option value="${capitalizedLabel}">${capitalizedLabel}</option>`);
    }
    
    return options.join('');
  }

  async handlePaymentSubmit(event) {
    event.preventDefault();
    const paymentForm = this.container.querySelector('#payment-form');
    const tipoAbonoSelect = paymentForm.querySelector('#tipo-abono-select');
    const cantidadInput = paymentForm.querySelector('#cantidad-input');
    const montoInput = paymentForm.querySelector('#monto-input');
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
    const monto = montoInput.value;

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
            monto: parseFloat(monto),
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

  /**
   * Handles the submission of the partial payment form.
   * Performs client-side validation, sends the request to the backend,
   * and handles success/error responses.
   * @param {Event} event - The form submission event.
   */
  async handlePartialPaymentSubmit(event) {
    event.preventDefault();
    const partialPaymentForm = this.container.querySelector('#partial-payment-form');
    const abonoIdInput = partialPaymentForm.querySelector('#partial-abono-id');
    const montoInput = partialPaymentForm.querySelector('#partial-monto-input');
    const fechaPagoInput = partialPaymentForm.querySelector('#partial-fecha-pago-input');
    const metodoPagoSelect = partialPaymentForm.querySelector('#partial-metodo-pago-select');
    const notasTextarea = partialPaymentForm.querySelector('#partial-notas-textarea');
    const errorMessageElement = partialPaymentForm.querySelector('#partial-payment-error-message');
    const submitBtn = partialPaymentForm.querySelector('#partial-payment-submit-btn');

    // Hide any previous error messages
    errorMessageElement.style.display = 'none';

    // 2.1 Client-side validation: Ensure amount and date are valid
    const monto = parseFloat(montoInput.value);
    const fecha_pago = fechaPagoInput.value;

    if (isNaN(monto) || monto <= 0) {
        errorMessageElement.textContent = 'El importe a abonar debe ser un número mayor que cero.';
        errorMessageElement.style.display = 'block';
        return;
    }

    if (!fecha_pago) {
        errorMessageElement.textContent = 'La fecha de pago es obligatoria.';
        errorMessageElement.style.display = 'block';
        return;
    }

    try {
        // Disable submit button and show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';

        const abono_id = abonoIdInput.value;
        const metodo_pago = metodoPagoSelect.value;
        const notas = notasTextarea.value;

        // Construct the payload for the POST /api/pagos/partial endpoint
        const payload = {
            practicante_id: this.practicante.id,
            abono_id: parseInt(abono_id, 10),
            monto: monto,
            fecha_pago: fecha_pago,
            metodo_pago: metodo_pago,
            notas: notas
        };

        // 2.4 Make the API call using the client helper
        await makeRequest(
            '/pagos/partial',
            'POST',
            payload,
            true
        );

        // 2.5 Successful handling: feedback, close modal, and refresh UI
        showSuccess('Pago parcial registrado correctamente.', this.container);
        this.container.querySelector('#partial-payment-modal').style.display = 'none';
        
        // Refresh only the history section to show the new payment and updated balance
        this.loadPaymentHistory(); 
    } catch (error) {
        // 2.6 UI error handling: display API errors to the user
        console.error('Error al registrar pago parcial:', error);
        displayApiError(error, errorMessageElement);
    } finally {
        // Restore submit button state
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar Abono';
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

  /**
   * Opens the partial payment modal and initializes it with the provided abono data.
   * @param {number|string} abonoId - The ID of the abono to pay for.
   * @param {number|string} saldoPendiente - The current outstanding balance for this abono.
   */
  openPartialPaymentModal(abonoId, saldoPendiente) {
    const modal = this.container.querySelector('#partial-payment-modal');
    const form = modal.querySelector('#partial-payment-form');
    
    // Reset form to clear previous values and error messages
    form.reset();
    const errorMessageElement = form.querySelector('#partial-payment-error-message');
    if (errorMessageElement) errorMessageElement.style.display = 'none';

    // Populate hidden abono_id for the submission payload
    form.querySelector('#partial-abono-id').value = abonoId;
    
    // Display saldo pendiente as a read-only reference for the user
    const saldo = parseFloat(saldoPendiente) || 0;
    form.querySelector('#partial-saldo-pendiente').value = saldo.toFixed(2);

    // Set default payment date to today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    form.querySelector('#partial-fecha-pago-input').value = todayStr;
    
    // Set suggested amount to the pending balance
    form.querySelector('#partial-monto-input').value = saldo.toFixed(2);

    // Show the modal
    modal.style.display = 'block';
  }

  async loadPaymentHistory() {
    const historyContainer = this.container.querySelector('#payment-history-content');
    if (!historyContainer) return;

    historyContainer.innerHTML = '<div class="spinner"></div>';

    try {
        const response = await makeRequest(`/practicantes/${this.practicante.id}/pagos`, 'GET', null, true);
        const pagos = response.data;
        this.currentPayments = pagos || [];

        if (pagos && pagos.length > 0) {
            // Agrupar pagos por abono para calcular saldos
            const abonosMap = new Map();
            for (const p of pagos) {
                if (p.abono_id) {
                    if (!abonosMap.has(p.abono_id)) {
                        // Obtener balance del abono desde el servidor
                        const balanceRes = await makeRequest(`/pagos/abono/${p.abono_id}/balance`, 'GET', null, true);
                        abonosMap.set(p.abono_id, balanceRes.data);
                    }
                }
            }

            historyContainer.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Monto</th>
                            <th>Fecha</th>
                            <th>Estado / Saldo</th>
                            <th>Lugar</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagos.map(pago => {
                            const mesText = pago.mes_abono ? ` (${pago.mes_abono})` : '';
                            const isCuotaSocial = !pago.tipo_abono_nombre || pago.tipo_abono_nombre === 'Recepción Cuota Social';
                            
                            let balanceHtml = '<span class="badge badge-success">Pagado</span>';
                            let actionsHtml = `<button class="btn btn-danger btn-sm delete-pago-btn" data-id="${pago.id}" title="Eliminar"><i class="fas fa-trash"></i></button>`;

                            if (pago.abono_id && abonosMap.has(pago.abono_id)) {
                                const balance = abonosMap.get(pago.abono_id);
                                if (parseFloat(balance.saldo_pendiente) > 0.01) {
                                    balanceHtml = `<span class="text-danger" style="font-weight:bold;">Debe $${parseFloat(balance.saldo_pendiente).toFixed(2)}</span>`;
                                    // Solo mostrar botón de "Abonar" en el pago más reciente del abono para no duplicar botones
                                    const esUltimoPago = pagos.find(pg => pg.abono_id === pago.abono_id).id === pago.id;
                                    if (esUltimoPago) {
                                        actionsHtml = `
                                            <button class="btn btn-primary btn-sm add-partial-btn" data-abono-id="${pago.abono_id}" data-saldo="${balance.saldo_pendiente}" title="Registrar pago de saldo">Abonar</button>
                                            ${actionsHtml}
                                        `;
                                    }
                                } else if (parseFloat(balance.saldo_pendiente) < -0.01) {
                                    balanceHtml = `<span class="text-info">Saldo a favor: $${Math.abs(balance.saldo_pendiente).toFixed(2)}</span>`;
                                }
                            }

                            return `
                                <tr>
                                    <td>
                                        <strong>${this.escapeHtml(pago.tipo_abono_nombre || 'Cuota Social')}</strong>${mesText}
                                        ${pago.notas ? `<br><small class="text-muted">${this.escapeHtml(pago.notas)}</small>` : ''}
                                    </td>
                                    <td>$${parseFloat(pago.monto).toFixed(2)}</td>
                                    <td>${formatDateReadable(pago.fecha)}</td>
                                    <td>${balanceHtml}</td>
                                    <td><small>${this.escapeHtml(pago.lugar_nombre || '-')}</small></td>
                                    <td>
                                        <div class="btn-group">${actionsHtml}</div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
            
            // Attach events
            historyContainer.querySelectorAll('.delete-pago-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pagoId = btn.getAttribute('data-id');
                    const pago = pagos.find(p => p.id == pagoId);
                    if (pago) {
                        this.handleDeletePago(pago);
                    }
                });
            });

            historyContainer.querySelectorAll('.add-partial-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const abonoId = btn.getAttribute('data-abono-id');
                    const saldo = btn.getAttribute('data-saldo');
                    this.openPartialPaymentModal(abonoId, saldo);
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

export default PracticanteDetail;
