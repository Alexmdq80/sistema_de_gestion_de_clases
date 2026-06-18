import Pago from '../models/Pago.js';
import Practicante from '../models/Practicante.js';
import TipoAbono from '../models/TipoAbono.js';
import Abono from '../models/Abono.js';
import Deuda from '../models/Deuda.js';
import Socio from '../models/Socio.js';
import PagoSocio from '../models/PagoSocio.js';
import { AppError } from '../utils/errors.js';
import pool from '../config/database.js'; // Import pool to get connection

export class PagoService {
    /**
     * Helper to format a date into a mes_abono string (e.g., "Abril 2026")
     * @param {string|Date} date 
     * @returns {string}
     */
    static formatMesAbono(date) {
        const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    }

    /**
     * Create a new payment for a practicante
     * @param {number} practicanteId - ID of the practicante
     * @param {number} tipoAbonoId - ID of the TipoAbono
     * @param {string} [metodoPago='efectivo'] - Payment method
     * @param {string} [notas=null] - Optional notes for the payment
     * @param {number} [cantidad=1] - Number of units or multipliers
     * @param {Object} [extraData={}] - Extra data (mes_abono, fecha_vencimiento)
     * @param {number} [userId=null] - ID of the user creating the payment
     * @returns {Promise<Pago>}
     */
    static async createPayment(practicanteId, tipoAbonoId, metodoPago = 'efectivo', notas = null, cantidad = 1, extraData = {}, userId = null) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Use models with the transaction connection
            const practicante = await Practicante.findById(practicanteId, connection);
            if (!practicante) {
                throw new AppError('Practicante not found', 404);
            }

            const tipoAbono = await TipoAbono.findById(tipoAbonoId, connection);
            if (!tipoAbono) {
                throw new AppError('Tipo de Abono not found', 404);
            }

            const today = new Date();
            // Use local date for YYYY-MM-DD to avoid UTC shifts
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            const fechaPagoStr = extraData.fecha_pago || todayStr;

            // 0. Auto-expire old abonos for this student to keep the record clean
            await Abono.expireOldAbonos(practicanteId, connection, userId);

            // 1. Determine start date
            const activeAbono = await Abono.findActiveByPracticanteId(practicanteId, connection);
            let fechaInicio = new Date(today);
            
            // For flexible classes (particular/compartida), we don't usually stack by date
            const isFlexible = (tipoAbono.categoria === 'particular' || tipoAbono.categoria === 'compartida');

            if (!isFlexible && activeAbono && new Date(activeAbono.fecha_vencimiento) >= today) {
                const existingVencimiento = new Date(activeAbono.fecha_vencimiento);
                fechaInicio = new Date(existingVencimiento);
                fechaInicio.setDate(fechaInicio.getDate() + 1);
            }

            // 2. Calculate expiration date
            let fechaVencimiento;
            
            if (extraData.fecha_vencimiento) {
                fechaVencimiento = new Date(extraData.fecha_vencimiento);
            } else {
                // If it's a "unit-based" class (duration 0), expiration is the same day as start.
                const duracion = tipoAbono.duracion_dias !== null ? tipoAbono.duracion_dias : 0;
                const totalDuracion = duracion * cantidad;
                
                const baseDate = new Date(fechaInicio);
                baseDate.setDate(baseDate.getDate() + totalDuracion);
                fechaVencimiento = baseDate;
            }

            // Safety check: ensure fechaVencimiento >= fechaInicio to satisfy DB constraint
            if (fechaVencimiento < fechaInicio) {
                fechaInicio = new Date(fechaVencimiento);
            }

            const fechaInicioStr = `${fechaInicio.getFullYear()}-${String(fechaInicio.getMonth() + 1).padStart(2, '0')}-${String(fechaInicio.getDate()).padStart(2, '0')}`;
            const fechaVencimientoStr = `${fechaVencimiento.getFullYear()}-${String(fechaVencimiento.getMonth() + 1).padStart(2, '0')}-${String(fechaVencimiento.getDate()).padStart(2, '0')}`;

