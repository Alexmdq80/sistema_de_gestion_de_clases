import pool from '../config/database.js';

export class Presupuesto {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id || null;
        this.cliente_nombre = data.cliente_nombre;
        this.fecha = data.fecha;
        this.total = data.total || 0;
        this.observaciones = data.observaciones || null;
        this.usuario_id = data.usuario_id || null;
        this.created_at = data.created_at || null;
        this.items = data.items || [];
    }

    static async create(data) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO Presupuesto (practicante_id, cliente_nombre, fecha, total, observaciones, usuario_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [data.practicante_id || null, data.cliente_nombre, data.fecha, data.total, data.observaciones || null, data.usuario_id || null]
            );

            const presupuestoId = result.insertId;

            if (data.items && data.items.length > 0) {
                for (const item of data.items) {
                    await connection.execute(
                        `INSERT INTO PresupuestoItem (presupuesto_id, descripcion, cantidad, precio_unitario, subtotal, abono_id) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [presupuestoId, item.descripcion, item.cantidad, item.precio, item.cantidad * item.precio, item.abonoId || null]
                    );
                }
            }

            await connection.commit();
            return presupuestoId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findAll(filters = {}) {
        let sql = `
            SELECT p.*, pr.nombre_completo as practicante_nombre 
            FROM Presupuesto p
            LEFT JOIN Practicante pr ON p.practicante_id = pr.id
            WHERE p.deleted_at IS NULL
        `;
        const params = [];

        if (filters.search) {
            sql += ` AND (p.cliente_nombre LIKE ? OR pr.nombre_completo LIKE ?)`;
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        sql += ` ORDER BY p.fecha DESC, p.created_at DESC`;

        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    static async findById(id) {
        const [presupuestoRows] = await pool.execute(
            `SELECT p.*, pr.nombre_completo as practicante_nombre 
             FROM Presupuesto p
             LEFT JOIN Practicante pr ON p.practicante_id = pr.id
             WHERE p.id = ? AND p.deleted_at IS NULL`,
            [id]
        );

        if (presupuestoRows.length === 0) return null;

        const [itemRows] = await pool.execute(
            `SELECT * FROM PresupuestoItem WHERE presupuesto_id = ?`,
            [id]
        );

        const presupuesto = presupuestoRows[0];
        presupuesto.items = itemRows;
        return presupuesto;
    }

    static async delete(id) {
        const [result] = await pool.execute(
            `UPDATE Presupuesto SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }
}

export default Presupuesto;
