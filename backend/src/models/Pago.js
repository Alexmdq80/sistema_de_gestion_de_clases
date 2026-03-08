import pool from '../config/database.js';

/**
 * Pago Model
 */
export class Pago {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.abono_id = data.abono_id;
        this.pago_socio_id = data.pago_socio_id || null;
        this.mes_abono = data.mes_abono || null;
        this.lugar_id = data.lugar_id || null;
        this.fecha = data.fecha || new Date().toISOString().split('T')[0];
        this.monto = data.monto;
        this.metodo_pago = data.metodo_pago || null;
        this.notas = data.notas || null;
        this.tipo_abono_nombre = data.tipo_abono_nombre || null; 
        this.practicante_nombre = data.practicante_nombre || null; 
        this.categoria = data.categoria || null; 
        this.lugar_nombre = data.lugar_nombre || null; 
        this.fecha_vencimiento = data.fecha_vencimiento || null; 
        this.horarios_ids = data.horarios_ids || []; 
        this.pago_tipo = data.pago_tipo || 'ingreso'; 
        this.deleted_at = data.deleted_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Create a new payment and record history
     * @param {Object} data - Pago data
     * @param {Object} [connection] - Database connection for transactions
     * @param {number} [userId] - User ID
     * @returns {Promise<Pago>}
     */
    static async create(data, connection = null, userId = null) {
        const sql = `
            INSERT INTO Pago (
                practicante_id, abono_id, pago_socio_id, mes_abono, lugar_id, fecha, monto, metodo_pago, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            data.practicante_id,
            data.abono_id,
            data.pago_socio_id || null,
            data.mes_abono || null,
            data.lugar_id || null,
            data.fecha,
            data.monto,
            data.metodo_pago || null,
            data.notas || null
        ];

        const executor = connection || pool;
        const [result] = await executor.execute(sql, values);
        const newPago = await this.findById(result.insertId, connection);

        if (newPago) {
            await this.recordHistory(newPago.id, 'CREATE', null, newPago.toJSON(), userId, executor);
        }

        return newPago;
    }

    /**
     * Find all payments (incomes and expenses)
     * @param {Object} [filters] - Optional filters
     * @returns {Promise<Pago[]>}
     */
    static async findAll(filters = {}) {
        let sql = `
            SELECT * FROM (
                -- Incomes (Student payments and Social Fees)
                SELECT 
                    p.id, p.practicante_id, p.abono_id, p.pago_socio_id, p.mes_abono, p.lugar_id, 
                    p.fecha, p.monto, p.metodo_pago, p.notas, p.deleted_at, p.created_at, p.updated_at,
                    COALESCE(ta.nombre, 'Recepción Cuota Social') as tipo_abono_nombre, 
                    ta.categoria, 
                    pr.nombre_completo as practicante_nombre,
                    a.fecha_vencimiento, 
                    l.nombre as lugar_nombre,
                    (SELECT JSON_ARRAYAGG(horario_id) FROM TipoAbono_Horario WHERE tipo_abono_id = ta.id) as schedules,
                    'ingreso' as pago_tipo,
                    ta.id as tipo_abono_id,
                    pr.es_profesor
                FROM Pago p
                LEFT JOIN Abono a ON p.abono_id = a.id
                LEFT JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
                JOIN Practicante pr ON p.practicante_id = pr.id
                LEFT JOIN Lugar l ON p.lugar_id = l.id
                WHERE p.deleted_at IS NULL

                UNION ALL

                -- Expenses (Costo de Espacio - from Clase)
                SELECT 
                    c.id * -1 as id, c.profesor_id as practicante_id, NULL as abono_id, NULL as pago_socio_id, 
                    NULL as mes_abono, c.lugar_id, 
                    c.fecha_pago_espacio as fecha, 
                    (CASE 
                        WHEN l.tipo_tarifa = 'por_clase' THEN l.costo_tarifa 
                        ELSE l.costo_tarifa * (TIME_TO_SEC(TIMEDIFF(c.hora_fin, c.hora)) / 3600)
                    END) * -1 as monto, 
                    'transferencia' as metodo_pago, 
                    CONCAT('Costo de Espacio: ', c.estado) as notas, 
                    c.deleted_at, c.created_at, c.updated_at,
                    'Costo de Espacio' as tipo_abono_nombre, 
                    NULL as categoria, 
                    p.nombre_completo as practicante_nombre,
                    NULL as fecha_vencimiento, 
                    l.nombre as lugar_nombre,
                    '[]' as schedules,
                    'egreso' as pago_tipo,
                    NULL as tipo_abono_id,
                    1 as es_profesor
                FROM Clase c
                JOIN Lugar l ON c.lugar_id = l.id
                JOIN Practicante p ON c.profesor_id = p.id
                WHERE c.deleted_at IS NULL AND c.pago_espacio_realizado = 1

                UNION ALL

                -- Expenses (Pago Cuota Social al Club - from PagoSocio)
                SELECT 
                    ps.id * -1000 as id, pr.id as practicante_id, NULL as abono_id, ps.id as pago_socio_id, 
                    ps.mes_abono, l.id as lugar_id, 
                    ps.fecha_pago as fecha, 
                    ps.monto * -1 as monto, 
                    'efectivo' as metodo_pago, 
                    CONCAT('Pago Cuota Social al Club: ', ps.observaciones) as notas, 
                    ps.deleted_at, ps.created_at, ps.updated_at,
                    'Egreso Cuota Social (Club)' as tipo_abono_nombre, 
                    NULL as categoria, 
                    pr.nombre_completo as practicante_nombre,
                    ps.fecha_vencimiento, 
                    l.nombre as lugar_nombre,
                    '[]' as schedules,
                    'egreso' as pago_tipo,
                    NULL as tipo_abono_id,
                    pr.es_profesor
                FROM PagoSocio ps
                JOIN Socio s ON ps.socio_id = s.id
                JOIN Practicante pr ON s.practicante_id = pr.id
                JOIN Lugar l ON s.lugar_id = l.id
                WHERE ps.deleted_at IS NULL AND ps.fecha_pago IS NOT NULL
            ) as global_pagos
            WHERE 1=1
        `;
        const params = [];

        if (filters.search) {
            sql += ' AND (practicante_nombre LIKE ? OR tipo_abono_nombre LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.categoria) {
            sql += ' AND categoria = ?';
            params.push(filters.categoria);
        }

        if (filters.mes) {
            if (filters.filter_by_mes_abono && filters.anio) {
                const monthNames = [
                    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                ];
                const mesNombre = monthNames[filters.mes - 1];
                const mesAbonoStr = `${mesNombre} ${filters.anio}`;
                
                // For incomes use mes_abono, for expenses use the actual payment date (MONTH(fecha))
                sql += ' AND ((pago_tipo = \'ingreso\' AND mes_abono = ?) OR (pago_tipo = \'egreso\' AND MONTH(fecha) = ?))';
                params.push(mesAbonoStr, filters.mes);
            } else {
                sql += ' AND MONTH(fecha) = ?';
                params.push(filters.mes);
            }
        }

        if (filters.anio) {
            // If filter_by_mes_abono is active, the year is already included in mes_abono for incomes,
            // but we still need YEAR(fecha) for egresos.
            if (filters.filter_by_mes_abono && filters.mes) {
                sql += ' AND ((pago_tipo = \'ingreso\') OR (pago_tipo = \'egreso\' AND YEAR(fecha) = ?))';
                params.push(filters.anio);
            } else {
                sql += ' AND YEAR(fecha) = ?';
                params.push(filters.anio);
            }
        }

        if (filters.tipo_abono_id) {
            sql += ' AND tipo_abono_id = ?';
            params.push(filters.tipo_abono_id);
        }

        if (filters.lugar_id) {
            sql += ' AND lugar_id = ?';
            params.push(filters.lugar_id);
        }

        if (filters.fecha_inicio) {
            sql += ' AND fecha >= ?';
            params.push(filters.fecha_inicio);
        }

        if (filters.fecha_fin) {
            sql += ' AND fecha <= ?';
            params.push(filters.fecha_fin);
        }

        if (filters.exclude_cuota_social) {
            // Exclude incomes (social fees) and specific expenses (social fee to club) for STUDENTS (non-professors)
            sql += " AND NOT (es_profesor = 0 AND ( (pago_tipo = 'ingreso' AND categoria IS NULL) OR (tipo_abono_nombre = 'Egreso Cuota Social (Club)') ))";
        }
if (filters.exclude_profesor_pago) {
    // Exclude incomes (social fees) and specific expenses (social fee to club) for PROFESSORS
    sql += " AND NOT (es_profesor = 1 AND ( (pago_tipo = 'ingreso' AND categoria IS NULL) OR (tipo_abono_nombre = 'Egreso Cuota Social (Club)') ))";
}

if (filters.exclude_espacio_costo) {
    sql += " AND tipo_abono_nombre != 'Costo de Espacio'";
}

sql += ' ORDER BY fecha DESC, created_at DESC';

        const [rows] = await pool.execute(sql, params);
        return rows.map(row => {
            const rowData = { ...row };
            rowData.horarios_ids = typeof row.schedules === 'string' ? JSON.parse(row.schedules) : (row.schedules || []);
            return new Pago(rowData);
        });
    }

    /**
     * Find payment by ID
     * @param {number} id - Pago ID
     * @param {Object} [connection] - Database connection
     * @returns {Promise<Pago|null>}
     */
    static async findById(id, connection = null) {
        const sql = `
            SELECT p.*, COALESCE(ta.nombre, 'Recepción Cuota Social') as tipo_abono_nombre, ta.categoria, pr.nombre_completo as practicante_nombre,
                   a.fecha_vencimiento, l.nombre as lugar_nombre,
                   (SELECT JSON_ARRAYAGG(horario_id) FROM TipoAbono_Horario WHERE tipo_abono_id = ta.id) as schedules
            FROM Pago p
            LEFT JOIN Abono a ON p.abono_id = a.id
            LEFT JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
            JOIN Practicante pr ON p.practicante_id = pr.id
            LEFT JOIN Lugar l ON p.lugar_id = l.id
            WHERE p.id = ? AND p.deleted_at IS NULL
        `;
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [id]);

        if (rows.length === 0) {
            return null;
        }

        const row = rows[0];
        row.horarios_ids = typeof row.schedules === 'string' ? JSON.parse(row.schedules) : (row.schedules || []);
        return new Pago(row);
    }

    /**
     * Find all payments for a practicante
     * @param {number} practicanteId - Practicante ID
     * @returns {Promise<Pago[]>}
     */
    static async findByPracticanteId(practicanteId) {
        const sql = `
            SELECT p.*, COALESCE(ta.nombre, 'Recepción Cuota Social') as tipo_abono_nombre, ta.categoria, a.fecha_vencimiento, l.nombre as lugar_nombre,
                   (SELECT JSON_ARRAYAGG(horario_id) FROM TipoAbono_Horario WHERE tipo_abono_id = ta.id) as schedules
            FROM Pago p
            LEFT JOIN Abono a ON p.abono_id = a.id
            LEFT JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
            LEFT JOIN Lugar l ON p.lugar_id = l.id
            WHERE p.practicante_id = ? AND p.deleted_at IS NULL
            ORDER BY p.fecha DESC
        `;
        const [rows] = await pool.execute(sql, [practicanteId]);
        return rows.map(row => {
            const rowData = { ...row };
            rowData.horarios_ids = typeof row.schedules === 'string' ? JSON.parse(row.schedules) : (row.schedules || []);
            return new Pago(rowData);
        });
    }

    /**
     * Update payment and record history
     * @param {number} id - Pago ID
     * @param {Object} data - Updated data
     * @param {Object} [connection] - Database connection
     * @param {number} [userId] - User ID
     * @returns {Promise<Pago|null>}
     */
    static async update(id, data, connection = null, userId = null) {
        const executor = connection || pool;
        const currentData = await this.findById(id, executor);
        if (!currentData) return null;

        const allowedFields = ['fecha', 'monto', 'metodo_pago', 'notas'];
        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (data.hasOwnProperty(field)) {
                updates.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (updates.length === 0) return currentData;

        values.push(id);
        const sql = `UPDATE Pago SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
        await executor.execute(sql, values);

        const updatedPago = await this.findById(id, executor);
        if (updatedPago) {
            await this.recordHistory(id, 'UPDATE', currentData.toJSON(), updatedPago.toJSON(), userId, executor);
        }

        return updatedPago;
    }

