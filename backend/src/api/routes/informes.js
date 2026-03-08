import express from 'express';
import pool from '../../config/database.js';
import { asyncHandler } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/informes/cuotas-sociales
 * Reporte de cuotas sociales pagadas en un periodo
 */
router.get('/cuotas-sociales', asyncHandler(async (req, res) => {
    const { mes, anio, lugar_id } = req.query;
    
    let sql = `
        SELECT 
            l.nombre as lugar_nombre,
            pr.nombre_completo as practicante_nombre,
            ps.mes_abono,
            ps.monto,
            ps.fecha_pago,
            ps.observaciones
        FROM PagoSocio ps
        JOIN Socio s ON ps.socio_id = s.id
        JOIN Practicante pr ON s.practicante_id = pr.id
        JOIN Lugar l ON s.lugar_id = l.id
        WHERE ps.deleted_at IS NULL AND ps.fecha_pago IS NOT NULL
    `;
    const params = [];

    if (mes && anio) {
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const mesAbono = `${monthNames[mes - 1]} ${anio}`;
        sql += ' AND ps.mes_abono = ?';
        params.push(mesAbono);
    }

    if (lugar_id) {
        sql += ' AND (l.id = ? OR l.parent_id = ?)';
        params.push(lugar_id, lugar_id);
    }

    sql += ' ORDER BY l.nombre, pr.nombre_completo';

    const [rows] = await pool.execute(sql, params);
    res.json({ data: rows });
}));

/**
 * GET /api/informes/padron-socios-pagos
 * Reporte detallado de socios con cuota pagada
 */
router.get('/padron-socios-pagos', asyncHandler(async (req, res) => {
    const { mes, anio, lugar_id } = req.query;
    
    let sql = `
        SELECT 
            s.id as sistema_id,
            s.numero_socio,
            pr.nombre_completo,
            pr.dni,
            pr.fecha_nacimiento,
            pr.telefono,
            pr.email,
            pr.direccion,
            l.nombre as sede_nombre,
            ps.mes_abono,
            ps.monto,
            ps.fecha_pago,
            IF(ps.monto >= l.cuota_social_general OR ps.monto >= l.cuota_social_descuento, 'Completa', 'Parcial') as tipo_pago,
            CASE 
                WHEN ps.monto = l.cuota_social_general THEN 'General'
                WHEN ps.monto = l.cuota_social_descuento THEN 'Bonificada/Descuento'
                ELSE 'Manual/Ajustada'
            END as categoria_cuota
        FROM PagoSocio ps
        JOIN Socio s ON ps.socio_id = s.id
        JOIN Practicante pr ON s.practicante_id = pr.id
        JOIN Lugar l ON s.lugar_id = l.id
        WHERE ps.deleted_at IS NULL AND ps.fecha_pago IS NOT NULL
    `;
    const params = [];

    if (mes && anio) {
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const mesAbono = `${monthNames[mes - 1]} ${anio}`;
        sql += ' AND ps.mes_abono = ?';
        params.push(mesAbono);
    }

    if (lugar_id) {
        sql += ' AND (l.id = ? OR l.parent_id = ?)';
        params.push(lugar_id, lugar_id);
    }

    sql += ' ORDER BY l.nombre, pr.nombre_completo';

    const [rows] = await pool.execute(sql, params);
    res.json({ data: rows });
}));

/**
 * GET /api/informes/alquiler-espacios
 * Reporte de pagos por alquiler de espacios (Club)
 */
router.get('/alquiler-espacios', asyncHandler(async (req, res) => {
    const { fecha_inicio, fecha_fin, lugar_id } = req.query;

    let sql = `
        SELECT 
            l.nombre as lugar_nombre,
            c.fecha,
            c.hora,
            c.hora_fin,
            a.nombre as actividad_nombre,
            c.monto_referencia_espacio as monto_esperado,
            c.monto_pago_espacio as monto_pagado,
            c.fecha_pago_espacio as fecha_pago,
            (IFNULL(c.monto_referencia_espacio, 0) - IFNULL(c.monto_pago_espacio, 0)) as diferencia
        FROM Clase c
        JOIN Lugar l ON c.lugar_id = l.id
        JOIN Actividad a ON c.actividad_id = a.id
        WHERE c.deleted_at IS NULL AND c.pago_espacio_realizado = 1
    `;
    const params = [];

    if (fecha_inicio) {
        sql += ' AND c.fecha >= ?';
        params.push(fecha_inicio);
    }
    if (fecha_fin) {
        sql += ' AND c.fecha <= ?';
        params.push(fecha_fin);
    }
    if (lugar_id) {
        sql += ' AND (l.id = ? OR l.parent_id = ?)';
        params.push(lugar_id, lugar_id);
    }

    sql += ' ORDER BY l.nombre, c.fecha, c.hora';

    const [rows] = await pool.execute(sql, params);
    res.json({ data: rows });
}));

/**
 * GET /api/informes/consolidado-sede
 * Informe fusionado de Cuotas y Alquileres
 */
router.get('/consolidado-sede', asyncHandler(async (req, res) => {
    const { mes, anio, lugar_id } = req.query;
    if (!lugar_id) throw new AppError('Debe seleccionar una sede para el informe consolidado', 400);

    // 1. Obtener Cuotas Sociales (mismo filtro inclusivo de hijos)
    let sqlCuotas = `
        SELECT l.nombre as lugar_nombre, pr.nombre_completo, ps.monto, ps.mes_abono
        FROM PagoSocio ps
        JOIN Socio s ON ps.socio_id = s.id
        JOIN Practicante pr ON s.practicante_id = pr.id
        JOIN Lugar l ON s.lugar_id = l.id
        WHERE ps.deleted_at IS NULL AND ps.fecha_pago IS NOT NULL
        AND (l.id = ? OR l.parent_id = ?)
    `;
    const paramsCuotas = [lugar_id, lugar_id];

    if (mes && anio) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        paramsCuotas.push(`${monthNames[mes - 1]} ${anio}`);
        sqlCuotas += ' AND ps.mes_abono = ?';
    }

    // 2. Obtener Alquileres (mismo filtro inclusivo)
    const firstDay = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).toISOString().split('T')[0];
    
    let sqlAlquileres = `
        SELECT l.nombre as lugar_nombre, c.fecha, c.hora, c.hora_fin, a.nombre as actividad_nombre, c.monto_pago_espacio as monto
        FROM Clase c
        JOIN Lugar l ON c.lugar_id = l.id
        JOIN Actividad a ON c.actividad_id = a.id
        WHERE c.deleted_at IS NULL AND c.pago_espacio_realizado = 1
        AND (l.id = ? OR l.parent_id = ?)
        AND c.fecha >= ? AND c.fecha <= ?
    `;
    const paramsAlquileres = [lugar_id, lugar_id, firstDay, lastDay];

    const [cuotas] = await pool.execute(sqlCuotas, paramsCuotas);
    const [alquileres] = await pool.execute(sqlAlquileres, paramsAlquileres);

    res.json({ 
        data: {
            cuotas,
            alquileres
        } 
    });
}));

export default router;
