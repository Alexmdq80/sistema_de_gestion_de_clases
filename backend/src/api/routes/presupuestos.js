import express from 'express';
import Presupuesto from '../../models/Presupuesto.js';
import { authenticateToken } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../utils/errors.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/presupuestos
 * Get all budgets
 */
router.get('/', asyncHandler(async (req, res) => {
    const filters = {
        search: req.query.search
    };
    const data = await Presupuesto.findAll(filters);
    res.json({ data });
}));

/**
 * GET /api/presupuestos/:id
 * Get budget by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const data = await Presupuesto.findById(id);
    if (!data) throw new AppError('Presupuesto no encontrado', 404);
    res.json({ data });
}));

/**
 * POST /api/presupuestos
 * Save a new budget
 */
router.post('/', asyncHandler(async (req, res) => {
    const data = req.body;
    data.usuario_id = req.user.userId;

    if (!data.cliente_nombre || !data.fecha || !data.items || data.items.length === 0) {
        throw new AppError('Faltan datos obligatorios para guardar el presupuesto', 400);
    }

    const id = await Presupuesto.create(data);
    res.status(201).json({ message: 'Presupuesto guardado con éxito', data: { id } });
}));

/**
 * DELETE /api/presupuestos/:id
 * Delete budget
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const deleted = await Presupuesto.delete(id);
    if (!deleted) throw new AppError('No se pudo eliminar el presupuesto', 404);
    res.json({ message: 'Presupuesto eliminado con éxito' });
}));

export default router;