    /**
     * Delete payment (Soft Delete) and record history
     * @param {number} id - Pago ID
     * @param {Object} [connection] - Database connection
     * @param {number} [userId] - User ID
     * @returns {Promise<boolean>}
     */
    static async delete(id, connection = null, userId = null) {
        const executor = connection || pool;
        const currentData = await this.findById(id, executor);
        if (!currentData) return false;

        const sql = 'UPDATE Pago SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
        const [result] = await executor.execute(sql, [id]);
        
        if (result.affectedRows > 0) {
            await this.recordHistory(id, 'DELETE', currentData.toJSON(), null, userId, executor);
            return true;
        }
        return false;
    }

    /**
     * Record modification history
     * @param {number} pagoId - Pago ID
     * @param {string} action - Action performed (CREATE, UPDATE, DELETE)
     * @param {Object|null} oldData - Data before change
     * @param {Object|null} newData - Data after change
     * @param {number|null} userId - ID of the user who performed the action
     * @param {Object} [connection] - Database connection
     * @returns {Promise<void>}
     */
    static async recordHistory(pagoId, action, oldData, newData, userId, connection = null) {
        const sql = `
            INSERT INTO HistorialPago (
                pago_id, accion, datos_anteriores, datos_nuevos, usuario_id
            ) VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            pagoId,
            action,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            userId
        ];

        const executor = connection || pool;
        await executor.execute(sql, values);
    }

    /**
     * Get history of a payment
     * @param {number} id - Pago ID
     * @returns {Promise<Array>}
     */
    static async getHistory(id) {
        const sql = `
            SELECT h.*, u.email as usuario_email
            FROM HistorialPago h
            LEFT JOIN User u ON h.usuario_id = u.id
            WHERE h.pago_id = ?
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
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            practicante_id: this.practicante_id,
            abono_id: this.abono_id,
            mes_abono: this.mes_abono,
            lugar_id: this.lugar_id,
            fecha: this.fecha,
            monto: this.monto,
            metodo_pago: this.metodo_pago,
            notas: this.notas,
            tipo_abono_nombre: this.tipo_abono_nombre,
            practicante_nombre: this.practicante_nombre,
            categoria: this.categoria,
            lugar_nombre: this.lugar_nombre,
            fecha_vencimiento: this.fecha_vencimiento,
            horarios_ids: this.horarios_ids,
            pago_tipo: this.pago_tipo,
            deleted_at: this.deleted_at,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

export default Pago;
