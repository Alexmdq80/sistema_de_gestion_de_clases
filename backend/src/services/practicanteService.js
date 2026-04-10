import Practicante from '../models/Practicante.js';
import HistorialSalud from '../models/HistorialSalud.js';
import { validatePracticante } from '../utils/validators.js'; // Ensure this validator exists or create a mock/placeholder
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js'; // Ensure these error classes exist

// Mock validator if not exists, or I should check if it exists. 
// Based on previous reads, validators.js exists.

/**
 * Practicante Service
 */
export class PracticanteService {
  /**
   * Create a new practicante
   * @param {Object} data - Practicante data
   * @param {number} userId - ID of the user creating the record
   * @returns {Promise<Object>}
   */
  static async create(data, userId) {
    // Validate input (assuming validator function handles basic checks)
    // validatePracticante(data); 

    // Create practicante
    const practicante = await Practicante.create(data, userId);
    return practicante.toJSON();
  }

  /**
   * Find practicante by ID
   * @param {number} id - Practicante ID
   * @returns {Promise<Object>}
   * @throws {NotFoundError}
   */
  static async findById(id) {
    const practicante = await Practicante.findById(id);
    
    if (!practicante) {
      throw new NotFoundError('Practicante', id);
    }

    return practicante.toJSON();
  }

  /**
   * Find all practicantes with search and pagination
   * @param {Object} options - Search options
   * @param {string} options.search - Search term (nombre, telefono, email)
   * @param {number} options.page - Page number
   * @param {number} options.limit - Results per page
   * @param {boolean} options.es_profesor - Filter by teacher status
   * @param {boolean} [options.activo] - Filter by active status (defaults to true if undefined)
   * @returns {Promise<Object>}
   */
  static async findAll(options = {}) {
    const result = await Practicante.findAll(options);
    
    return {
      data: result.data.map(p => p.toJSON()),
      pagination: result.pagination
    };
  }

  /**
   * Update practicante
   * @param {number} id - Practicante ID
   * @param {Object} data - Updated data
   * @param {number} userId - ID of the user updating the record
   * @returns {Promise<Object>}
   * @throws {NotFoundError|ValidationError}
   */
  static async update(id, data, userId) {
    // Check if practicante exists
    const existing = await Practicante.findById(id);
    if (!existing) {
      throw new NotFoundError('Practicante', id);
    }

    // Track health field changes (FR-006)
    // We also want to log these specific changes to HistorialSalud for medical tracking
    // The general history will log the JSON blob change, but HistorialSalud is for specific medical field tracking
    const healthFields = [
      'condiciones_medicas', 'medicamentos', 'limitaciones_fisicas', 'alergias',
      'emergencia_nombre', 'emergencia_telefono', 'obra_social', 'obra_social_nro',
      'emergencia_servicio', 'emergencia_servicio_telefono'
    ];
    const changes = [];

    for (const field of healthFields) {
      if (data.hasOwnProperty(field) && data[field] !== existing[field]) {
        changes.push({
          practicante_id: id,
          campo_modificado: field,
          valor_anterior: existing[field] || null,
          valor_nuevo: data[field] || null
        });
      }
    }

    // Update practicante
    const updated = await Practicante.update(id, data, userId);
    
    // Create health history records for changes
    for (const change of changes) {
      await HistorialSalud.create(change, userId);
    }

    return updated.toJSON();
  }

  /**
   * Delete practicante
   * @param {number} id - Practicante ID
   * @param {number} userId - ID of the user deleting the record
   * @returns {Promise<Object>}
   * @throws {NotFoundError|ConflictError}
   */
  static async delete(id, userId) {
    // Check if practicante exists
    const practicante = await Practicante.findById(id);
    if (!practicante) {
      throw new NotFoundError('Practicante', id);
    }

    // Check for related records
    // With soft delete, we might be more lenient, but business logic might still require cleanup.
    // However, if we soft delete the practicante, we usually want to keep their payments/abonos as historical data.
    // If the requirement is "strict no delete if active stuff exists", we keep this.
    // If soft delete allows "archiving", we might remove this check. 
    // For now, I'll keep the check but modify it to be aware of soft-deleted related items if needed.
    // But since Practicante.hasRelatedRecords now checks for non-deleted items, this is fine.
    
    const hasRelated = await Practicante.hasRelatedRecords(id);
    if (hasRelated) {
        // Option: allow forced delete (archive) or block. 
        // For now, let's block to prevent accidental archiving of active students.
      throw new ConflictError(
        'Cannot delete practicante',
        'Practicante has active abonos or payments. Please handle them first.'
      );
    }

    // Delete practicante
    const deleted = await Practicante.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('Practicante', id);
    }

    return { id };
  }

  /**
   * Get practicante history
   * @param {number} id - Practicante ID
   * @returns {Promise<Array>}
   */
  static async getHistory(id) {
      return await Practicante.getHistory(id);
  }
}

export default PracticanteService;