            // 3. Create Abono record
            const abonoData = {
                practicante_id: practicanteId,
                tipo_abono_id: tipoAbonoId,
                fecha_inicio: fechaInicioStr,
                fecha_vencimiento: fechaVencimientoStr,
                mes_abono: extraData.mes_abono || null,
                lugar_id: extraData.lugar_id || tipoAbono.lugar_id,
                estado: 'activo',
                cantidad: cantidad,
                monto_pactado: extraData.monto_pactado !== undefined ? parseFloat(extraData.monto_pactado) : (tipoAbono.precio || 0) * cantidad
            };
            
            // Pass userId to create method for history
            const newAbono = await Abono.create(abonoData, connection, userId);

            // 4. Create Pago record linked to the new Abono
            let totalMonto = extraData.monto !== undefined ? parseFloat(extraData.monto) : (tipoAbono.precio || 0) * cantidad;
            let finalNotas = notas || '';
            let pagoSocioId = null;

            // Handle Social Fee if requested - Only sum the money and add a note
            if (extraData.cuota_social) {
                const cs = extraData.cuota_social;
                totalMonto += parseFloat(cs.monto || 0);
                const socialFeeNote = `[RECIBIDO CUOTA SOCIAL: $${cs.monto}]`;
                finalNotas = finalNotas ? `${finalNotas} | ${socialFeeNote}` : socialFeeNote;

                // Create PagoSocio record so it appears in "Gestión de Socios"
                const socio = await Socio.findByPracticanteAndLugar(practicanteId, abonoData.lugar_id, connection);
                if (socio) {
                    // Check if already paid for this month to avoid duplicates
                    const mesAbono = abonoData.mes_abono;
                    const alreadyPaid = await PagoSocio.existsForSocioAndMonth(socio.id, mesAbono);
                    
                    if (!alreadyPaid) {
                        const newPagoSocio = await PagoSocio.create({
                            socio_id: socio.id,
                            monto: parseFloat(cs.monto),
                            mes_abono: mesAbono,
                            fecha_pago: fechaPagoStr,
                            fecha_vencimiento: null, // Will be completed in Gestion Socios
                            observaciones: `Registrado junto con abono ${newAbono.id}`
                        }, connection, userId);
                        pagoSocioId = newPagoSocio.id;
                    }
                }
            }

            const pagoData = {
                practicante_id: practicanteId,
                abono_id: newAbono.id, // Linked to the newly created Abono
                pago_socio_id: pagoSocioId,
                mes_abono: abonoData.mes_abono,
                lugar_id: abonoData.lugar_id,
                fecha: fechaPagoStr,
                monto: totalMonto,
                metodo_pago: metodoPago,
                notas: finalNotas
            };

            // Pass userId to create method for history
            const newPago = await Pago.create(pagoData, connection, userId);

