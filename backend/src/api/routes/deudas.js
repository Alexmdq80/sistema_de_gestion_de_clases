import express from 'express';
import Deuda from '../../models/Deuda.js';
import Practicante from '../../models/Practicante.js';
import Abono from '../../models/Abono.js';
import Pago from '../../models/Pago.js';
import PagoService from '../../services/pagoService.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';
import pool from '../../config/database.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/deudas
 * Lista todas las deudas con filtros opcionales, incluyendo saldos pendientes de Abonos.
 */
router.get('/', asyncHandler(async (req, res) => {
    const { practicante_id, estado } = req.query;
    
    // We want to join with Practicante to get the name
    // We use a UNION to include both explicit manual debts and Abono balances
    let sql = `
        SELECT * FROM (
            -- Manual debts from Deuda table
            SELECT 
                d.id, d.practicante_id, 
                (d.monto - IFNULL((SELECT SUM(monto) FROM Pago WHERE deuda_id = d.id AND deleted_at IS NULL), 0)) as monto,
                d.concepto, d.fecha, d.estado,
                NULL as original_estado,
                d.created_at,
                p.nombre_completo as practicante_nombre,
                'manual' as tipo,
                d.monto as monto_original
            FROM Deuda d
            JOIN Practicante p ON d.practicante_id = p.id
            WHERE d.deleted_at IS NULL

            UNION ALL

            -- Outstanding balances from Abono table
            SELECT 
                a.id, a.practicante_id, 
                (IFNULL(a.monto_pactado, 0) - IFNULL((SELECT SUM(monto) FROM Pago WHERE abono_id = a.id AND deleted_at IS NULL), 0)) as monto,
                CONCAT('Saldo Abono: ', ta.nombre, IF(a.mes_abono IS NOT NULL, CONCAT(' (', a.mes_abono, ')'), '')) as concepto,
                a.fecha_inicio as fecha,
                CASE WHEN a.estado = 'cancelado' THEN 'cancelada' ELSE 'pendiente' END as estado,
                a.estado as original_estado,
                a.created_at,                pr.nombre_completo as practicante_nombre,
                'abono' as tipo,
                IFNULL(a.monto_pactado, 0) as monto_original
            FROM Abono a
            JOIN Practicante pr ON a.practicante_id = pr.id
            JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
            WHERE a.deleted_at IS NULL
            HAVING monto > 0 OR (original_estado = 'cancelado' AND monto >= 0)
        ) as todas_deudas
        WHERE 1=1
    `;
    const params = [];

    if (practicante_id) {
        sql += ' AND practicante_id = ?';
        params.push(practicante_id);
    }

    if (estado) {
        sql += ' AND estado = ?';
        params.push(estado);
    }

    sql += ' ORDER BY fecha DESC, created_at DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ data: rows });
}));

/**
 * PUT /api/deudas/:id/pagar
 * Marca una deuda como pagada. Soporta deudas manuales y de Abono.
 */
