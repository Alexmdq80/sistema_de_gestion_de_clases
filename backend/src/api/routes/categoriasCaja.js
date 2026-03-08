import express from 'express';
import CategoriaMovimiento from '../../models/CategoriaMovimiento.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', asyncHandler(async (req, res) => {
    const categorias = await CategoriaMovimiento.findAll();
    res.json({ data: categorias });
}));

router.post('/', asyncHandler(async (req, res) => {
    if (!req.body.nombre) throw new AppError('El nombre es obligatorio', 400);
    const cat = await CategoriaMovimiento.create(req.body);
    res.status(201).json({ data: cat });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const deleted = await CategoriaMovimiento.delete(req.params.id);
    if (!deleted) throw new AppError('Categoría no encontrada', 404);
    res.json({ message: 'Categoría eliminada' });
}));

export default router;