            // 5. Link Credit Notes if provided
            if (extraData.nota_credito_ids && extraData.nota_credito_ids.length > 0) {
                // Determine how much NC value we should actually consume
                // If monto_pactado was provided, we target that balance. 
                // If not, we target the default (tipoAbono.precio * cantidad)
                const targetTotal = extraData.monto_pactado !== undefined ? parseFloat(extraData.monto_pactado) : (tipoAbono.precio || 0) * cantidad;
                let remainingToCover = Math.max(0, targetTotal - parseFloat(extraData.monto || 0));

                for (const ncId of extraData.nota_credito_ids) {
                    const [rows] = await connection.execute(
                        'SELECT * FROM MovimientoCaja WHERE id = ? AND practicante_id = ? AND usado_en_clase_id IS NULL AND usado_en_pago_id IS NULL AND deleted_at IS NULL',
                        [ncId, practicanteId]
                    );

                    if (rows.length > 0) {
                        const nc = rows[0];
                        const ncMonto = parseFloat(nc.monto);

                        if (ncMonto <= remainingToCover + 0.01) {
                            // Use full NC
                            await connection.execute(
                                'UPDATE MovimientoCaja SET usado_en_pago_id = ? WHERE id = ?',
                                [newPago.id, ncId]
                            );
                            remainingToCover -= ncMonto;
                        } else {
                            // Split NC: Use only what's needed
                            const amountToUse = remainingToCover;
                            const remainder = ncMonto - amountToUse;

                            // 1. Update original to the amount used and mark as used
                            await connection.execute(
                                'UPDATE MovimientoCaja SET monto = ?, usado_en_pago_id = ?, descripcion = CONCAT(IFNULL(descripcion, ""), " (Uso parcial de $", ?, ")") WHERE id = ?',
                                [amountToUse, newPago.id, ncMonto.toFixed(2), ncId]
                            );

                            // 2. Create new NC for the remainder
                            await connection.execute(
                                `INSERT INTO MovimientoCaja (tipo, monto, categoria, descripcion, fecha, lugar_id, practicante_id, usuario_id)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    nc.tipo,
                                    remainder,
                                    nc.categoria,
                                    `Saldo restante de NC #${ncId} (Original: $${ncMonto.toFixed(2)})`,
                                    nc.fecha,
                                    nc.lugar_id,
                                    nc.practicante_id,
                                    userId
                                ]
                            );
                            
                            remainingToCover = 0;
                        }
                    }
                    
                    if (remainingToCover <= 0) break; // Covered everything needed
                }
            }

            // 6. Explicit Debt Creation: If there's a pending balance and the user requested debt generation,
            // we create a physical record in the Deuda table.
            if (extraData.generar_deuda) {
                const balance = await Abono.getBalance(newAbono.id, connection);
                if (balance.saldo_pendiente > 0.01) {
                    await Deuda.create({
                        practicante_id: practicanteId,
                        monto: balance.saldo_pendiente,
                        concepto: `Saldo pendiente: ${tipoAbono.nombre}${abonoData.mes_abono ? ` (${abonoData.mes_abono})` : ''}`,
                        fecha: fechaPagoStr,
                        estado: 'pendiente',
                        abono_id: newAbono.id,
                        usuario_id: userId
                    }, connection, userId);
                }
            }

            await connection.commit();
            return newPago;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Add a payment to an existing abono (partial payment)
     * @param {number} abonoId 
     * @param {number} monto 
     * @param {string} metodoPago 
     * @param {string} fecha 
     * @param {string} notas 
     * @param {number} userId 
     * @param {string} [mes_abono=null] - Optional override for the accrual month
     * @param {boolean} [finalizar_deuda=false] - If true, adjusts monto_pactado to match total payments
     * @param {boolean} [generar_deuda=false] - If true, creates a Deuda record for any remaining balance
     */
    static async addPaymentToAbono(abonoId, monto, metodoPago, fecha, notas, userId, mes_abono = null, finalizar_deuda = false, generar_deuda = false) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const abono = await Abono.findById(abonoId, connection);
            if (!abono) throw new AppError('Abono no encontrado', 404);

            const todayStr = fecha || new Date().toISOString().split('T')[0];

            // 1. Check if there's an existing pending debt for this abono
            const [existingDebts] = await connection.execute(
                'SELECT * FROM Deuda WHERE abono_id = ? AND estado = "pendiente" AND deleted_at IS NULL',
                [abonoId]
            );
            const existingDeuda = existingDebts.length > 0 ? existingDebts[0] : null;

            const pagoData = {
                practicante_id: abono.practicante_id,
                abono_id: abono.id,
                deuda_id: existingDeuda ? existingDeuda.id : null,
                mes_abono: mes_abono || abono.mes_abono,
                lugar_id: abono.lugar_id,
                fecha: todayStr,
                monto: monto,
                metodo_pago: metodoPago,
                notas: `[PAGO ADICIONAL] ${notas || ''}`.trim()
            };

            const newPago = await Pago.create(pagoData, connection, userId);

            // 2. If we are finalizing the debt, we adjust pactado and cancel any pending debt record
            if (finalizar_deuda) {
                // Adjust monto_pactado to be the sum of all payments (including the new one)
                const [rows] = await connection.execute(
                    'SELECT SUM(monto) as total_pagado FROM Pago WHERE abono_id = ? AND deleted_at IS NULL',
                    [abonoId]
                );
                const totalPagado = rows[0].total_pagado || 0;

                // Include credit notes in the total to correctly adjust pactado
                const [ncRows] = await connection.execute(
                    'SELECT IFNULL(SUM(m.monto), 0) as total_nc FROM MovimientoCaja m JOIN Pago p ON m.usado_en_pago_id = p.id WHERE p.abono_id = ? AND m.deleted_at IS NULL AND p.deleted_at IS NULL',
                    [abonoId]
                );
                const totalNC = ncRows[0].total_nc || 0;

                const newMontoPactado = parseFloat(totalPagado) + parseFloat(totalNC);

                const oldAbono = abono.toJSON();
                await connection.execute('UPDATE Abono SET monto_pactado = ? WHERE id = ?', [newMontoPactado, abonoId]);
                
                const updatedAbono = await Abono.findById(abonoId, connection);
                await Abono.recordHistory(abonoId, 'UPDATE', oldAbono, updatedAbono.toJSON(), userId, connection);

                // If there was a pending debt record, cancel it since it's no longer owed
                if (existingDeuda) {
                    await connection.execute('UPDATE Deuda SET estado = "cancelada" WHERE id = ?', [existingDeuda.id]);
                    await Deuda.recordHistory(existingDeuda.id, 'CANCEL', existingDeuda, { ...existingDeuda, estado: 'cancelada' }, userId, connection);
                }
            } else {
                // 3. If not finalizing, check if we should update or create a debt record
                const balance = await Abono.getBalance(abonoId, connection);

                if (existingDeuda) {
                    // Check if the debt is now fully paid
                    const [pRows] = await connection.execute(
                        'SELECT SUM(monto) as total_pagado FROM Pago WHERE deuda_id = ? AND deleted_at IS NULL',
                        [existingDeuda.id]
                    );
                    const totalPagadoDeuda = pRows[0].total_pagado || 0;

                    if (totalPagadoDeuda >= existingDeuda.monto - 0.01) {
                        await connection.execute('UPDATE Deuda SET estado = "pagada" WHERE id = ?', [existingDeuda.id]);
                        await Deuda.recordHistory(existingDeuda.id, 'PAY', existingDeuda, { ...existingDeuda, estado: 'pagada' }, userId, connection);
                    }
                } else if (generar_deuda && balance.saldo_pendiente > 0.01) {
                    // Create a new debt record if requested and balance remains
                    await Deuda.create({
                        practicante_id: abono.practicante_id,
                        monto: balance.saldo_pendiente,
                        concepto: `Saldo pendiente: (PAGO PARCIAL) ${abono.mes_abono || ''}`,
                        fecha: todayStr,
                        estado: 'pendiente',
                        abono_id: abonoId,
                        usuario_id: userId
                    }, connection, userId);
                }
            }

            await connection.commit();
            return newPago;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Create a payment that is only for a social fee (no abono)
     * @param {number} practicanteId 
     * @param {number} lugarId 
     * @param {number} monto 
     * @param {string} fechaPago - YYYY-MM-DD
     * @param {string} mesAbono - e.g. "Marzo 2026"
     * @param {string} metodoPago 
     * @param {string} notas 
     * @param {number} userId 
     */
    static async createSocialFeeOnlyPayment(practicanteId, lugarId, monto, fechaPago, mesAbono, metodoPago, notas, userId) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Record in Socio file as "Received from student"
            let pagoSocioId = null;
            const socio = await Socio.findByPracticanteAndLugar(practicanteId, lugarId, connection);
            if (socio) {
                // Duplication Check
                const alreadyPaid = await PagoSocio.existsForSocioAndMonth(socio.id, mesAbono);
                if (alreadyPaid) {
                    throw new AppError(`Ya existe una cuota social registrada para ${mesAbono} para este practicante en esta sede.`, 400);
                }

                const newPagoSocio = await PagoSocio.create({
                    socio_id: socio.id,
                    monto: monto,
                    mes_abono: mesAbono,
                    fecha_pago: null,
                    fecha_vencimiento: null,
                    observaciones: null
                }, connection, userId);
                pagoSocioId = newPagoSocio.id;
            }

            // 2. General Cash Register (Pago) linked to PagoSocio
            const pagoData = {
                practicante_id: practicanteId,
                abono_id: null,
                pago_socio_id: pagoSocioId,
                mes_abono: mesAbono,
                lugar_id: lugarId,
                fecha: fechaPago,
                monto: monto,
                metodo_pago: metodoPago,
                notas: `[PAGO ÚNICO: CUOTA SOCIAL] ${notas || ''}`.trim()
            };

            const newPago = await Pago.create(pagoData, connection, userId);

            await connection.commit();
            return newPago;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get all payments with optional filtering
     * @param {Object} [filters] - Search filters
     * @returns {Promise<Pago[]>}
     */
    static async getAllPayments(filters = {}) {
        return await Pago.findAll(filters);
    }

    /**
     * Get all payments for a specific practicante
     * @param {number} practicanteId - ID of the practicante
     * @returns {Promise<Pago[]>}
     */
    static async getPaymentsByPracticanteId(practicanteId) {
        return await Pago.findByPracticanteId(practicanteId);
    }

    /**
     * Update a payment's basic information
     * @param {number} pagoId - ID of the payment to update
     * @param {Object} data - Updated data
     * @param {number} [userId=null] - User ID
     * @returns {Promise<Pago|null>}
     */
    static async updatePayment(pagoId, data, userId = null) {
        return await Pago.update(pagoId, data, null, userId);
    }

    /**
     * Delete (soft-delete) a payment and cancel its related abono
     * @param {number} pagoId - ID of the payment to delete
     * @param {number} [userId=null] - ID of the user deleting the payment
     * @returns {Promise<boolean>}
     */
    static async deletePayment(pagoId, userId = null) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const pago = await Pago.findById(pagoId, connection);
            if (!pago) {
                throw new AppError('Payment not found', 404);
            }

            // 1. Soft delete the payment
            const deleted = await Pago.delete(pagoId, connection, userId);

            // 1b. Release associated credit notes
            await connection.execute(
                'UPDATE MovimientoCaja SET usado_en_pago_id = NULL WHERE usado_en_pago_id = ? AND deleted_at IS NULL',
                [pagoId]
            );

            // 2. Mark related abono as 'cancelado' if it exists
            // and cancel any associated pending debts
            if (pago.abono_id) {
                await Abono.updateStatus(pago.abono_id, 'cancelado', connection, userId);
                
                // Cancel any pending debt record for this abono
                const [debtsToCancel] = await connection.execute(
                    'SELECT * FROM Deuda WHERE abono_id = ? AND estado = "pendiente" AND deleted_at IS NULL',
                    [pago.abono_id]
                );
                for (const d of debtsToCancel) {
                    await connection.execute('UPDATE Deuda SET estado = "cancelada" WHERE id = ?', [d.id]);
                    await Deuda.recordHistory(d.id, 'CANCEL', d, { ...d, estado: 'cancelada' }, userId, connection);
                }
            }

            // 2b. If the payment was linked to a debt, check if we need to re-open it
            if (pago.deuda_id) {
                const [deudaRows] = await connection.execute('SELECT * FROM Deuda WHERE id = ?', [pago.deuda_id]);
                if (deudaRows.length > 0) {
                    const debt = deudaRows[0];
                    if (debt.estado === 'pagada') {
                        // Check if remaining payments are enough to keep it as 'pagada'
                        const [pRows] = await connection.execute(
                            'SELECT SUM(monto) as total_pagado FROM Pago WHERE deuda_id = ? AND id != ? AND deleted_at IS NULL',
                            [pago.deuda_id, pagoId]
                        );
                        const totalRemaining = pRows[0].total_pagado || 0;
                        if (totalRemaining < debt.monto - 0.01) {
                            await connection.execute('UPDATE Deuda SET estado = "pendiente" WHERE id = ?', [pago.deuda_id]);
                            await Deuda.recordHistory(pago.deuda_id, 'REOPEN', debt, { ...debt, estado: 'pendiente' }, userId, connection);
                        }
                    }
                }
            }

            // 3. Delete related PagoSocio if it exists
            if (pago.pago_socio_id) {
                await PagoSocio.delete(pago.pago_socio_id, connection, userId);
            }

            await connection.commit();
            return deleted;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default PagoService;
