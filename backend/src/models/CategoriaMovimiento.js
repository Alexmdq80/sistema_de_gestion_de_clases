import pool from '../config/database.js';

export class CategoriaMovimiento {
    static async findAll() {
        const [rows] = await pool.execute('SELECT * FROM CategoriaMovimiento WHERE deleted_at IS NULL ORDER BY nombre ASC');
        return rows;
    }

    static async create(data) {
        const [result] = await pool.execute(
            'INSERT INTO CategoriaMovimiento (nombre, tipo_sugerido) VALUES (?, ?)',
            [data.nombre, data.tipo_sugerido || 'ambos']
        );
        return { id: result.insertId, ...data };
    }

    static async delete(id) {
        const [result] = await pool.execute(
            'UPDATE CategoriaMovimiento SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
}

export default CategoriaMovimiento;
