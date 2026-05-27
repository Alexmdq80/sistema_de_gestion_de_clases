import pool from '../config/database.js';

export class InscripcionHorario {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.horario_id = data.horario_id;
        this.fecha_inscripcion = data.fecha_inscripcion || null;
        this.activo = data.activo !== undefined ? !!data.activo : true;
        this.created_at = data.created_at || null;
        
        // Joined data
        this.practicante_nombre = data.practicante_nombre || null;
        this.dia_semana = data.dia_semana || null;
        this.hora_inicio = data.hora_inicio || null;
        this.actividad_nombre = data.actividad_nombre || null;
        this.lugar_nombre = data.lugar_nombre || null;
    }

    static async findByPracticante(practicanteId) {
        const sql = `
            SELECT ih.*, h.dia_semana, h.hora_inicio, h.hora_fin, 
                   a.nombre as actividad_nombre, l.nombre as lugar_nombre
            FROM InscripcionHorario ih
            JOIN Horario h ON ih.horario_id = h.id
            JOIN Actividad a ON h.actividad_id = a.id
            JOIN Lugar l ON h.lugar_id = l.id
            WHERE ih.practicante_id = ? AND ih.activo = 1
            ORDER BY h.dia_semana, h.hora_inicio
        `;
        const [rows] = await pool.execute(sql, [practicanteId]);
        return rows.map(row => new InscripcionHorario(row));
    }

    static async create(data) {
        const sql = `
            INSERT INTO InscripcionHorario (practicante_id, horario_id, fecha_inscripcion)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE activo = 1, updated_at = CURRENT_TIMESTAMP
        `;
        const [result] = await pool.execute(sql, [
            data.practicante_id,
            data.horario_id,
            data.fecha_inscripcion || new Date().toISOString().split('T')[0]
        ]);
        return result.affectedRows > 0;
    }

    static async delete(practicanteId, horarioId) {
        const sql = 'DELETE FROM InscripcionHorario WHERE practicante_id = ? AND horario_id = ?';
        const [result] = await pool.execute(sql, [practicanteId, horarioId]);
        return result.affectedRows > 0;
    }

    static async updateByPracticante(practicanteId, horarioIds) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Remove current (or we could just mark as inactive, but for now simple sync)
            await connection.execute('DELETE FROM InscripcionHorario WHERE practicante_id = ?', [practicanteId]);
            
            // 2. Insert new ones
            if (horarioIds && horarioIds.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                for (const hId of horarioIds) {
                    await connection.execute(
                        'INSERT INTO InscripcionHorario (practicante_id, horario_id, fecha_inscripcion) VALUES (?, ?, ?)',
                        [practicanteId, hId, today]
                    );
                }
            }
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default InscripcionHorario;
