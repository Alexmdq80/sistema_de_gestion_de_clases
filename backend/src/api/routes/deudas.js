import express from 'express';
import Deuda from '../../models/Deuda.js';
import Practicante from '../../models/Practicante.js';
import Abono from '../../models/Abono.js';
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
                d.id, d.practicante_id, d.monto, d.concepto, d.fecha, d.estado, d.created_at,
                p.nombre_completo as practicante_nombre,
                'manual' as tipo
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
                'pendiente' as estado, 
                a.created_at,
                pr.nombre_completo as practicante_nombre,
                'abono' as tipo
            FROM Abono a
            JOIN Practicante pr ON a.practicante_id = pr.id
            JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
            WHERE a.deleted_at IS NULL 
            AND (
                a.estado != 'cancelado' 
                OR 
                IFNULL((SELECT SUM(monto) FROM Pago WHERE abono_id = a.id AND deleted_at IS NULL), 0) > 0
            )
            HAVING monto > 0
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
    const userId = req.user.userId;

    if (tipo === 'abono') {
        // Handle Abono debt payment
        const abono = await Abono.findById(id);
        if (!abono) throw new AppError('Abono no encontrado', 404);
        
        const balance = await Abono.getBalance(id);
        if (balance.saldo_pendiente <= 0) throw new AppError('Este abono no tiene saldo pendiente', 400);

        // Record the payment to clear the debt
        const newPago = await PagoService.addPaymentToAbono(
            id, 
            balance.saldo_pendiente, 
            'efectivo', // Default for quick pay
            new Date().toISOString().split('T')[0],
            '[PAGO TOTAL DE SALDO DESDE GESTIÓN DE DEUDAS]',
            userId
        );

        return res.json({ 
            message: 'Deuda de abono pagada y registrada correctamente', 
            data: newPago 
        });
    }

    const deuda = await Deuda.findById(id);
    if (!deuda) throw new AppError('Deuda no encontrada', 404);
    if (deuda.estado !== 'pendiente') throw new AppError('Solo se pueden pagar deudas pendientes', 400);

    const sql = 'UPDATE Deuda SET estado = "pagada" WHERE id = ?';
    await pool.execute(sql, [id]);

    const updated = await Deuda.findById(id);
    await Deuda.recordHistory(id, 'PAY', deuda.toJSON(), updated.toJSON(), userId);

    res.json({ message: 'Deuda marcada como pagada', data: updated.toJSON() });
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
