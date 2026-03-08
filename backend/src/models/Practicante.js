import pool from '../config/database.js';

/**
 * Practicante Model
 */
export class Practicante {
    constructor(data) {
        this.id = data.id || null;
        this.user_id = data.user_id || null;
        this.es_profesor = data.es_profesor !== undefined ? !!data.es_profesor : false;
        this.nombre_completo = data.nombre_completo;
        this.dni = data.dni || null;
        this.fecha_nacimiento = data.fecha_nacimiento || null;
        this.genero = data.genero || null;
        this.telefono = data.telefono || null;
        this.email = data.email || null;
        this.direccion = data.direccion || null;
        this.condiciones_medicas = data.condiciones_medicas || null;
        this.medicamentos = data.medicamentos || null;
        this.limitaciones_fisicas = data.limitaciones_fisicas || null;
        this.alergias = data.alergias || null;
        
        // Extended information
        this.emergencia_nombre = data.emergencia_nombre || null;
        this.emergencia_telefono = data.emergencia_telefono || null;
        this.obra_social = data.obra_social || null;
        this.obra_social_nro = data.obra_social_nro || null;
        this.emergencia_servicio = data.emergencia_servicio || null;
        this.emergencia_servicio_telefono = data.emergencia_servicio_telefono || null;
        this.ocupacion = data.ocupacion || null;
        this.estudios = data.estudios || null;
        this.actividad_fisica_actual = data.actividad_fisica_actual !== undefined ? !!data.actividad_fisica_actual : false;
        this.actividad_fisica_detalle = data.actividad_fisica_detalle || null;
        this.actividad_fisica_anios_inactivo = data.actividad_fisica_anios_inactivo || null;
        this.actividad_fisica_anterior = data.actividad_fisica_anterior || null;
        this.observaciones_adicionales = data.observaciones_adicionales || null;

        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.deleted_at = data.deleted_at || null;
    }

