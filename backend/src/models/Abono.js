import pool from '../config/database.js';

/**
 * Abono Model
 */
export class Abono {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.tipo_abono_id = data.tipo_abono_id;
        this.fecha_inicio = data.fecha_inicio;
        this.fecha_vencimiento = data.fecha_vencimiento;
        this.mes_abono = data.mes_abono || null;
        this.lugar_id = data.lugar_id || null;
        this.lugar_nombre = data.lugar_nombre || null; // From join
        this.estado = data.estado || 'activo';
        this.cantidad = data.cantidad || 1;
        this.monto_pactado = data.monto_pactado !== undefined ? parseFloat(data.monto_pactado) : null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.deleted_at = data.deleted_at || null;
    }

    /**
     * Create a new abono and record history
     * @param {Object} data - Abono data
     * @param {Object} [connection] - Database connection for transactions
     * @param {number} [userId] - ID of the user creating it
     * @returns {Promise<Abono>}
     */
    static async create(data, connection = null, userId = null) {
        const sql = `
            INSERT INTO Abono (
                practicante_id, tipo_abono_id, fecha_inicio, fecha_vencimiento, mes_abono, lugar_id, estado, cantidad, monto_pactado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            data.practicante_id,
            data.tipo_abono_id,
            data.fecha_inicio,
            data.fecha_vencimiento,
            data.mes_abono || null,
            data.lugar_id || null,
            data.estado || 'activo',
            data.cantidad !== undefined && data.cantidad !== null ? parseInt(data.cantidad, 10) : 1,
            data.monto_pactado !== undefined ? data.monto_pactado : null
        ];

        const executor = connection || pool;
        const [result] = await executor.execute(sql, values);
        const newAbono = await this.findById(result.insertId, executor);

        if (newAbono) {
            await this.recordHistory(newAbono.id, 'CREATE', null, newAbono.toJSON(), userId, executor);
        }

        return newAbono;
    }

    /**
     * Find abono by ID (only non-deleted)
     * @param {number} id - Abono ID
     * @param {Object} [connection] - Database connection
     * @returns {Promise<Abono|null>}
     */
    static async findById(id, connection = null) {
        const sql = `
            SELECT a.*, l.nombre as lugar_nombre
            FROM Abono a
            LEFT JOIN Lugar l ON a.lugar_id = l.id
            WHERE a.id = ? AND a.deleted_at IS NULL
        `;
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [id]);

        if (rows.length === 0) {
            return null;
        }

        return new Abono(rows[0]);
    }

    /**
     * Find active abono for a practicante
     * @param {number} practicanteId - Practicante ID
     * @param {Object} [connection] - Database connection
     * @returns {Promise<Abono|null>}
     */
    static async findActiveByPracticanteId(practicanteId, connection = null) {
        const sql = `
            SELECT a.*, l.nombre as lugar_nombre
            FROM Abono a
            LEFT JOIN Lugar l ON a.lugar_id = l.id
            WHERE a.practicante_id = ? AND a.estado = 'activo' 
            AND a.fecha_vencimiento >= CURDATE()
            AND a.deleted_at IS NULL
            ORDER BY a.fecha_vencimiento DESC LIMIT 1
        `;
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [practicanteId]);

        if (rows.length === 0) {
            return null;
        }

        return new Abono(rows[0]);
    }

    /**
     * Update abono status and record history
     * @param {number} id - Abono ID
     * @param {string} estado - New status
     * @param {Object} [connection] - Database connection
     * @param {number} [userId] - ID of the user updating it
     * @returns {Promise<boolean>}
     */
    static async updateStatus(id, estado, connection = null, userId = null) {
        const executor = connection || pool;
        const currentData = await this.findById(id, executor);
        if (!currentData) return false;

        const sql = 'UPDATE Abono SET estado = ? WHERE id = ? AND deleted_at IS NULL';
        const [result] = await executor.execute(sql, [estado, id]);

        if (result.affectedRows > 0) {
            const updatedAbono = await this.findById(id, executor);
            await this.recordHistory(id, 'UPDATE', currentData.toJSON(), updatedAbono.toJSON(), userId, executor);
            return true;
        }
        return false;
    }

    /**
     * Get balance for an abono (monto_pactado - sum of related payments)
     * @param {number} id - Abono ID
     * @param {Object} [connection] - Database connection
     * @returns {Promise<Object>}
     */
    static async getBalance(id, connection = null) {
        const sql = `
            SELECT 
                a.monto_pactado,
                IFNULL(SUM(p.monto), 0) as total_pagado,
                (IFNULL(a.monto_pactado, 0) - IFNULL(SUM(p.monto), 0)) as saldo_pendiente
            FROM Abono a
            LEFT JOIN Pago p ON a.id = p.abono_id AND p.deleted_at IS NULL
            WHERE a.id = ?
            GROUP BY a.id
        `;
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [id]);
        return rows.length ? rows[0] : { monto_pactado: 0, total_pagado: 0, saldo_pendiente: 0 };
    }

    /**
     * Soft delete abono and record history
     * @param {number} id - Abono ID
     * @param {Object} [connection] - Database connection
     * @param {number} [userId] - User ID
     * @returns {Promise<boolean>}
     */
    static async delete(id, connection = null, userId = null) {
        const executor = connection || pool;
        const currentData = await this.findById(id, executor);
        if (!currentData) return false;

        const sql = 'UPDATE Abono SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL';
        const [result] = await executor.execute(sql, [id]);

        if (result.affectedRows > 0) {
            await this.recordHistory(id, 'DELETE', currentData.toJSON(), null, userId, executor);
            return true;
        }
        return false;
    }

    /**
     * Record modification history
     * @param {number} abonoId - Abono ID
     * @param {string} action - Action performed (CREATE, UPDATE, DELETE)
     * @param {Object|null} oldData - Data before change
     * @param {Object|null} newData - Data after change
     * @param {number|null} userId - ID of the user who performed the action
     * @param {Object} [connection] - Database connection
     * @returns {Promise<void>}
     */
    static async recordHistory(abonoId, action, oldData, newData, userId, connection = null) {
        const sql = `
            INSERT INTO HistorialAbono (
                abono_id, accion, datos_anteriores, datos_nuevos, usuario_id
            ) VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            abonoId,
            action,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            userId
        ];

        const executor = connection || pool;
        await executor.execute(sql, values);
    }

    /**
     * Get history of an abono
     * @param {number} id - Abono ID
     * @returns {Promise<Array>}
     */
    static async getHistory(id) {
        const sql = `
            SELECT h.*, u.email as usuario_email
            FROM HistorialAbono h
            LEFT JOIN User u ON h.usuario_id = u.id
            WHERE h.abono_id = ?
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
            tipo_abono_id: this.tipo_abono_id,
            fecha_inicio: this.fecha_inicio,
            fecha_vencimiento: this.fecha_vencimiento,
            mes_abono: this.mes_abono,
            lugar_id: this.lugar_id,
            lugar_nombre: this.lugar_nombre,
            estado: this.estado,
            cantidad: this.cantidad,
            monto_pactado: this.monto_pactado,
            created_at: this.created_at,
            updated_at: this.updated_at,
            deleted_at: this.deleted_at
        };
    }
}

export default Abono;
