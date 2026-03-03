import pool from '../config/database.js';

export class Clase {
    constructor(data) {
        this.id = data.id || null;
        this.tipo = data.tipo || 'grupal';
        this.horario_id = data.horario_id || null;
        this.actividad_id = data.actividad_id;
        this.lugar_id = data.lugar_id;
        this.profesor_id = data.profesor_id || null;
        this.fecha = data.fecha;
        this.hora = data.hora;
        this.hora_fin = data.hora_fin;
        this.estado = data.estado || 'programada';
        this.motivo_cancelacion = data.motivo_cancelacion || null;
        this.observaciones = data.observaciones || null;
        this.usuario_id = data.usuario_id || null;
        this.pago_espacio_realizado = data.pago_espacio_realizado !== undefined ? !!data.pago_espacio_realizado : false;
        this.fecha_pago_espacio = data.fecha_pago_espacio || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.deleted_at = data.deleted_at || null;

        // Joined data
        this.actividad_nombre = data.actividad_nombre || null;
        this.lugar_nombre = data.lugar_nombre || null;
        this.profesor_nombre = data.profesor_nombre || null;
        this.asistentes_count = data.asistentes_count || 0;
        
        // Fee data from Lugar
        this.costo_tarifa = data.costo_tarifa !== undefined ? data.costo_tarifa : 0.00;
        this.tipo_tarifa = data.tipo_tarifa || 'por_hora';
    }

    static async findAll(filters = {}) {
        let sql = `
            SELECT c.*, a.nombre as actividad_nombre, l.nombre as lugar_nombre, 
                   p.nombre_completo as profesor_nombre,
                   l.costo_tarifa, l.tipo_tarifa,
                   (SELECT COUNT(*) FROM Asistencia WHERE clase_id = c.id AND asistio = 1) as asistentes_count
            FROM Clase c
            JOIN Actividad a ON c.actividad_id = a.id
            JOIN Lugar l ON c.lugar_id = l.id
            LEFT JOIN Practicante p ON c.profesor_id = p.id
            WHERE c.deleted_at IS NULL
        `;
        const params = [];

        if (filters.fecha_inicio && filters.fecha_inicio !== '') {
            sql += ' AND c.fecha >= ?';
            params.push(filters.fecha_inicio);
        }
        if (filters.fecha_fin && filters.fecha_fin !== '') {
            sql += ' AND c.fecha <= ?';
            params.push(filters.fecha_fin);
        }
        if (filters.actividad_id && filters.actividad_id !== '') {
            sql += ' AND c.actividad_id = ?';
            params.push(filters.actividad_id);
        }
        if (filters.lugar_id && filters.lugar_id !== '') {
            sql += ' AND c.lugar_id = ?';
            params.push(filters.lugar_id);
        }
        if (filters.profesor_id && filters.profesor_id !== '') {
            sql += ' AND c.profesor_id = ?';
            params.push(filters.profesor_id);
        }
        if (filters.tipo && filters.tipo !== '') {
            sql += ' AND c.tipo = ?';
            params.push(filters.tipo);
        }

        sql += ' ORDER BY c.fecha ASC, c.hora ASC';

        const [rows] = await pool.execute(sql, params);
        return rows.map(row => new Clase(row));
    }

    static async findById(id) {
        const sql = `
            SELECT c.*, a.nombre as actividad_nombre, l.nombre as lugar_nombre, 
                   p.nombre_completo as profesor_nombre,
                   l.costo_tarifa, l.tipo_tarifa,
                   (SELECT COUNT(*) FROM Asistencia WHERE clase_id = c.id AND asistio = 1) as asistentes_count
            FROM Clase c
            JOIN Actividad a ON c.actividad_id = a.id
            JOIN Lugar l ON c.lugar_id = l.id
            LEFT JOIN Practicante p ON c.profesor_id = p.id
            WHERE c.id = ? AND c.deleted_at IS NULL
        `;
        const [rows] = await pool.execute(sql, [id]);
        return rows.length ? new Clase(rows[0]) : null;
    }

    static async create(data) {
        const sql = `
            INSERT INTO Clase (tipo, horario_id, actividad_id, lugar_id, profesor_id, fecha, hora, hora_fin, estado, motivo_cancelacion, observaciones, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.tipo || 'grupal',
            data.horario_id || null,
            data.actividad_id,
            data.lugar_id,
            data.profesor_id || null,
            data.fecha,
            data.hora,
            data.hora_fin,
            data.estado || 'programada',
            data.motivo_cancelacion || null,
            data.observaciones || null,
            data.usuario_id || null
        ];

        const [result] = await pool.execute(sql, values);
        return await this.findById(result.insertId);
    }

    static async update(id, data) {
        const allowedFields = [
            'tipo', 'estado', 'motivo_cancelacion', 'observaciones', 
            'fecha', 'hora', 'hora_fin', 'profesor_id',
            'pago_espacio_realizado', 'fecha_pago_espacio'
        ];

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
        const sql = `UPDATE Clase SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;

        await pool.execute(sql, values);
        return await this.findById(id);
    }

    static async delete(id) {
        const sql = 'UPDATE Clase SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
        const [result] = await pool.execute(sql, [id]);
        return result.affectedRows > 0;
    }

    toJSON() {
        // Asegurar que la fecha sea una cadena YYYY-MM-DD
        let fechaFormatted = this.fecha;
        if (this.fecha instanceof Date) {
            fechaFormatted = this.fecha.toISOString().split('T')[0];
        } else if (typeof this.fecha === 'string' && this.fecha.includes('T')) {
            fechaFormatted = this.fecha.split('T')[0];
        }

        let fechaPagoFormatted = this.fecha_pago_espacio;
        if (this.fecha_pago_espacio instanceof Date) {
            fechaPagoFormatted = this.fecha_pago_espacio.toISOString().split('T')[0];
        } else if (typeof this.fecha_pago_espacio === 'string' && this.fecha_pago_espacio.includes('T')) {
            fechaPagoFormatted = this.fecha_pago_espacio.split('T')[0];
        }

        return {
            id: this.id,
            tipo: this.tipo,
            horario_id: this.horario_id,
            actividad_id: this.actividad_id,
            lugar_id: this.lugar_id,
            profesor_id: this.profesor_id,
            fecha: fechaFormatted,
            hora: this.hora,
            hora_fin: this.hora_fin,
            estado: this.estado,
            motivo_cancelacion: this.motivo_cancelacion,
            observaciones: this.observaciones,
            usuario_id: this.usuario_id,
            pago_espacio_realizado: this.pago_espacio_realizado,
            fecha_pago_espacio: fechaPagoFormatted,
            actividad_nombre: this.actividad_nombre,
            lugar_nombre: this.lugar_nombre,
            profesor_nombre: this.profesor_nombre,
            asistentes_count: this.asistentes_count,
            costo_tarifa: this.costo_tarifa,
            tipo_tarifa: this.tipo_tarifa,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

export default Clase;