    /**
     * Create a new practicante and record history
     * @param {Object} data - Practicante data
     * @param {number} userId - ID of the user creating it
     * @returns {Promise<Practicante>}
     */
    static async create(data, userId = null) {
        const sql = `
      INSERT INTO Practicante (
        user_id, es_profesor, nombre_completo, dni, fecha_nacimiento, genero, telefono, email,
        direccion, condiciones_medicas, medicamentos, limitaciones_fisicas, alergias,
        emergencia_nombre, emergencia_telefono, obra_social, obra_social_nro,
        emergencia_servicio, emergencia_servicio_telefono, ocupacion, estudios,
        actividad_fisica_actual, actividad_fisica_detalle, actividad_fisica_anios_inactivo,
        actividad_fisica_anterior, observaciones_adicionales
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const values = [
            data.user_id || null,
            data.es_profesor !== undefined ? data.es_profesor : false,
            data.nombre_completo,
            data.dni || null,
            data.fecha_nacimiento || null,
            data.genero || null,
            data.telefono || null,
            data.email || null,
            data.direccion || null,
            data.condiciones_medicas || null,
            data.medicamentos || null,
            data.limitaciones_fisicas || null,
            data.alergias || null,
            data.emergencia_nombre || null,
            data.emergencia_telefono || null,
            data.obra_social || null,
            data.obra_social_nro || null,
            data.emergencia_servicio || null,
            data.emergencia_servicio_telefono || null,
            data.ocupacion || null,
            data.estudios || null,
            data.actividad_fisica_actual !== undefined ? data.actividad_fisica_actual : false,
            data.actividad_fisica_detalle || null,
            data.actividad_fisica_anios_inactivo || null,
            data.actividad_fisica_anterior || null,
            data.observaciones_adicionales || null
        ];

        const [result] = await pool.execute(sql, values);
        const newPracticante = await this.findById(result.insertId);

        if (newPracticante) {
            await this.recordHistory(newPracticante.id, 'CREATE', null, newPracticante.toJSON(), userId);
        }

        return newPracticante;
    }

    /**
     * Find practicante by ID (only non-deleted)
     * @param {number} id - Practicante ID
     * @param {Object} [connection] - Database connection
     * @returns {Promise<Practicante|null>}
     */
    static async findById(id, connection = null) {
        const sql = 'SELECT * FROM Practicante WHERE id = ? AND deleted_at IS NULL';
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [id]);

        if (rows.length === 0) {
            return null;
        }

        return new Practicante(rows[0]);
    }

    /**
     * Find all practicantes with optional search (only non-deleted)
     * @param {Object} options - Search options
     * @param {string} options.search - Search term (nombre, telefono, email)
     * @param {number} options.page - Page number
     * @param {number} options.limit - Results per page
     * @param {boolean} options.es_profesor - Filter by teacher status
     * @returns {Promise<Object>} - { data: Practicante[], pagination: {...} }
     */
    static async findAll(options = {}) {
        const { search = '', page = 1, limit = 50, es_profesor } = options;

        // Validate and convert to integers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Build WHERE clause
        let whereClause = ' WHERE deleted_at IS NULL';
        const searchParams = [];

        if (search && search.trim() !== '') {
            whereClause += ' AND (nombre_completo LIKE ? OR IFNULL(dni, "") LIKE ? OR IFNULL(telefono, "") LIKE ? OR IFNULL(email, "") LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            searchParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (es_profesor !== undefined) {
            whereClause += ' AND es_profesor = ?';
            searchParams.push(es_profesor ? 1 : 0);
        }

        // Get total count
        const countSql = `SELECT COUNT(*) as total FROM Practicante${whereClause}`;
        const [countRows] = await pool.execute(countSql, searchParams);
        const total = countRows[0]?.total || 0;

        // Get paginated results
        const sql = `
            SELECT 
                p.*, 
                (SELECT COUNT(*) FROM Socio s WHERE s.practicante_id = p.id AND s.deleted_at IS NULL) as socio_count,
                
                -- Último tipo de abono pagado (que no sea cuota social)
                (SELECT ta.nombre 
                 FROM Pago pg 
                 JOIN Abono ab ON pg.abono_id = ab.id 
                 JOIN TipoAbono ta ON ab.tipo_abono_id = ta.id 
                 WHERE pg.practicante_id = p.id AND pg.deleted_at IS NULL 
                 ORDER BY pg.fecha DESC, pg.id DESC LIMIT 1) as ultimo_abono_nombre,
                
                -- Mes del último abono pagado
                (SELECT pg.mes_abono 
                 FROM Pago pg 
                 JOIN Abono ab ON pg.abono_id = ab.id 
                 WHERE pg.practicante_id = p.id AND pg.deleted_at IS NULL 
                 ORDER BY pg.fecha DESC, pg.id DESC LIMIT 1) as ultimo_abono_mes,
                
                -- Última cuota social recibida del practicante (buscando en Pago)
                (SELECT pg.mes_abono 
                 FROM Pago pg 
                 WHERE pg.practicante_id = p.id AND pg.abono_id IS NULL AND pg.deleted_at IS NULL 
                 ORDER BY pg.fecha DESC, pg.id DESC LIMIT 1) as ultima_cuota_social_recibida_mes,

                -- Última cuota social pagada a la institución (buscando en PagoSocio)
                (SELECT ps.mes_abono 
                 FROM PagoSocio ps 
                 JOIN Socio s ON ps.socio_id = s.id 
                 WHERE s.practicante_id = p.id AND ps.fecha_pago IS NOT NULL AND ps.deleted_at IS NULL 
                 ORDER BY ps.fecha_pago DESC, ps.id DESC LIMIT 1) as ultima_cuota_social_pagada_mes,
                 
                -- Clases restantes (Balance histórico: compradas - asistidas)
                -- Incluye clases particulares/compartidas Y clases sueltas (duracion 0)
                (SELECT 
                    (SELECT IFNULL(SUM(ab.cantidad), 0) 
                     FROM Abono ab 
                     JOIN TipoAbono ta ON ab.tipo_abono_id = ta.id 
                     WHERE ab.practicante_id = p.id 
                       AND (ta.categoria IN ('particular', 'compartida') OR ta.duracion_dias = 0)
                       AND ab.deleted_at IS NULL)
                    -
                    (SELECT COUNT(*) 
                     FROM Asistencia asis 
                     JOIN Clase cl ON asis.clase_id = cl.id 
                     WHERE asis.practicante_id = p.id 
                       AND asis.asistio = 1 
                       AND cl.deleted_at IS NULL
                       AND (cl.tipo = 'flexible' OR EXISTS (
                           SELECT 1 FROM TipoAbono ta2 
                           JOIN Abono ab2 ON ta2.id = ab2.tipo_abono_id
                           WHERE ab2.id = cl.horario_id -- Note: if it was a manual class, we might need more logic
                           AND ta2.duracion_dias = 0
                       ))
                       AND cl.fecha <= CURDATE())
                 WHERE EXISTS (
                     SELECT 1 FROM Abono ab3 
                     JOIN TipoAbono ta3 ON ab3.tipo_abono_id = ta3.id 
                     WHERE ab3.practicante_id = p.id 
                       AND (ta3.categoria IN ('particular', 'compartida') OR ta3.duracion_dias = 0) 
                       AND ab3.deleted_at IS NULL
                 )
                ) as clases_restantes

            FROM Practicante p${whereClause} 
            ORDER BY p.nombre_completo ASC 
            LIMIT ${limitNum} OFFSET ${offset}
        `;

        const [rows] = await pool.execute(sql, searchParams);
        const practicantes = rows.map(row => {
            const p = new Practicante(row);
            p.socio_count = row.socio_count || 0;
            p.ultimo_abono_nombre = row.ultimo_abono_nombre || null;
            p.ultimo_abono_mes = row.ultimo_abono_mes || null;
            p.ultima_cuota_social_recibida_mes = row.ultima_cuota_social_recibida_mes || null;
            p.ultima_cuota_social_pagada_mes = row.ultima_cuota_social_pagada_mes || null;
            p.clases_restantes = row.clases_restantes !== null ? parseInt(row.clases_restantes, 10) : null;
            return p;
        });

        return {
            data: practicantes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        };
    }

    static async findByUserId(userId) {
        const sql = 'SELECT * FROM Practicante WHERE user_id = ? AND deleted_at IS NULL';
        const [rows] = await pool.execute(sql, [userId]);
        return rows.length ? new Practicante(rows[0]) : null;
    }

    /**
     * Update practicante and record history
     * @param {number} id - Practicante ID
     * @param {Object} data - Updated data
     * @param {number} userId - ID of the user making the update
     * @returns {Promise<Practicante|null>}
     */
    static async update(id, data, userId = null) {
        const currentData = await this.findById(id);
        if (!currentData) return null;

        const allowedFields = [
            'nombre_completo', 'dni', 'fecha_nacimiento', 'genero', 'telefono', 'email',
            'direccion', 'condiciones_medicas', 'medicamentos', 'limitaciones_fisicas', 'alergias',
            'user_id', 'es_profesor',
            'emergencia_nombre', 'emergencia_telefono', 'obra_social', 'obra_social_nro',
            'emergencia_servicio', 'emergencia_servicio_telefono', 'ocupacion', 'estudios',
            'actividad_fisica_actual', 'actividad_fisica_detalle', 'actividad_fisica_anios_inactivo',
            'actividad_fisica_anterior', 'observaciones_adicionales'
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (data.hasOwnProperty(field)) {
                updates.push(`${field} = ?`);
                values.push(data[field] === undefined ? null : data[field]);
            }
        }

        if (updates.length === 0) {
            return currentData;
        }

        values.push(id);
        const sql = `UPDATE Practicante SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;

        await pool.execute(sql, values);
        
        const updatedPracticante = await this.findById(id);

        if (updatedPracticante) {
            await this.recordHistory(
                id,
                'UPDATE',
                currentData.toJSON(),
                updatedPracticante.toJSON(),
                userId
            );
        }

        return updatedPracticante;
    }

