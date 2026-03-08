import express from 'express';
import pool from '../../config/database.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { authenticateToken } from '../../middleware/auth.js';
import PagoService from '../../services/pagoService.js';

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
        const mesNombre = monthNames[mes - 1];
        sql += ' AND ps.mes_abono LIKE ?';
        params.push(`%${mesNombre}%${anio}%`);
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
    
    if (!mes || !anio) {
        throw new AppError('Mes y año son obligatorios', 400);
    }

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mesAbono = `${monthNames[mes - 1]} ${anio}`;

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
            ps.estado_desconocido,
            CASE 
                WHEN ps.id IS NULL THEN 'Pendiente'
                WHEN ps.estado_desconocido = 1 THEN 'Relación Directa'
                WHEN ps.monto >= l.cuota_social_general OR ps.monto >= l.cuota_social_descuento THEN 'Completa'
                ELSE 'Parcial'
            END as tipo_pago,
            CASE 
                WHEN ps.id IS NULL THEN 'NO ABONÓ AÚN'
                WHEN ps.estado_desconocido = 1 THEN '¿ABONÓ DIRECTO?'
                WHEN ps.monto = l.cuota_social_general THEN 'General'
                WHEN ps.monto = l.cuota_social_descuento THEN 'Bonificada/Descuento'
                ELSE 'Manual/Ajustada'
            END as categoria_cuota
        FROM Socio s
        JOIN Practicante pr ON s.practicante_id = pr.id
        JOIN Lugar l ON s.lugar_id = l.id
        -- Unimos con PagoSocio para el mes específico
        LEFT JOIN PagoSocio ps ON ps.socio_id = s.id 
            AND ps.mes_abono = ? 
            AND ps.deleted_at IS NULL
        -- Solo incluimos socios registrados en esa sede
        WHERE s.deleted_at IS NULL
    `;
    const params = [mesAbono];

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

    // 1. Obtener Cuotas Sociales
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
        const mesNombre = monthNames[mes - 1];
        sqlCuotas += ' AND ps.mes_abono LIKE ?';
        paramsCuotas.push(`%${mesNombre}%${anio}%`);
    }

    // 2. Obtener Alquileres
    const firstDay = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).toISOString().split('T')[0];
    
    let sqlAlquileres = `
        SELECT 
            l.nombre as lugar_nombre, 
            c.fecha, 
            c.hora, 
            c.hora_fin, 
            a.nombre as actividad_nombre, 
            c.monto_pago_espacio as monto,
            c.estado,
            c.observaciones,
            c.motivo_cancelacion
        FROM Clase c
        JOIN Lugar l ON c.lugar_id = l.id
        JOIN Actividad a ON c.actividad_id = a.id
        WHERE c.deleted_at IS NULL 
        AND (c.pago_espacio_realizado = 1 OR c.estado IN ('cancelada', 'suspendida'))
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

/**
 * GET /api/informes/balance-mensual
 * Informe de flujo de caja completo y rentabilidad por hora
 */
router.get('/balance-mensual', asyncHandler(async (req, res) => {
    const { mes, anio, lugar_id, criterio = 'pago' } = req.query;
    if (!mes || !anio) throw new AppError('Mes y año son obligatorios', 400);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesNombre = monthNames[mes - 1];
    
    // 1. Get all payments using the shared service (SAME LOGIC AS CASH FLOW UI)
    const allPagos = await PagoService.getAllPayments({
        mes: parseInt(mes, 10),
        anio: parseInt(anio, 10),
        lugar_id: lugar_id ? parseInt(lugar_id, 10) : undefined,
        filter_by_mes_abono: criterio === 'mes'
    });

    let ingresosAbonos = 0;
    let ingresosCuotas = 0;
    let egresosAlquiler = 0;
    let egresosCuotas = 0;

    allPagos.forEach(p => {
        const monto = Math.abs(parseFloat(p.monto));
        if (p.pago_tipo === 'ingreso') {
            // Social fee or abono?
            if (p.tipo_abono_nombre === 'Recepción Cuota Social' || !p.categoria) {
                ingresosCuotas += monto;
            } else {
                ingresosAbonos += monto;
            }
        } else if (p.pago_tipo === 'egreso') {
            if (p.tipo_abono_nombre === 'Costo de Espacio') {
                egresosAlquiler += monto;
            } else if (p.tipo_abono_nombre === 'Egreso Cuota Social (Club)') {
                egresosCuotas += monto;
            }
        }
    });

    // 2. Otros Movimientos de Caja (Ventas, Gastos Extra)
    const firstDay = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).toISOString().split('T')[0];
    
    let sqlMovCaja = `
        SELECT tipo, SUM(monto) as total
        FROM MovimientoCaja
        WHERE deleted_at IS NULL AND fecha >= ? AND fecha <= ?
        GROUP BY tipo
    `;
    const [movimientos] = await pool.execute(sqlMovCaja, [firstDay, lastDay]);
    const otrosIngresos = parseFloat(movimientos.find(m => m.tipo === 'ingreso')?.total || 0);
    const otrosEgresos = parseFloat(movimientos.find(m => m.tipo === 'egreso')?.total || 0);

    // 3. Total de Horas para Rentabilidad
    let sqlHoras = `
        SELECT SUM(TIME_TO_SEC(TIMEDIFF(hora_fin, hora))) / 3600 as horas
        FROM Clase
        WHERE deleted_at IS NULL 
        AND estado NOT IN ('cancelada', 'suspendida')
        AND fecha >= ? AND fecha <= ?
    `;
    const paramsHoras = [firstDay, lastDay];
    if (lugar_id) {
        sqlHoras += ' AND (lugar_id = ? OR lugar_id IN (SELECT id FROM Lugar WHERE parent_id = ?))';
        paramsHoras.push(lugar_id, lugar_id);
    }
    const [[{ horas: totalHoras }]] = await pool.execute(sqlHoras, paramsHoras);

    const totalIngresos = ingresosAbonos + ingresosCuotas + otrosIngresos;
    const totalEgresos = egresosAlquiler + egresosCuotas + otrosEgresos;
    const balanceNeto = totalIngresos - totalEgresos;
    const gananciaPorHora = totalHoras > 0 ? balanceNeto / totalHoras : 0;

    res.json({
        data: {
            periodo: `${mesNombre} ${anio}`,
            criterio,
            ingresosAbonos,
            ingresosCuotas,
            otrosIngresos,
            egresosAlquiler,
            egresosCuotas,
            otrosEgresos,
            totalIngresos,
            totalEgresos,
            balanceNeto,
            totalHoras: parseFloat(totalHoras || 0),
            gananciaPorHora
        }
    });
}));

export default router;
