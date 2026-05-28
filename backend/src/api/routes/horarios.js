import express from 'express';
import Horario from '../../models/Horario.js';
import InscripcionHorario from '../../models/InscripcionHorario.js';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/horarios
 */
router.get('/', asyncHandler(async (req, res) => {
    const filters = {
        actividad_id: req.query.actividad_id,
        lugar_id: req.query.lugar_id,
        dia_semana: req.query.dia_semana,
        activo: req.query.activo,
        tipo: req.query.tipo
    };
    const horarios = await Horario.findAll(filters);
    res.json({ data: horarios.map(h => h.toJSON()) });
}));

/**
 * GET /api/horarios/practicante/:id
 * Obtiene las inscripciones a horarios de un practicante.
 */
router.get('/practicante/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const inscripciones = await InscripcionHorario.findByPracticante(id);
    res.json({ data: inscripciones });
}));

/**
 * POST /api/horarios/practicante/:id
 * Actualiza (sincroniza) las inscripciones a horarios de un practicante.
 */
router.post('/practicante/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { horarioIds } = req.body;
    
    await InscripcionHorario.updateByPracticante(id, horarioIds, req.user.userId);
    res.json({ message: 'Inscripciones actualizadas con éxito' });
}));

/**
 * REST CRUD para Horarios (ya existentes o nuevos)
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const horario = await Horario.findById(id);
    if (!horario) throw new AppError('Horario no encontrado', 404);
    res.json({ data: horario.toJSON() });
}));

router.post('/', asyncHandler(async (req, res) => {
    const horario = await Horario.create(req.body, req.user.userId);
    res.status(201).json({ data: horario.toJSON() });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const horario = await Horario.update(id, req.body, req.user.userId);
    if (!horario) throw new AppError('Horario no encontrado', 404);
    res.json({ data: horario.toJSON() });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const deleted = await Horario.delete(id, req.user.userId);
    if (!deleted) throw new AppError('Horario no encontrado', 404);
    res.json({ message: 'Horario eliminado con éxito' });
}));

export default router;
