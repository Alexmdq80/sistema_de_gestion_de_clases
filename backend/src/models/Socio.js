import pool from '../config/database.js';

/**
 * Socio Model
 */
export class Socio {
    constructor(data) {
        this.id = data.id || null;
        this.practicante_id = data.practicante_id;
        this.lugar_id = data.lugar_id;
        this.numero_socio = data.numero_socio;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.deleted_at = data.deleted_at || null;

        // Joined data
        this.nombre_completo = data.nombre_completo || null;
        this.lugar_nombre = data.lugar_nombre || null;
        this.cuota_social_general = data.cuota_social_general || 0.00;
        this.cuota_social_descuento = data.cuota_social_descuento || 0.00;
        this.es_profesor = data.es_profesor !== undefined ? !!data.es_profesor : false;
    }

    static async findAll(filters = {}) {
        let sql = `
            SELECT s.*, p.nombre_completo, p.es_profesor, l.nombre as lugar_nombre,
                   COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                   COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Socio s
            JOIN Practicante p ON s.practicante_id = p.id
            JOIN Lugar l ON s.lugar_id = l.id
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE s.deleted_at IS NULL
        `;
        const params = [];

        if (filters.search) {
            sql += ' AND (p.nombre_completo LIKE ? OR s.numero_socio LIKE ?)';
            const term = `%${filters.search}%`;
            params.push(term, term);
        }

        if (filters.lugar_id) {
            sql += ' AND s.lugar_id = ?';
            params.push(filters.lugar_id);
        }

        if (filters.practicante_id) {
            sql += ' AND s.practicante_id = ?';
            params.push(filters.practicante_id);
        }

        sql += ' ORDER BY p.nombre_completo ASC';

        const [rows] = await pool.execute(sql, params);
        return rows.map(row => new Socio(row));
    }