    /**
     * Soft delete practicante and record history
     * @param {number} id - Practicante ID
     * @param {number} userId - ID of the user performing the deletion
     * @returns {Promise<boolean>}
     */
    static async delete(id, userId = null) {
        const currentData = await this.findById(id);
        if (!currentData) return false;

        const sql = 'UPDATE Practicante SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL';
        const [result] = await pool.execute(sql, [id]);

        if (result.affectedRows > 0) {
            await this.recordHistory(id, 'DELETE', currentData.toJSON(), null, userId);
            return true;
        }

        return false;
    }

    /**
     * Record modification history
     * @param {number} practicanteId - Practicante ID
     * @param {string} action - Action performed (CREATE, UPDATE, DELETE)
     * @param {Object|null} oldData - Data before change
     * @param {Object|null} newData - Data after change
     * @param {number|null} userId - ID of the user who performed the action
     * @returns {Promise<void>}
     */
    static async recordHistory(practicanteId, action, oldData, newData, userId) {
        const sql = `
            INSERT INTO HistorialPracticante (
                practicante_id, accion, datos_anteriores, datos_nuevos, usuario_id
            ) VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            practicanteId,
            action,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            userId
        ];

        await pool.execute(sql, values);
    }

    /**
     * Get history of a practicante
     * @param {number} id - Practicante ID
     * @returns {Promise<Array>}
     */
    static async getHistory(id) {
        const sql = `
            SELECT h.*, u.email as usuario_email
            FROM HistorialPracticante h
            LEFT JOIN User u ON h.usuario_id = u.id
            WHERE h.practicante_id = ?
            ORDER BY h.fecha DESC
        `;
        const [rows] = await pool.execute(sql, [id]);
        return rows.map(row => ({
            ...row,
            datos_anteriores: typeof row.datos_anteriores === 'string' ? JSON.parse(row.datos_anteriores) : row.datos_anteriores,
            datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos
        }));
    }

    /**
     * Check if practicante has related records
     * @param {number} id - Practicante ID
     * @returns {Promise<boolean>}
     */
    static async hasRelatedRecords(id) {
        const sql = `
      SELECT 
        (SELECT COUNT(*) FROM Abono WHERE practicante_id = ? AND deleted_at IS NULL) as abonos,
        (SELECT COUNT(*) FROM Pago WHERE practicante_id = ? AND deleted_at IS NULL) as pagos,
        (SELECT COUNT(*) FROM Asistencia WHERE practicante_id = ? AND deleted_at IS NULL) as asistencias
    `;
        const [rows] = await pool.execute(sql, [id, id, id]);
        const counts = rows[0];
        return counts.abonos > 0 || counts.pagos > 0 || counts.asistencias > 0;
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            es_profesor: this.es_profesor,
            nombre_completo: this.nombre_completo,
            dni: this.dni,
            fecha_nacimiento: this.fecha_nacimiento,
            genero: this.genero,
            telefono: this.telefono,
            email: this.email,
            direccion: this.direccion,
            condiciones_medicas: this.condiciones_medicas,
            medicamentos: this.medicamentos,
            limitaciones_fisicas: this.limitaciones_fisicas,
            alergias: this.alergias,
            emergencia_nombre: this.emergencia_nombre,
            emergencia_telefono: this.emergencia_telefono,
            obra_social: this.obra_social,
            obra_social_nro: this.obra_social_nro,
            emergencia_servicio: this.emergencia_servicio,
            emergencia_servicio_telefono: this.emergencia_servicio_telefono,
            ocupacion: this.ocupacion,
            estudios: this.estudios,
            actividad_fisica_actual: this.actividad_fisica_actual,
            actividad_fisica_detalle: this.actividad_fisica_detalle,
            actividad_fisica_anios_inactivo: this.actividad_fisica_anios_inactivo,
            actividad_fisica_anterior: this.actividad_fisica_anterior,
            observaciones_adicionales: this.observaciones_adicionales,
            socio_count: this.socio_count || 0,
            ultimo_abono_nombre: this.ultimo_abono_nombre || null,
            ultimo_abono_mes: this.ultimo_abono_mes || null,
            ultima_cuota_social_recibida_mes: this.ultima_cuota_social_recibida_mes || null,
            ultima_cuota_social_pagada_mes: this.ultima_cuota_social_pagada_mes || null,
            clases_restantes: this.clases_restantes !== undefined ? this.clases_restantes : null,
            created_at: this.created_at,
            updated_at: this.updated_at,
            deleted_at: this.deleted_at
        };
    }
}

export default Practicante;
