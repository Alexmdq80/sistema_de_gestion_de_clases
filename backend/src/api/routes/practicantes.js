import express from 'express';
import PracticanteService from '../../services/practicanteService.js';
import PagoService from '../../services/pagoService.js'; // Import PagoService
import { asyncHandler, AppError } from '../../utils/errors.js'; // Import AppError
import { sanitizeObject } from '../../utils/validators.js';
import { authenticateToken } from '../../middleware/auth.js'; // Import the middleware

const router = express.Router();

router.use(authenticateToken); // Apply authentication middleware to all routes in this router

/**
 * GET /api/practicantes
 * List all practicantes with optional search and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 50, es_profesor, activo } = req.query;
  
  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  
  if (isNaN(pageNum) || pageNum < 1) {
    throw new AppError('Invalid query parameters: page must be a positive integer', 400);
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
    throw new AppError('Invalid query parameters: limit must be a positive integer between 1 and 1000', 400);
  }

  const result = await PracticanteService.findAll({
    search: String(search),
    page: pageNum,
    limit: limitNum,
    es_profesor: es_profesor !== undefined ? es_profesor === 'true' : undefined,
    activo: activo !== undefined ? activo === 'true' : undefined
  });

  res.json(result);
}));
router.get('/history', asyncHandler(async (req, res) => {
  // This is a placeholder, individual history routes are below
}));

/**
 * GET /api/practicantes/me
 * Get current authenticated user's practicante profile
 */
router.get('/me', asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const practicante = await Practicante.findByUserId(userId);
  if (!practicante) throw new AppError('No se encontró un perfil de practicante para este usuario', 404);
  res.json({ data: practicante.toJSON() });
}));

/**
 * GET /api/practicantes/:id
...
 * Get practicante by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    throw new AppError('Invalid ID: ID must be a valid integer', 400);
  }

  const practicante = await PracticanteService.findById(id);
  res.json({ data: practicante });
}));

/**
 * GET /api/practicantes/:id/history
 * Get practicante history
 */
router.get('/:id/history', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
      throw new AppError('Invalid ID: ID must be a valid integer', 400);
  }
  const history = await PracticanteService.getHistory(id);
  res.json({ data: history });
}));

/**
 * POST /api/practicantes
 * Create a new practicante
 */
router.post('/', asyncHandler(async (req, res) => {
  // Sanitize input
  const data = sanitizeObject(req.body);
  const userId = req.user.userId;
  
  const practicante = await PracticanteService.create(data, userId);
  res.status(201).json({ data: practicante });
}));

/**
 * PUT /api/practicantes/:id
 * Update practicante
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.userId;
  
  if (isNaN(id)) {
    throw new AppError('Invalid ID: ID must be a valid integer', 400);
  }

  // Sanitize input
  const data = sanitizeObject(req.body);
  
  const practicante = await PracticanteService.update(id, data, userId);
  res.json({ data: practicante });
}));

/**
 * DELETE /api/practicantes/:id
 * Delete practicante
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.userId;
  
  if (isNaN(id)) {
    throw new AppError('Invalid ID: ID must be a valid integer', 400);
  }

  await PracticanteService.delete(id, userId);
  res.json({
    message: 'Practicante deleted successfully',
    data: { id }
  });
}));

/**
 * POST /api/practicantes/:id/pagar
 * Record a payment for a practicante's subscription
 */
router.post('/:id/pagar', asyncHandler(async (req, res) => {
  const practicanteId = parseInt(req.params.id, 10);
  const userId = req.user.userId;
  if (isNaN(practicanteId)) {
    throw new AppError('Invalid Practicante ID: ID must be a valid integer', 400);
  }

  const { tipo_abono_id, monto, metodo_pago, notas, cantidad, mes_abono, fecha_vencimiento, fecha_pago, lugar_id } = req.body; // Destructure new fields
  const tipoAbonoId = parseInt(tipo_abono_id, 10);
  if (isNaN(tipoAbonoId) || tipoAbonoId <= 0) {
    throw new AppError('Invalid Tipo de Abono ID: Must be a positive integer', 400);
  }

  const cantidadVal = parseInt(cantidad, 10) || 1;
  if (cantidadVal <= 0) {
      throw new AppError('Invalid cantidad: Must be a positive integer', 400);
  }

  const extraData = {
    monto: monto !== undefined ? parseFloat(monto) : undefined,
    mes_abono: mes_abono || null,
    fecha_vencimiento: fecha_vencimiento || null,
    fecha_pago: fecha_pago || null,
    lugar_id: lugar_id ? parseInt(lugar_id, 10) : null
  };

  const pago = await PagoService.createPayment(practicanteId, tipoAbonoId, metodo_pago, notas, cantidadVal, extraData, userId); // Pass extraData and userId
  res.status(201).json({ message: 'Payment recorded successfully', data: pago });
}));

/**
 * GET /api/practicantes/:id/pagos
 * Get all payments for a specific practicante
 */
router.get('/:id/pagos', asyncHandler(async (req, res) => {
  const practicanteId = parseInt(req.params.id, 10);
  if (isNaN(practicanteId)) {
    throw new AppError('Invalid Practicante ID: ID must be a valid integer', 400);
  }

  const pagos = await PagoService.getPaymentsByPracticanteId(practicanteId);
  res.status(200).json({ data: pagos });
}));

/**
 * DELETE /api/practicantes/:id/pagos/:pagoId
 * Delete (soft-delete) a payment
 */
router.delete('/:id/pagos/:pagoId', asyncHandler(async (req, res) => {
  const pagoId = parseInt(req.params.pagoId, 10);
  const userId = req.user.userId;
  if (isNaN(pagoId)) {
    throw new AppError('Invalid Pago ID: ID must be a valid integer', 400);
  }

  await PagoService.deletePayment(pagoId, userId);
  res.status(200).json({ message: 'Payment deleted successfully', data: { id: pagoId } });
}));

export default router;