    static async findById(id, connection = null) {
        const sql = `
            SELECT s.*, p.nombre_completo, p.es_profesor, l.nombre as lugar_nombre,
                   COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                   COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Socio s
            JOIN Practicante p ON s.practicante_id = p.id
            JOIN Lugar l ON s.lugar_id = l.id
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE s.id = ? AND s.deleted_at IS NULL
        `;
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [id]);
        return rows.length ? new Socio(rows[0]) : null;
    }

    static async findByPracticanteAndLugar(practicanteId, lugarId, connection = null) {
        const sql = `
            SELECT s.*, p.nombre_completo, p.es_profesor, l.nombre as lugar_nombre,
                   COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                   COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Socio s
            JOIN Practicante p ON s.practicante_id = p.id
            JOIN Lugar l ON s.lugar_id = l.id
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE s.practicante_id = ? AND s.lugar_id = ? AND s.deleted_at IS NULL
        `;
        const executor = connection || pool;
        const [rows] = await executor.execute(sql, [practicanteId, lugarId]);
        return rows.length ? new Socio(rows[0]) : null;
    }

    /**
     * Finds practicantes that should be socios:
     * 1. Have an active abono in a lugar that requires cuota social.
     * 2. Are professors teaching in a lugar that requires cuota social.
     * But don't have a socio record yet for that lugar.
     */
    static async findCandidates() {
        const sql = `
            SELECT DISTINCT p.id as practicante_id, p.nombre_completo, p.es_profesor, 
                   COALESCE(l.parent_id, l.id) as real_lugar_id,
                   COALESCE(lp.nombre, l.nombre) as real_lugar_nombre,
                   COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                   COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Practicante p
            -- Case 1: Active Abonos
            LEFT JOIN Abono a ON p.id = a.practicante_id AND a.estado = 'activo' AND a.fecha_vencimiento >= CURDATE() AND a.deleted_at IS NULL
            LEFT JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
            -- Case 2: Professors teaching at locations
            LEFT JOIN Horario h ON p.id = h.profesor_id AND h.deleted_at IS NULL AND h.activo = 1
            -- Join with Lugar through either TipoAbono or Horario
            JOIN Lugar l ON (ta.lugar_id = l.id OR h.lugar_id = l.id)
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE p.deleted_at IS NULL
              AND (
                  (l.parent_id IS NULL AND l.cobra_cuota_social = 1) OR
                  (l.parent_id IS NOT NULL AND lp.cobra_cuota_social = 1)
              )
              AND NOT EXISTS (
                  SELECT 1 FROM Socio s 
                  WHERE s.practicante_id = p.id 
                    AND s.lugar_id = COALESCE(l.parent_id, l.id)
                    AND s.deleted_at IS NULL
              )
        `;
        const [rows] = await pool.execute(sql);
        return rows;
    }

    /**
     * Finds locations where the teacher is assigned in weekly schedules.
     */
    static async getMyTeacherLugares(userId) {
        // 1. Identify teacher's practicante record
        const [practicantes] = await pool.execute(
            'SELECT id FROM Practicante WHERE user_id = ? AND deleted_at IS NULL',
            [userId]
        );
        if (practicantes.length === 0) return [];
        
        const practicanteId = practicantes[0].id;

        const sql = `
            SELECT DISTINCT 
                COALESCE(l.parent_id, l.id) as id,
                COALESCE(lp.nombre, l.nombre) as nombre,
                COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Horario h
            JOIN Lugar l ON h.lugar_id = l.id
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE h.profesor_id = ? AND h.deleted_at IS NULL AND h.activo = 1
        `;
        const [rows] = await pool.execute(sql, [practicanteId]);
        return rows;
    }

    /**
     * Gets membership alerts for a teacher (missing registrations or expired payments).
     */
    static async getTeacherAlerts(userId) {
        // 1. Identify teacher's practicante record
        const [practicantes] = await pool.execute(
            'SELECT id FROM Practicante WHERE user_id = ? AND deleted_at IS NULL',
            [userId]
        );
        if (practicantes.length === 0) return { missingRegistration: [], expiredPayments: [], soonToExpire: [] };
        
        const practicanteId = practicantes[0].id;

        // 2. Identify required locations (from Horarios)
        const [lugares] = await pool.execute(`
            SELECT DISTINCT COALESCE(l.parent_id, l.id) as id, COALESCE(lp.nombre, l.nombre) as nombre
            FROM Horario h
            JOIN Lugar l ON h.lugar_id = l.id
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE h.profesor_id = ? AND h.deleted_at IS NULL AND h.activo = 1
        `, [practicanteId]);

        const alerts = {
            missingRegistration: [],
            expiredPayments: [],
            soonToExpire: []
        };

        for (const lugar of lugares) {
            // Check if Socio record exists
            const [socios] = await pool.execute(
                'SELECT id FROM Socio WHERE practicante_id = ? AND lugar_id = ? AND deleted_at IS NULL',
                [practicanteId, lugar.id]
            );

            if (socios.length === 0) {
                alerts.missingRegistration.push(lugar);
                continue;
            }

            const socioId = socios[0].id;

            // Check latest payment
            const [pagos] = await pool.execute(`
                SELECT fecha_vencimiento 
                FROM PagoSocio 
                WHERE socio_id = ? AND deleted_at IS NULL
                ORDER BY fecha_vencimiento DESC LIMIT 1
            `, [socioId]);

            if (pagos.length === 0) {
                alerts.expiredPayments.push({ ...lugar, reason: 'Sin pagos registrados' });
            } else {
                const vencimiento = new Date(pagos[0].fecha_vencimiento);
                const today = new Date();
                today.setHours(0,0,0,0);
                
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);

                if (vencimiento < today) {
                    alerts.expiredPayments.push({ ...lugar, vencimiento: pagos[0].fecha_vencimiento });
                } else if (vencimiento <= nextWeek) {
                    alerts.soonToExpire.push({ ...lugar, vencimiento: pagos[0].fecha_vencimiento });
                }
            }
        }

        return alerts;
    }

    static async create(data, connection = null, userId = null) {
        const sql = `
            INSERT INTO Socio (practicante_id, lugar_id, numero_socio)
            VALUES (?, ?, ?)
        `;
        const executor = connection || pool;
        const [result] = await executor.execute(sql, [
            data.practicante_id,
            data.lugar_id,
            data.numero_socio
        ]);
        
        const newSocio = await this.findById(result.insertId, executor);
        if (newSocio) {
            await this.recordHistory(newSocio.id, 'CREATE', null, newSocio.toJSON(), userId, executor);
        }
        return newSocio;
    }

    static async update(id, data, connection = null, userId = null) {
        const executor = connection || pool;
        const current = await this.findById(id, executor);
        if (!current) return null;

        const sql = `
            UPDATE Socio SET numero_socio = ?
            WHERE id = ? AND deleted_at IS NULL
        `;
        await executor.execute(sql, [data.numero_socio, id]);
        
        const updated = await this.findById(id, executor);
        if (updated) {
            await this.recordHistory(id, 'UPDATE', current.toJSON(), updated.toJSON(), userId, executor);
        }
        return updated;
    }

    static async delete(id, connection = null, userId = null) {
        const executor = connection || pool;
        const current = await this.findById(id, executor);
        if (!current) return false;

        const sql = 'UPDATE Socio SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
        const [result] = await executor.execute(sql, [id]);
        
        if (result.affectedRows > 0) {
            await this.recordHistory(id, 'DELETE', current.toJSON(), null, userId, executor);
            return true;
        }
        return false;
    }

    static async recordHistory(socioId, action, oldData, newData, userId, connection = null) {
        const sql = `
            INSERT INTO HistorialSocio (socio_id, accion, datos_anteriores, datos_nuevos, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `;
        const executor = connection || pool;
        await executor.execute(sql, [
            socioId,
            action,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            userId
        ]);
    }

    static async getHistory(id) {
        const sql = `
            SELECT h.*, u.email as usuario_email
            FROM HistorialSocio h
            LEFT JOIN User u ON h.usuario_id = u.id
            WHERE h.socio_id = ?
            ORDER BY h.fecha DESC
        `;
        const [rows] = await pool.execute(sql, [id]);
        return rows.map(row => ({
            ...row,
            datos_anteriores: row.datos_anteriores ? JSON.parse(row.datos_anteriores) : null,
            datos_nuevos: row.datos_nuevos ? JSON.parse(row.datos_nuevos) : null
        }));
    }

    toJSON() {
        return {
            id: this.id,
            practicante_id: this.practicante_id,
            lugar_id: this.lugar_id,
            numero_socio: this.numero_socio,
            nombre_completo: this.nombre_completo,
            lugar_nombre: this.lugar_nombre,
            cuota_social_general: this.cuota_social_general,
            cuota_social_descuento: this.cuota_social_descuento,
            es_profesor: this.es_profesor,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

export default Socio;
