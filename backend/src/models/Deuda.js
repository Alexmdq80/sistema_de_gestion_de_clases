import pool from '../config/database.js';

/**
 * Deuda Model
 */
export class Deuda {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.monto = data.monto || 0.00;
        this.concepto = data.concepto;
        this.fecha = data.fecha;
        this.estado = data.estado || 'pendiente';
        this.clase_id = data.clase_id || null;
        this.abono_id = data.abono_id || null;
        this.usuario_id = data.usuario_id || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.deleted_at = data.deleted_at || null;
    }

    static async create(data, connection = null, userId = null) {
        const sql = `
            INSERT INTO Deuda (practicante_id, monto, concepto, fecha, estado, clase_id, abono_id, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const executor = connection || pool;
        const effectiveUserId = userId || data.usuario_id || null;

        const [result] = await executor.execute(sql, [
            data.practicante_id,
            data.monto,
            data.concepto,
            data.fecha,
            data.estado || 'pendiente',
            data.clase_id || null,
            data.abono_id || null,
            effectiveUserId
        ]);
        
        const newDeuda = await this.findById(result.insertId, executor);
        if (newDeuda) {
            await this.recordHistory(newDeuda.id, 'CREATE', null, newDeuda.toJSON(), effectiveUserId, executor);
        }
        return newDeuda;
    }

    static async findById(id, connection = null) {
        const sql = 'SELECT * FROM Deuda WHERE id = ? AND deleted_at IS NULL';
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [id]);
        return rows.length ? new Deuda(rows[0]) : null;
    }

    static async findAll(filters = {}) {
        let sql = 'SELECT * FROM Deuda WHERE deleted_at IS NULL';
        const params = [];
        if (filters.practicante_id) {
            sql += ' AND practicante_id = ?';
            params.push(filters.practicante_id);
        }
        if (filters.estado) {
            sql += ' AND estado = ?';
            params.push(filters.estado);
        }
        sql += ' ORDER BY fecha DESC';
        const [rows] = await pool.execute(sql, params);
        return rows.map(r => new Deuda(r));
    }

    static async recordHistory(deudaId, action, oldData, newData, userId, connection = null) {
        const sql = `
            INSERT INTO HistorialDeuda (deuda_id, accion, datos_anteriores, datos_nuevos, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `;
        const executor = connection || pool;
        await executor.execute(sql, [
            deudaId,
            action,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            userId
        ]);
    }

    static async cancelByClaseId(claseId, userId, connection = null) {
        const executor = connection || pool;
        
        // 1. Get all pending debts for this class to record history
        const sqlFind = 'SELECT * FROM Deuda WHERE clase_id = ? AND estado = "pendiente" AND deleted_at IS NULL';
        const [rows] = await executor.execute(sqlFind, [claseId]);
        
        if (rows.length === 0) return 0;

        // 2. Update status to "cancelada"
        const sqlUpdate = 'UPDATE Deuda SET estado = "cancelada" WHERE clase_id = ? AND estado = "pendiente" AND deleted_at IS NULL';
        const [result] = await executor.execute(sqlUpdate, [claseId]);

        // 3. Record history for each cancelled debt
        for (const row of rows) {
            const oldData = new Deuda(row).toJSON();
            const newData = { ...oldData, estado: 'cancelada' };
            await this.recordHistory(row.id, 'CANCEL', oldData, newData, userId, executor);
        }

        return result.affectedRows;
    }

    toJSON() {
        return {
            id: this.id,
            practicante_id: this.practicante_id,
            monto: this.monto,
            concepto: this.concepto,
            fecha: this.fecha,
            estado: this.estado,
            clase_id: this.clase_id,
            abono_id: this.abono_id,
            usuario_id: this.usuario_id,
            created_at: this.created_at
        };
    }
}

export default Deuda;
