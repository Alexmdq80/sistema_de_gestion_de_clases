import pool from '../config/database.js';

export class InscripcionHorario {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.horario_id = data.horario_id;
        this.fecha_desde = data.fecha_desde || null;
        this.fecha_hasta = data.fecha_hasta || null;
        this.activo = data.activo !== undefined ? !!data.activo : true;
        this.deleted_at = data.deleted_at || null;
        this.created_at = data.created_at || null;
        
        // Joined data
        this.practicante_nombre = data.practicante_nombre || null;
        this.dia_semana = data.dia_semana || null;
        this.hora_inicio = data.hora_inicio || null;
        this.hora_fin = data.hora_fin || null;
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
            WHERE ih.practicante_id = ? AND ih.activo = 1 AND ih.fecha_hasta IS NULL AND ih.deleted_at IS NULL
            ORDER BY h.dia_semana, h.hora_inicio
        `;
        const [rows] = await pool.execute(sql, [practicanteId]);
        return rows.map(row => new InscripcionHorario(row));
    }

    static async create(data, userId = null) {
        const today = new Date().toISOString().split('T')[0];
        const sql = `
            INSERT INTO InscripcionHorario (practicante_id, horario_id, fecha_desde, activo)
            VALUES (?, ?, ?, 1)
        `;
        const [result] = await pool.execute(sql, [
            data.practicante_id,
            data.horario_id,
            data.fecha_desde || today
        ]);
        
        if (result.insertId && userId) {
            await this.recordHistory(null, result.insertId, 'CREATE', null, { 
                practicante_id: data.practicante_id, 
                horario_id: data.horario_id, 
                fecha_desde: data.fecha_desde || today 
            }, userId);
        }
        
        return result.insertId;
    }

    static async delete(practicanteId, horarioId, userId = null) {
        const today = new Date().toISOString().split('T')[0];
        
        // Find the active one
        const [rows] = await pool.execute(
            'SELECT * FROM InscripcionHorario WHERE practicante_id = ? AND horario_id = ? AND activo = 1 AND fecha_hasta IS NULL AND deleted_at IS NULL',
            [practicanteId, horarioId]
        );
        
        if (rows.length === 0) return false;
        
        const row = rows[0];
        
        // Soft delete (logical delete because it was an error or immediate removal)
        const sql = 'UPDATE InscripcionHorario SET activo = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
        await pool.execute(sql, [row.id]);
        
        if (userId) {
            await this.recordHistory(null, row.id, 'DELETE', row, { ...row, activo: 0, deleted_at: new Date() }, userId);
        }
        
        return true;
    }

    static async updateByPracticante(practicanteId, horarioIds, userId = null) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // 1. Get current active inscriptions
            const [currentRows] = await connection.execute(
                'SELECT * FROM InscripcionHorario WHERE practicante_id = ? AND activo = 1 AND fecha_hasta IS NULL AND deleted_at IS NULL',
                [practicanteId]
            );
            
            const currentHorarioIds = currentRows.map(r => r.horario_id);
            const newHorarioIds = horarioIds || [];

            // 2. Identify removed schedules -> End validity
            const toEnd = currentRows.filter(r => !newHorarioIds.includes(r.horario_id));
            for (const row of toEnd) {
                await connection.execute(
                    'UPDATE InscripcionHorario SET activo = 0, fecha_hasta = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [today, row.id]
                );
                if (userId) {
                    await this.recordHistory(connection, row.id, 'END_VALIDITY', row, { ...row, activo: 0, fecha_hasta: today }, userId);
                }
            }

            // 3. Identify new schedules -> Create new entry
            const toAdd = newHorarioIds.filter(id => !currentHorarioIds.includes(id));
            for (const hId of toAdd) {
                const [result] = await connection.execute(
                    'INSERT INTO InscripcionHorario (practicante_id, horario_id, fecha_desde, activo) VALUES (?, ?, ?, 1)',
                    [practicanteId, hId, today]
                );
                if (userId) {
                    await this.recordHistory(connection, result.insertId, 'CREATE', null, { practicante_id: practicanteId, horario_id: hId, fecha_desde: today, activo: 1 }, userId);
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

    static async recordHistory(connection, inscripcionId, accion, datosAnteriores, datosNuevos, usuarioId) {
        const sql = `
            INSERT INTO HistorialInscripcionHorario (inscripcion_id, accion, datos_anteriores, datos_nuevos, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `;
        // Use connection if provided for transactions
        const executor = connection || pool;
        await executor.execute(sql, [
            inscripcionId,
            accion,
            datosAnteriores ? JSON.stringify(datosAnteriores) : null,
            datosNuevos ? JSON.stringify(datosNuevos) : null,
            usuarioId
        ]);
    }
}

export default InscripcionHorario;
