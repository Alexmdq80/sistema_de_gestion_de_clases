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
 * GET /api/caja/notas-credito/:lugar_id
 * Returns available credit notes (unspent) for a specific location.
 */
router.get('/notas-credito/:lugar_id', asyncHandler(async (req, res) => {
    const lugarId = parseInt(req.params.lugar_id, 10);
    
    const filters = {
        categoria: 'Nota de Crédito',
        lugar_id: lugarId
    };
    
    const notas = await MovimientoCaja.findAll(filters);
    // Extra filter for unused ones (those without usado_en_clase_id AND without usado_en_pago_id)
    const unusedNotas = notas.filter(n => !n.usado_en_clase_id && !n.usado_en_pago_id);
    res.json({ data: unusedNotas.map(n => n.toJSON()) });
}));

/**
 * GET /api/caja/notas-credito/practicante/:practicante_id
 * Returns available credit notes (unspent) for a specific practitioner.
 */
router.get('/notas-credito/practicante/:practicante_id', asyncHandler(async (req, res) => {
    const practicanteId = parseInt(req.params.practicante_id, 10);
    
    const filters = {
        categoria: 'Nota de Crédito'
    };
    
    const notas = await MovimientoCaja.findAll(filters);
    // Filter by practitioner and unused
    const unusedNotas = notas.filter(n => 
        n.practicante_id === practicanteId && 
        !n.usado_en_clase_id && 
        !n.usado_en_pago_id
    );
    res.json({ data: unusedNotas.map(n => n.toJSON()) });
}));

/**
 * GET /api/caja/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const movimiento = await MovimientoCaja.findById(id);
    if (!movimiento) throw new AppError('Movimiento no encontrado', 404);
    res.json({ data: movimiento.toJSON() });
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
    
    // Check if the movement is already used
    const movimiento = await MovimientoCaja.findById(id);
    if (!movimiento) throw new AppError('Movimiento no encontrado', 404);

    if (movimiento.usado_en_clase_id || movimiento.usado_en_pago_id) {
        throw new AppError('No se puede eliminar una Nota de Crédito que ya ha sido aplicada al pago de una clase o abono. Primero debe anular el pago correspondiente.', 400);
    }

    const deleted = await MovimientoCaja.delete(id);
    if (!deleted) throw new AppError('Error al intentar eliminar el movimiento', 500);
    res.json({ message: 'Movimiento eliminado con éxito', data: { id } });
}));

export default router;
