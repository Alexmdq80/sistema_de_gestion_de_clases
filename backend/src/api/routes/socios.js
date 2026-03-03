import express from 'express';
import Socio from '../../models/Socio.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/socios
 */
router.get('/', asyncHandler(async (req, res) => {
    const { search, lugar_id, practicante_id } = req.query;
    const socios = await Socio.findAll({ search, lugar_id, practicante_id });
    res.json({ data: socios.map(s => s.toJSON()) });
}));

/**
 * GET /api/socios/candidates
 */
router.get('/candidates', asyncHandler(async (req, res) => {
    const candidates = await Socio.findCandidates();
    res.json({ data: candidates });
}));

/**
 * GET /api/socios/my-teacher-lugares
 */
router.get('/my-teacher-lugares', asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const lugares = await Socio.getMyTeacherLugares(userId);
    res.json({ data: lugares });
}));

/**
 * GET /api/socios/teacher-alerts
 */
router.get('/teacher-alerts', asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const alerts = await Socio.getTeacherAlerts(userId);
    res.json({ data: alerts });
}));

/**
 * GET /api/socios/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const socio = await Socio.findById(id);
    if (!socio) throw new AppError('Socio no encontrado', 404);
    res.json({ data: socio.toJSON() });
}));

/**
 * POST /api/socios
 */
router.post('/', asyncHandler(async (req, res) => {
    const { practicante_id, lugar_id, numero_socio } = req.body;
    const userId = req.user.userId;

    if (!practicante_id || !lugar_id) {
        throw new AppError('Faltan campos obligatorios', 400);
    }

    // Check if already exists
    const existing = await Socio.findByPracticanteAndLugar(practicante_id, lugar_id);
    if (existing) {
        throw new AppError('El practicante ya está registrado como socio en este lugar', 400);
    }

    const socio = await Socio.create({ practicante_id, lugar_id, numero_socio }, null, userId);
    res.status(201).json({ data: socio.toJSON() });
}));

/**
 * PUT /api/socios/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { numero_socio } = req.body;
    const userId = req.user.userId;

    const socio = await Socio.update(id, { numero_socio }, null, userId);
    if (!socio) throw new AppError('Socio no encontrado', 404);
    res.json({ data: socio.toJSON() });
}));

/**
 * DELETE /api/socios/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user.userId;

    const deleted = await Socio.delete(id, null, userId);
    if (!deleted) throw new AppError('Socio no encontrado', 404);
    res.json({ message: 'Socio eliminado correctamente' });
}));

export default router;
