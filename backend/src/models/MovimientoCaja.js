import pool from '../config/database.js';

/**
 * MovimientoCaja Model
 */
export class MovimientoCaja {
    constructor(data) {
        this.id = data.id || null;
        this.tipo = data.tipo; // 'ingreso' | 'egreso'
        this.monto = data.monto;
        this.categoria = data.categoria;
        this.descripcion = data.descripcion || null;
        this.fecha = data.fecha;
        this.practicante_id = data.practicante_id || null;
        this.usuario_id = data.usuario_id;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.deleted_at = data.deleted_at || null;

        // Joined data
        this.practicante_nombre = data.practicante_nombre || null;
        this.usuario_nombre = data.usuario_nombre || null;
    }

    /**
     * Find all movements with filters
     * @param {Object} filters 
     * @returns {Promise<MovimientoCaja[]>}
     */
    static async findAll(filters = {}) {
        let sql = `
            SELECT m.*, p.nombre_completo as practicante_nombre, u.email as usuario_nombre
            FROM MovimientoCaja m
            LEFT JOIN Practicante p ON m.practicante_id = p.id
            JOIN User u ON m.usuario_id = u.id
            WHERE m.deleted_at IS NULL
        `;
        const params = [];

        if (filters.fecha_inicio) {
            sql += ' AND m.fecha >= ?';
            params.push(filters.fecha_inicio);
        }
        if (filters.fecha_fin) {
            sql += ' AND m.fecha <= ?';
            params.push(filters.fecha_fin);
        }
        if (filters.tipo) {
            sql += ' AND m.tipo = ?';
            params.push(filters.tipo);
        }
        if (filters.categoria) {
            sql += ' AND m.categoria = ?';
            params.push(filters.categoria);
        }

        sql += ' ORDER BY m.fecha DESC, m.created_at DESC';

        const [rows] = await pool.execute(sql, params);
        return rows.map(row => new MovimientoCaja(row));
    }

    static async findById(id) {
        const sql = `
            SELECT m.*, p.nombre_completo as practicante_nombre, u.email as usuario_nombre
            FROM MovimientoCaja m
            LEFT JOIN Practicante p ON m.practicante_id = p.id
            JOIN User u ON m.usuario_id = u.id
            WHERE m.id = ? AND m.deleted_at IS NULL
        `;
        const [rows] = await pool.execute(sql, [id]);
        return rows.length ? new MovimientoCaja(rows[0]) : null;
    }

    static async create(data) {
        const sql = `
            INSERT INTO MovimientoCaja (tipo, monto, categoria, descripcion, fecha, practicante_id, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.tipo,
            data.monto,
            data.categoria,
            data.descripcion || null,
            data.fecha,
            data.practicante_id || null,
            data.usuario_id
        ];

        const [result] = await pool.execute(sql, values);
        return await this.findById(result.insertId);
    }

    static async update(id, data) {
        const allowedFields = ['tipo', 'monto', 'categoria', 'descripcion', 'fecha', 'practicante_id'];
        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (data.hasOwnProperty(field)) {
                updates.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (updates.length === 0) return await this.findById(id);

        values.push(id);
        const sql = `UPDATE MovimientoCaja SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;

        await pool.execute(sql, values);
        return await this.findById(id);
    }

    static async delete(id) {
        const sql = 'UPDATE MovimientoCaja SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
        const [result] = await pool.execute(sql, [id]);
        return result.affectedRows > 0;
    }

    toJSON() {
        return {
            id: this.id,
            tipo: this.tipo,
            monto: parseFloat(this.monto),
            categoria: this.categoria,
            descripcion: this.descripcion,
            fecha: this.fecha instanceof Date ? this.fecha.toISOString().split('T')[0] : this.fecha,
            practicante_id: this.practicante_id,
            practicante_nombre: this.practicante_nombre,
            usuario_id: this.usuario_id,
            usuario_nombre: this.usuario_nombre,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

export default MovimientoCaja;
