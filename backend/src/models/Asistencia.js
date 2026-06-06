import pool from '../config/database.js';

export class Asistencia {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.clase_id = data.clase_id;
        this.asistio = data.asistio !== undefined ? data.asistio : true;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;

        // Joined data
        this.practicante_nombre = data.practicante_nombre || null;
    }

    /**
     * Obtiene la lista de asistencia para una clase específica.
     */
    static async findByClase(claseId) {
        const sql = `
            SELECT a.*, p.nombre_completo as practicante_nombre
            FROM Asistencia a
            JOIN Practicante p ON a.practicante_id = p.id
            WHERE a.clase_id = ?
        `;
        const [rows] = await pool.execute(sql, [claseId]);
        return rows.map(row => new Asistencia(row));
    }

    /**
     * Obtiene el historial de asistencias de un practicante específico.
     * Útil para presupuestos y balances.
     */
    static async findByPracticante(practicanteId, filters = {}) {
        let sql = `
            SELECT 
                c.id as clase_id,
                a.id as asistencia_id,
                IF(a.id IS NOT NULL OR ih.id IS NOT NULL, 1, 0) as ya_anotado,
                c.fecha, 
                c.hora, 
                c.hora_fin,
                c.tipo as clase_tipo,
                c.estado as clase_estado,
                c.observaciones as clase_observaciones,
                c.pago_espacio_realizado,
                c.monto_referencia_espacio,
                c.monto_pago_espacio,
                act.nombre as actividad_nombre,
                l.nombre as lugar_nombre,
                (SELECT id FROM MovimientoCaja WHERE clase_id = c.id AND practicante_id = ${parseInt(practicanteId, 10)} AND categoria = 'Nota de Crédito' AND deleted_at IS NULL LIMIT 1) as nota_credito_practicante_id,
                (SELECT monto FROM MovimientoCaja WHERE clase_id = c.id AND practicante_id = ${parseInt(practicanteId, 10)} AND categoria = 'Nota de Crédito' AND deleted_at IS NULL LIMIT 1) as nota_credito_practicante_monto
            FROM Clase c
            LEFT JOIN Asistencia a ON c.id = a.clase_id AND a.practicante_id = ?
            LEFT JOIN InscripcionHorario ih ON c.horario_id = ih.horario_id AND ih.practicante_id = ? AND ih.activo = 1
            JOIN Actividad act ON c.actividad_id = act.id
            JOIN Lugar l ON c.lugar_id = l.id
            WHERE c.deleted_at IS NULL
            AND (
                a.id IS NOT NULL -- Clases donde ya está anotado (incluye canceladas)
                OR ih.id IS NOT NULL -- O clases donde está inscripto por horario
                OR (c.tipo = 'flexible' AND c.estado = 'programada') -- O clases particulares disponibles
            )
        `;

        const params = [practicanteId, practicanteId];

        if (filters.fecha_inicio) {
            sql += ' AND c.fecha >= ?';
            params.push(filters.fecha_inicio);
        }
        if (filters.fecha_fin) {
            sql += ' AND c.fecha <= ?';
            params.push(filters.fecha_fin);
        }
        if (filters.tipo) {
            sql += ' AND c.tipo = ?';
            params.push(filters.tipo);
        }

        sql += ' ORDER BY c.fecha DESC, c.hora DESC';

        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    /**
     * Registra o actualiza la asistencia de un practicante.
     */
    static async upsert(data) {
        const sql = `
            INSERT INTO Asistencia (practicante_id, clase_id, asistio)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE asistio = VALUES(asistio), updated_at = CURRENT_TIMESTAMP
        `;
        const [result] = await pool.execute(sql, [
            data.practicante_id,
            data.clase_id,
            data.asistio !== undefined ? data.asistio : 1
        ]);
        return result.affectedRows > 0;
    }

    /**
     * Elimina un registro de asistencia.
     */
    static async delete(practicanteId, claseId) {
        const sql = 'DELETE FROM Asistencia WHERE practicante_id = ? AND clase_id = ?';
        const [result] = await pool.execute(sql, [practicanteId, claseId]);
        return result.affectedRows > 0;
    }

    /**
     * Obtiene los practicantes elegibles para una clase (con abono activo).
     * Esto es clave para mostrar la lista de "presentismo".
     */
    static async getEligiblePracticantes(clase) {
        const fechaClase = (clase.fecha instanceof Date) 
            ? clase.fecha.toISOString().split('T')[0] 
            : clase.fecha;
        const horarioId = clase.horario_id || 0;

        const sql = `
            SELECT 
                p.id, 
                p.nombre_completo, 
                (
                    SELECT COALESCE(GROUP_CONCAT(DISTINCT ta.nombre SEPARATOR ', '), 'Sin Abono Activo')
                    FROM Abono ab
                    JOIN TipoAbono ta ON ab.tipo_abono_id = ta.id
                    WHERE ab.practicante_id = p.id 
                        AND ab.estado = 'activo' 
                        AND ab.deleted_at IS NULL
                        AND ab.fecha_inicio <= ?
                ) as abono_nombre,
                (
                    SELECT IF(COUNT(*) > 0, 1, 0)
                    FROM InscripcionHorario ih
                    WHERE ih.practicante_id = p.id 
                        AND ih.horario_id = ? 
                        AND ih.activo = 1
                ) as es_inscripto
            FROM Practicante p
            WHERE p.deleted_at IS NULL 
                AND p.es_profesor = 0 
                AND p.activo = 1
            ORDER BY es_inscripto DESC, p.nombre_completo ASC
        `;
        const [rows] = await pool.execute(sql, [fechaClase, horarioId]);
        return rows;
    }

    /**
     * Obtiene la cantidad de asistencias de un practicante en la semana de una fecha dada,
     * para un abono específico.
     */
    static async getWeeklyAttendanceCount(practicanteId, abonoId, fecha) {
        const sql = `
            SELECT COUNT(*) as count
            FROM Asistencia a
            JOIN Clase c ON a.clase_id = c.id
            JOIN Abono ab ON a.practicante_id = ab.practicante_id
            WHERE a.practicante_id = ?
            AND ab.id = ?
            AND a.asistio = 1
            AND YEARWEEK(c.fecha, 1) = YEARWEEK(?, 1)
            AND c.deleted_at IS NULL
        `;
        const [rows] = await pool.execute(sql, [practicanteId, abonoId, fecha]);
        return rows[0].count;
    }
}

export default Asistencia;
