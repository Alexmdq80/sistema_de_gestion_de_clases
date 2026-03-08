import express from 'express';
import PagoService from '../../services/pagoService.js';
import { authenticateToken } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../utils/errors.js';

const router = express.Router();

// All routes in this router will require authentication
router.use(authenticateToken);

/**
 * GET /api/pagos
 * Get all payments with optional filtering
 */
router.get('/', asyncHandler(async (req, res) => {
    const { search = '', categoria = '', mes, anio, tipo_abono_id, lugar_id, filter_by_mes_abono, exclude_cuota_social, exclude_profesor_pago, exclude_espacio_costo, fecha_inicio, fecha_fin } = req.query;
    const pagos = await PagoService.getAllPayments({ 
        search, 
        categoria,
        mes: mes ? parseInt(mes, 10) : undefined,
        anio: anio ? parseInt(anio, 10) : undefined,
        tipo_abono_id: tipo_abono_id ? parseInt(tipo_abono_id, 10) : undefined,
        lugar_id: lugar_id ? parseInt(lugar_id, 10) : undefined,
        filter_by_mes_abono: filter_by_mes_abono === 'true',
        exclude_cuota_social: exclude_cuota_social === 'true',
        exclude_profesor_pago: exclude_profesor_pago === 'true',
        exclude_espacio_costo: exclude_espacio_costo === 'true',
        fecha_inicio,
        fecha_fin
    });
    res.status(200).json({ data: pagos });
    }));

    /**
    * GET /api/pagos/abono/:id/balance
    * Get balance of an abono
    */
    router.get('/abono/:id/balance', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { Abono } = await import('../../models/Abono.js');
    const balance = await Abono.getBalance(id);
    res.json({ data: balance });
    }));

    /**
    * POST /api/pagos/partial
    * Register an additional payment for an existing abono
    */
    router.post('/partial', asyncHandler(async (req, res) => {
    const { abono_id, monto, metodo_pago, fecha, notas } = req.body;
    const userId = req.user.userId;

    if (!abono_id || !monto) {
        throw new AppError('Abono ID y Monto son obligatorios', 400);
    }

    const pago = await PagoService.addPaymentToAbono(
        parseInt(abono_id, 10),
        parseFloat(monto),
        metodo_pago,
        fecha,
        notas,
        userId
    );

    res.status(201).json({ data: pago });
    }));

    /**
    * PUT /api/pagos/:id
 * Update a payment's details
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user.userId;
    if (isNaN(id)) {
        throw new AppError('Invalid ID: ID must be a valid integer', 400);
    }

    const updated = await PagoService.updatePayment(id, req.body, userId);
    if (!updated) {
        throw new AppError('Payment not found', 404);
    }

    res.status(200).json({ message: 'Payment updated successfully', data: updated });
}));

/**
 * POST /api/pagos/social-fee
 * Register a payment that is only for a social fee
 */
router.post('/social-fee', asyncHandler(async (req, res) => {
    const { practicante_id, lugar_id, monto, fecha_pago, mes_abono, metodo_pago, observaciones } = req.body;
    const userId = req.user.userId;

    if (!practicante_id || !lugar_id || !monto || !fecha_pago) {
        throw new AppError('Faltan campos obligatorios', 400);
    }

    const pago = await PagoService.createSocialFeeOnlyPayment(
        practicante_id, lugar_id, monto, fecha_pago, mes_abono, metodo_pago, observaciones, userId
    );

    res.status(201).json({ data: pago });
}));

/**
 * DELETE /api/pagos/:id
...

 * Delete (soft-delete) a payment
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user.userId;
    if (isNaN(id)) {
        throw new AppError('Invalid ID: ID must be a valid integer', 400);
    }
    
    await PagoService.deletePayment(id, userId);
    res.status(200).json({ message: 'Payment deleted successfully', data: { id } });
}));

export default router;