router.put('/:id/pagar', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { tipo = 'manual' } = req.query;
    const { monto_esperado, monto_pago } = req.body;
    const userId = req.user.userId;

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMesAbono = PagoService.formatMesAbono(todayStr);

    if (tipo === 'abono') {
        // Handle Abono debt payment
        const abono = await Abono.findById(id);
        if (!abono) throw new AppError('Abono no encontrado', 404);
        
        // Si el monto esperado cambia, actualizar Abono.monto_pactado
        if (monto_esperado !== undefined && monto_esperado !== abono.monto_pactado) {
            const oldAbono = abono.toJSON();
            await pool.execute('UPDATE Abono SET monto_pactado = ? WHERE id = ?', [monto_esperado, id]);
            const updatedAbono = await Abono.findById(id);
            await Abono.recordHistory(id, 'UPDATE', oldAbono, updatedAbono.toJSON(), userId);
        }

        const balance = await Abono.getBalance(id);
        if (balance.saldo_pendiente <= 0) throw new AppError('Este abono no tiene saldo pendiente', 400);

        // Record the payment to clear the debt
        // Use current month/year for mes_abono as requested by the user for debt payments
        const newPago = await PagoService.addPaymentToAbono(
            id, 
            monto_pago || balance.saldo_pendiente, 
            'efectivo', // Default for quick pay
            todayStr,
            `[PAGO REGISTRADO DESDE GESTIÓN DE DEUDAS]`,
            userId,
            currentMesAbono
        );

        return res.json({ 
            message: 'Pago de abono registrado correctamente', 
            data: newPago 
        });
    }

    const deuda = await Deuda.findById(id);
    if (!deuda) throw new AppError('Deuda no encontrada', 404);
    if (deuda.estado !== 'pendiente') throw new AppError('Solo se pueden pagar deudas pendientes', 400);

    // Si el monto esperado cambia, actualizar Deuda.monto
    if (monto_esperado !== undefined && monto_esperado !== deuda.monto) {
        const oldDeuda = deuda.toJSON();
        await pool.execute('UPDATE Deuda SET monto = ? WHERE id = ?', [monto_esperado, id]);
        const updatedDeuda = await Deuda.findById(id);
        await Deuda.recordHistory(id, 'UPDATE', oldDeuda, updatedDeuda.toJSON(), userId);
        deuda.monto = monto_esperado; // Actualizar para el cálculo final
    }

    // Crear un Pago con deuda_id = :id y monto = monto_pago
    // Set mes_abono for manual debts to ensure they appear in the monthly balance reports
    let lugarId = null;
    if (deuda.clase_id) {
        const [clases] = await pool.execute('SELECT lugar_id FROM Clase WHERE id = ?', [deuda.clase_id]);
        if (clases.length > 0) lugarId = clases[0].lugar_id;
    }

    const newPago = await Pago.create({
        practicante_id: deuda.practicante_id,
        deuda_id: id,
        monto: monto_pago || deuda.monto,
        mes_abono: currentMesAbono,
        lugar_id: lugarId,
        fecha: todayStr,
        metodo_pago: 'efectivo',
        notas: `[PAGO DE DEUDA MANUAL: ${deuda.concepto}]`
    }, null, userId);

    // Recalcular si la suma de pagos vinculados >= monto total de la deuda para marcarla como 'pagada'
    const [pagos] = await pool.execute('SELECT SUM(monto) as total_pagado FROM Pago WHERE deuda_id = ? AND deleted_at IS NULL', [id]);
    const totalPagado = pagos[0].total_pagado || 0;

    if (totalPagado >= deuda.monto) {
        await pool.execute('UPDATE Deuda SET estado = "pagada" WHERE id = ?', [id]);
        const updated = await Deuda.findById(id);
        await Deuda.recordHistory(id, 'PAY', deuda.toJSON(), updated.toJSON(), userId);
        return res.json({ message: 'Deuda pagada por completo', data: updated.toJSON(), pago: newPago });
    }

    res.json({ message: 'Pago parcial registrado', pago: newPago });
}));

/**
 * PUT /api/deudas/:id/cancelar
 * Cancela una deuda. Si es de Abono, marca el Abono como cancelado.
 */
router.put('/:id/cancelar', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { tipo = 'manual' } = req.query;
    const userId = req.user.userId;

    if (tipo === 'abono') {
        // Cancelling an abono debt means cancelling the abono subscription itself
        const updated = await Abono.updateStatus(id, 'cancelado', null, userId);
        if (!updated) throw new AppError('Abono no encontrado', 404);
        return res.json({ message: 'Abono y su deuda asociada han sido cancelados' });
    }

    const deuda = await Deuda.findById(id);
    if (!deuda) throw new AppError('Deuda no encontrada', 404);
    if (deuda.estado !== 'pendiente') throw new AppError('Solo se pueden cancelar deudas pendientes', 400);

    const sql = 'UPDATE Deuda SET estado = "cancelada" WHERE id = ?';
    await pool.execute(sql, [id]);

    const updated = await Deuda.findById(id);
    await Deuda.recordHistory(id, 'CANCEL', deuda.toJSON(), updated.toJSON(), userId);

    res.json({ message: 'Deuda cancelada correctamente', data: updated.toJSON() });
}));

/**
 * DELETE /api/deudas/:id
 * Eliminación física lógica (soft delete).
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user.userId;

    const deuda = await Deuda.findById(id);
    if (!deuda) throw new AppError('Deuda no encontrada', 404);

    const sql = 'UPDATE Deuda SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
    await pool.execute(sql, [id]);

    await Deuda.recordHistory(id, 'DELETE', deuda.toJSON(), null, userId);

    res.json({ message: 'Registro de deuda eliminado' });
}));

export default router;
