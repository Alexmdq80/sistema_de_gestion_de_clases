import { apiClient } from '../api/client.js';
import { displayApiError } from '../utils/errors.js';

export class EstimadorPage {
    constructor(container) {
        this.container = container;
        this.lugares = [];
        this.tiposAbono = [];
        
        // State for the calculator
        this.state = {
            gruposAbono: [
                { id: Date.now(), abonoId: '', precio: 0, practicantes: 10 }
            ],
            costoSalon: 0,
            tipoCostoSalon: 'por_hora', // 'por_hora' | 'mensual'
            cuotaSocialProfesor: 0,
            horasSemanales: 2,
            semanasMes: 4.33
        };
    }

    async render() {
        this.container.innerHTML = `
            <div class="page-header mb-4 no-print">
                <h1>Estimador de Ganancias</h1>
                <p class="text-muted">Herramienta de simulación para proyectar ingresos con múltiples tipos de abono.</p>
            </div>

            <div class="grid grid-12 gap-4">
                <!-- Panel de Configuración -->
                <div class="col-span-12 lg-col-span-6">
                    <div class="card p-4 h-full">
                        <h3 class="border-bottom pb-2 mb-4"><i class="fas fa-cog mr-2"></i>Variables</h3>
                        
                        <div class="form-group mb-4">
                            <label class="font-weight-bold mb-2 d-block">1. Seleccionar Sede de Base</label>
                            <select class="form-control" id="select-lugar">
                                <option value="">-- Personalizado / Elegir Sede --</option>
                            </select>
                            <small class="text-muted">Carga automáticamente los costos del salón y cuota del profesor.</small>
                        </div>

                        <div class="mb-4">
                            <div class="flex justify-between items-center mb-2">
                                <label class="font-weight-bold mb-0">2. Ingresos por Abonos</label>
                                <button id="btn-add-abono" class="btn btn-sm btn-outline-primary">
                                    <i class="fas fa-plus"></i> Agregar Abono
                                </button>
                            </div>
                            <div id="abonos-container" class="border rounded p-2 bg-light">
                                <!-- Filas de abonos dinámicas -->
                            </div>
                            <div class="text-right mt-2">
                                <small class="font-weight-bold">Total Practicantes: <span id="res-total-practicantes">0</span></small>
                            </div>
                        </div>

                        <hr>

                        <div class="grid grid-2 gap-3 mb-3">
                            <div class="form-group mb-0">
                                <label class="font-weight-bold">3. Costo Salón ($)</label>
                                <div class="input-group flex">
                                    <input type="number" class="form-control" id="input-costo-salon" value="${this.state.costoSalon}" step="100" style="flex: 1.5;">
                                    <select class="form-control" id="input-tipo-costo" style="flex: 1; padding: 0.375rem 0.25rem;">
                                        <option value="por_hora" ${this.state.tipoCostoSalon === 'por_hora' ? 'selected' : ''}>/ h</option>
                                        <option value="mensual" ${this.state.tipoCostoSalon === 'mensual' ? 'selected' : ''}>/ mes</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group mb-0">
                                <label class="font-weight-bold">Horas Semanales</label>
                                <input type="number" class="form-control" id="input-horas" value="${this.state.horasSemanales}" step="0.5">
                            </div>
                        </div>

                        <div class="grid grid-2 gap-3">
                            <div class="form-group mb-0">
                                <label class="font-weight-bold">4. Cuota Profesor ($)</label>
                                <input type="number" class="form-control" id="input-cuota-profesor" value="${this.state.cuotaSocialProfesor}" step="100">
                            </div>
                            <div class="form-group mb-0">
                                <label class="font-weight-bold">Semanas / Mes</label>
                                <input type="number" class="form-control" id="input-semanas" value="${this.state.semanasMes}" step="0.01">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Panel de Resultados -->
                <div class="col-span-12 lg-col-span-6">
                    <div class="card p-4 h-full bg-light">
                        <h3 class="border-bottom pb-2 mb-4"><i class="fas fa-chart-line mr-2"></i>Proyección Mensual</h3>
                        
                        <div class="grid grid-2 gap-4 mb-4">
                            <div class="card p-3 bg-white shadow-sm border-left-success">
                                <small class="text-muted text-uppercase font-weight-bold">Ingresos Brutos</small>
                                <h2 class="text-success mb-0" id="res-ingreso-bruto">$0.00</h2>
                            </div>
                            <div class="card p-3 bg-white shadow-sm border-left-danger">
                                <small class="text-muted text-uppercase font-weight-bold">Egresos Totales</small>
                                <h2 class="text-danger mb-0" id="res-egreso-total">$0.00</h2>
                            </div>
                        </div>

                        <div class="card p-4 bg-white shadow mb-4 text-center border-primary">
                            <h4 class="text-muted text-uppercase mb-2">Ganancia Neta Mensual</h4>
                            <h1 class="display-4 text-primary font-weight-bold mb-0" id="res-neto-mensual">$0.00</h1>
                        </div>

                        <div class="card p-4 bg-white shadow mb-4">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="text-muted text-uppercase mb-1">Ganancia Neta por Hora</h4>
                                    <h2 class="mb-0" id="res-neto-hora">$0.00</h2>
                                </div>
                                <div class="text-right">
                                    <small class="text-muted d-block">Horas Totales/Mes</small>
                                    <span class="font-weight-bold" id="res-horas-totales">0 hs</span>
                                </div>
                            </div>
                        </div>

                        <div class="alert alert-info mt-auto">
                            <h5><i class="fas fa-info-circle mr-2"></i>Resumen de Lógica</h5>
                            <ul class="small mb-0 pl-3">
                                <li><strong>Ingreso:</strong> Sumatoria de (Practicantes x Precio) de cada abono.</li>
                                <li><strong>Costo Salón:</strong> Calculado según horas semanales o monto mensual.</li>
                                <li><strong>Neto:</strong> Lo que queda libre tras pagar salón y cuota social.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadInitialData();
        this.renderAbonoRows();
        this.attachEvents();
        this.calculate();
    }

    async loadInitialData() {
        try {
            const [lugaresRes, abonosRes] = await Promise.all([
                apiClient.get('/lugares'),
                apiClient.get('/tipos-abono')
            ]);

            this.lugares = lugaresRes.data || [];
            this.tiposAbono = abonosRes.data || [];

            const selectLugar = this.container.querySelector('#select-lugar');
            this.lugares.filter(l => !l.parent_id).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.nombre;
                selectLugar.appendChild(opt);
            });
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    renderAbonoRows() {
        const container = this.container.querySelector('#abonos-container');
        if (!container) return;

        if (this.state.gruposAbono.length === 0) {
            container.innerHTML = '<div class="text-center p-3 text-muted small">No hay abonos agregados. Haz clic en "Agregar Abono".</div>';
            return;
        }

        container.innerHTML = `
            <div class="flex gap-2 mb-1 px-2">
                <div style="flex: 2;"><small class="font-weight-bold">Tipo de Abono</small></div>
                <div style="flex: 1;"><small class="font-weight-bold">Precio $</small></div>
                <div style="flex: 1;"><small class="font-weight-bold">Cant.</small></div>
                <div style="width: 32px;"></div>
            </div>
        `;

        this.state.gruposAbono.forEach((grupo, index) => {
            const row = document.createElement('div');
            row.className = 'flex gap-2 mb-3 items-center bg-white p-2 rounded shadow-sm border';
            row.innerHTML = `
                <div style="flex: 2;">
                    <select class="form-control form-control-sm select-grupo-abono" data-index="${index}">
                        <option value="">-- Personalizado --</option>
                        ${this.tiposAbono.map(a => `
                            <option value="${a.id}" ${grupo.abonoId == a.id ? 'selected' : ''}>${a.nombre}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="flex: 1; position: relative;">
                    <input type="number" class="form-control form-control-sm input-grupo-precio" data-index="${index}" value="${grupo.precio}" step="100">
                    <div class="diff-badge" data-index="${index}" style="font-size: 0.95rem; font-weight: bold; position: absolute; top: 100%; margin-top: 4px; right: 2px; white-space: nowrap; z-index: 10;"></div>
                </div>
                <div style="flex: 1;">
                    <input type="number" class="form-control form-control-sm input-grupo-practicantes" data-index="${index}" value="${grupo.practicantes}" min="0">
                </div>
                <div style="width: 32px;" class="text-right">
                    <button class="btn btn-sm btn-outline-danger btn-remove-abono" data-index="${index}" title="Eliminar" style="padding: 0.25rem 0.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            container.appendChild(row);
            this.updateDiffBadge(index);
        });

        // Re-attach events for dynamic rows
        this.attachAbonoEvents();
    }

    attachAbonoEvents() {
        const rows = this.container.querySelectorAll('#abonos-container > div.grid');
        
        this.container.querySelectorAll('.select-grupo-abono').forEach(select => {
            select.onchange = (e) => {
                const index = e.target.dataset.index;
                const abonoId = e.target.value;
                if (abonoId) {
                    const abono = this.tiposAbono.find(a => a.id == abonoId);
                    if (abono) {
                        this.state.gruposAbono[index].abonoId = abonoId;
                        this.state.gruposAbono[index].precio = parseFloat(abono.precio || 0);
                        this.renderAbonoRows();
                        this.calculate();
                    }
                }
            };
        });

        this.container.querySelectorAll('.input-grupo-precio').forEach(input => {
            input.oninput = (e) => {
                const index = e.target.dataset.index;
                this.state.gruposAbono[index].precio = parseFloat(e.target.value) || 0;
                this.updateDiffBadge(index);
                this.calculate();
            };
        });

        this.container.querySelectorAll('.input-grupo-practicantes').forEach(input => {
            input.oninput = (e) => {
                const index = e.target.dataset.index;
                this.state.gruposAbono[index].practicantes = parseInt(e.target.value, 10) || 0;
                this.calculate();
            };
        });

        this.container.querySelectorAll('.btn-remove-abono').forEach(btn => {
            btn.onclick = (e) => {
                const index = e.currentTarget.dataset.index;
                this.state.gruposAbono.splice(index, 1);
                this.renderAbonoRows();
                this.calculate();
            };
        });
    }

    updateDiffBadge(index) {
        const badge = this.container.querySelector(`.diff-badge[data-index="${index}"]`);
        if (!badge) return;

        const grupo = this.state.gruposAbono[index];
        const abonoReal = this.tiposAbono.find(a => a.id == grupo.abonoId);
        const precioReal = abonoReal ? parseFloat(abonoReal.precio || 0) : 0;

        if (precioReal > 0 && Math.abs(grupo.precio - precioReal) > 0.01) {
            const diffPct = ((grupo.precio - precioReal) / precioReal) * 100;
            const color = diffPct > 0 ? 'var(--success-color)' : 'var(--error-color)';
            const sign = diffPct > 0 ? '+' : '';
            badge.textContent = `${sign}${diffPct.toFixed(1)}%`;
            badge.style.color = color;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    attachEvents() {
        const getEl = (id) => this.container.querySelector(`#${id}`);

        // Add Abono button
        getEl('btn-add-abono').onclick = () => {
            this.state.gruposAbono.push({ id: Date.now(), abonoId: '', precio: 0, practicantes: 0 });
            this.renderAbonoRows();
            this.calculate();
        };

        // Static inputs
        const bindInput = (id, stateKey, isFloat = false) => {
            getEl(id).oninput = (e) => {
                this.state[stateKey] = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                this.calculate();
            };
        };

        bindInput('input-costo-salon', 'costoSalon', true);
        bindInput('input-cuota-profesor', 'cuotaSocialProfesor', true);
        bindInput('input-horas', 'horasSemanales', true);
        bindInput('input-semanas', 'semanasMes', true);

        getEl('input-tipo-costo').onchange = (e) => {
            this.state.tipoCostoSalon = e.target.value;
            this.calculate();
        };

        // Select Place -> Pre-fill costs
        getEl('select-lugar').onchange = (e) => {
            const lugarId = e.target.value;
            if (lugarId) {
                const lugar = this.lugares.find(l => l.id == lugarId);
                if (lugar) {
                    this.state.costoSalon = parseFloat(lugar.costo_tarifa || 0);
                    this.state.tipoCostoSalon = lugar.tipo_tarifa || 'por_hora';
                    this.state.cuotaSocialProfesor = parseFloat(lugar.cuota_social_general || 0);
                    
                    getEl('input-costo-salon').value = this.state.costoSalon;
                    getEl('input-tipo-costo').value = this.state.tipoCostoSalon;
                    getEl('input-cuota-profesor').value = this.state.cuotaSocialProfesor;
                    this.calculate();
                }
            }
        };
    }

    calculate() {
        const { gruposAbono, costoSalon, tipoCostoSalon, cuotaSocialProfesor, horasSemanales, semanasMes } = this.state;

        const ingresoBruto = gruposAbono.reduce((sum, g) => sum + (g.precio * g.practicantes), 0);
        const totalPracticantes = gruposAbono.reduce((sum, g) => sum + g.practicantes, 0);
        
        let egresoSalon = 0;
        if (tipoCostoSalon === 'por_hora') {
            egresoSalon = costoSalon * horasSemanales * semanasMes;
        } else {
            egresoSalon = costoSalon;
        }

        const egresoTotal = egresoSalon + cuotaSocialProfesor;
        const netoMensual = ingresoBruto - egresoTotal;
        
        const horasTotalesMes = horasSemanales * semanasMes;
        const netoHora = horasTotalesMes > 0 ? netoMensual / horasTotalesMes : 0;

        // Update UI
        const format = (val) => `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        this.container.querySelector('#res-ingreso-bruto').textContent = format(ingresoBruto);
        this.container.querySelector('#res-egreso-total').textContent = format(egresoTotal);
        this.container.querySelector('#res-neto-mensual').textContent = format(netoMensual);
        this.container.querySelector('#res-neto-hora').textContent = format(netoHora);
        this.container.querySelector('#res-horas-totales').textContent = `${horasTotalesMes.toFixed(1)} hs`;
        this.container.querySelector('#res-total-practicantes').textContent = totalPracticantes;

        // Style adjustments for negative values
        const netoMensualEl = this.container.querySelector('#res-neto-mensual');
        if (netoMensual < 0) {
            netoMensualEl.classList.remove('text-primary');
            netoMensualEl.classList.add('text-danger');
        } else {
            netoMensualEl.classList.remove('text-danger');
            netoMensualEl.classList.add('text-primary');
        }
    }
}

export default EstimadorPage;
