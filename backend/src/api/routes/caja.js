import express from 'express';
import MovimientoCaja from '../../models/MovimientoCaja.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/caja
 */
router.get('/', asyncHandler(async (req, res) => {
    const filters = {
        fecha_inicio: req.query.fecha_inicio,
        fecha_fin: req.query.fecha_fin,
        tipo: req.query.tipo,
        categoria: req.query.categoria
    };
    const movimientos = await MovimientoCaja.findAll(filters);
    res.json({ data: movimientos.map(m => m.toJSON()) });
}));

/**
 * POST /api/caja
 */
router.post('/', asyncHandler(async (req, res) => {
    const data = req.body;
    data.usuario_id = req.user.userId;

    if (!data.tipo || !data.monto || !data.categoria || !data.fecha) {
        throw new AppError('Faltan campos obligatorios (tipo, monto, categoria, fecha)', 400);
    }

    const movimiento = await MovimientoCaja.create(data);
    res.status(201).json({ data: movimiento.toJSON() });
}));

/**
 * PUT /api/caja/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const movimiento = await MovimientoCaja.update(id, req.body);
    if (!movimiento) throw new AppError('Movimiento no encontrado', 404);
    res.json({ data: movimiento.toJSON() });
}));

/**
 * DELETE /api/caja/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const deleted = await MovimientoCaja.delete(id);
    if (!deleted) throw new AppError('Movimiento no encontrado', 404);
    res.json({ message: 'Movimiento eliminado con éxito', data: { id } });
}));

export default router;
