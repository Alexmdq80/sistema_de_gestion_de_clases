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
            s.numero_socio,
            ps.mes_abono,
            ps.monto,
            ps.fecha_pago,
            ps.observaciones,
            EXISTS(SELECT 1 FROM Pago p JOIN MovimientoCaja mc ON mc.usado_en_pago_id = p.id WHERE p.pago_socio_id = ps.id AND mc.deleted_at IS NULL) as es_nota_credito
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

    // Calculate the threshold date: 2 months before the report month (first day of report month minus 2 months)
    const reportDate = new Date(anio, mes - 1, 1);
    const thresholdDate = new Date(reportDate);
    thresholdDate.setMonth(thresholdDate.getMonth() - 2);
    const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

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
            pr.activo,
            pr.archivado_at,
            pr.reingreso_at,
            pr.created_at,
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
        -- Solo incluimos socios registrados en esa sede que estén activos o archivados hace menos de 2 meses
        WHERE s.deleted_at IS NULL
        AND (pr.activo = 1 OR pr.archivado_at >= ?)
    `;
    const params = [mesAbono, thresholdDateStr];

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
            (IFNULL(c.monto_referencia_espacio, 0) - IFNULL(c.monto_pago_espacio, 0)) as diferencia,
            EXISTS(SELECT 1 FROM MovimientoCaja mc WHERE mc.usado_en_clase_id = c.id AND mc.deleted_at IS NULL) as es_nota_credito
        FROM Clase c
        JOIN Lugar l ON c.lugar_id = l.id
        JOIN Actividad a ON c.actividad_id = a.id
        WHERE c.deleted_at IS NULL AND (c.pago_espacio_realizado = 1 OR c.monto_pago_espacio > 0)
    `;
    const params = [];

    if (fecha_inicio && fecha_fin) {
        // ALWAYS filter by Payment Date (or fallback to Class Date if not set) for Rental Reports
        sql += ' AND COALESCE(c.fecha_pago_espacio, c.fecha) >= ? AND COALESCE(c.fecha_pago_espacio, c.fecha) <= ?';
        params.push(fecha_inicio, fecha_fin);
    } else {
        if (fecha_inicio) {
            sql += ' AND COALESCE(c.fecha_pago_espacio, c.fecha) >= ?';
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            sql += ' AND COALESCE(c.fecha_pago_espacio, c.fecha) <= ?';
            params.push(fecha_fin);
        }
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
    const { mes, anio, lugar_id, criterio = 'pago' } = req.query;
    if (!lugar_id) throw new AppError('Debe seleccionar una sede para el informe consolidado', 400);

    // 1. Obtener Cuotas Sociales
    let sqlCuotas = `
        SELECT l.nombre as lugar_nombre, pr.nombre_completo, s.numero_socio, ps.monto, ps.mes_abono,
        EXISTS(SELECT 1 FROM Pago p JOIN MovimientoCaja mc ON mc.usado_en_pago_id = p.id WHERE p.pago_socio_id = ps.id AND mc.deleted_at IS NULL) as es_nota_credito
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
            c.motivo_cancelacion,
            EXISTS(SELECT 1 FROM MovimientoCaja mc WHERE mc.usado_en_clase_id = c.id AND mc.deleted_at IS NULL) as es_nota_credito
        FROM Clase c
        JOIN Lugar l ON c.lugar_id = l.id
        JOIN Actividad a ON c.actividad_id = a.id
        WHERE c.deleted_at IS NULL 
        AND (c.pago_espacio_realizado = 1 OR c.monto_pago_espacio > 0 OR c.estado IN ('cancelada', 'suspendida', 'sin_actividad'))
        AND (l.id = ? OR l.parent_id = ?)
        AND COALESCE(c.fecha_pago_espacio, c.fecha) >= ? AND COALESCE(c.fecha_pago_espacio, c.fecha) <= ?
        ORDER BY l.nombre, c.fecha, c.hora
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
    let otrosIngresos = 0;
    let egresosAlquiler = 0;
    let egresosCuotas = 0;
    let otrosEgresos = 0;

    allPagos.forEach(p => {
        // Skip non-cash movements (Credit Notes) to match liquidity reports
        if (p.metodo_pago === 'nota_credito') return;

        const monto = Math.abs(parseFloat(p.monto));
        const nombre = p.tipo_abono_nombre;

        if (p.pago_tipo === 'ingreso') {
            if (p.categoria) {
                // Payments for subscriptions (Tai Chi, Yoga, etc.)
                ingresosAbonos += monto;
            } else if (nombre === 'Recepción Cuota Social' || nombre === 'Cuota Social') {
                // Actual social fee receipts from students
                ingresosCuotas += monto;
            } else {
                // Other cash inflows (Sales, etc.)
                otrosIngresos += monto;
            }
        } else if (p.pago_tipo === 'egreso') {
            if (nombre === 'Costo de Espacio') {
                egresosAlquiler += monto;
            } else if (nombre === 'Egreso Cuota Social (Club)') {
                egresosCuotas += monto;
            } else {
                // Other cash outflows (Extra expenses)
                otrosEgresos += monto;
            }
        }
    });

    // 2. Cálculo de Horas para Rentabilidad
    const firstDay = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).toISOString().split('T')[0];

    let sqlHoras = `
        SELECT SUM(TIME_TO_SEC(TIMEDIFF(hora_fin, hora))) / 3600 as horas
        FROM Clase
        WHERE deleted_at IS NULL 
        AND estado NOT IN ('cancelada', 'suspendida', 'sin_actividad')
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

/**
 * GET /api/informes/practicantes/cumpleanos
 * Reporte de cumpleaños de practicantes
 */
router.get('/practicantes/cumpleanos', asyncHandler(async (req, res) => {
    const { mes, lugar_id } = req.query;
    
    let sql = `
        SELECT
            p.nombre_completo,
            p.fecha_nacimiento,
            p.cumple_dia,
            p.cumple_mes,
            IF(p.fecha_nacimiento IS NOT NULL, TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()), NULL) AS edad,
            l.nombre as sede_nombre
        FROM Practicante p
        LEFT JOIN Socio s ON s.practicante_id = p.id AND s.deleted_at IS NULL
        LEFT JOIN Lugar l ON s.lugar_id = l.id
        WHERE p.deleted_at IS NULL
          AND (p.fecha_nacimiento IS NOT NULL OR (p.cumple_dia IS NOT NULL AND p.cumple_mes IS NOT NULL))
    `;
    const params = [];

    if (mes) {
        sql += ' AND (MONTH(p.fecha_nacimiento) = ? OR p.cumple_mes = ?)';
        params.push(mes, mes);
    }

    if (lugar_id) {
        sql += ' AND (l.id = ? OR l.parent_id = ?)';
        params.push(lugar_id, lugar_id);
    }

    sql += ` ORDER BY 
        COALESCE(p.cumple_mes, MONTH(p.fecha_nacimiento)), 
        COALESCE(p.cumple_dia, DAY(p.fecha_nacimiento)), 
        p.nombre_completo`;

    const [rows] = await pool.execute(sql, params);
    res.json({ data: rows });
}));

/**
 * GET /api/informes/inscripciones-horarios
 * Reporte de practicantes inscritos por cada horario semanal
 */
router.get('/inscripciones-horarios', asyncHandler(async (req, res) => {
    const { lugar_id } = req.query;
    
    let sql = `
        SELECT 
            h.id as horario_id,
            h.dia_semana,
            h.hora_inicio,
            h.hora_fin,
            h.tipo as horario_tipo,
            a.nombre as actividad_nombre,
            l.nombre as lugar_nombre,
            prof.nombre_completo as profesor_nombre,
            pr.id as practicante_id,
            pr.nombre_completo as practicante_nombre
        FROM Horario h
        JOIN Actividad a ON h.actividad_id = a.id
        JOIN Lugar l ON h.lugar_id = l.id
        LEFT JOIN Practicante prof ON h.profesor_id = prof.id
        LEFT JOIN InscripcionHorario ih ON h.id = ih.horario_id AND ih.activo = 1 AND ih.fecha_hasta IS NULL AND ih.deleted_at IS NULL
        LEFT JOIN Practicante pr ON ih.practicante_id = pr.id AND pr.deleted_at IS NULL AND pr.activo = 1
        WHERE h.deleted_at IS NULL AND h.activo = 1 AND h.tipo = 'grupal'
    `;
    const params = [];

    if (lugar_id) {
        sql += ' AND (l.id = ? OR l.parent_id = ?)';
        params.push(lugar_id, lugar_id);
    }

    sql += ' ORDER BY h.dia_semana, h.hora_inicio, pr.nombre_completo';

    const [rows] = await pool.execute(sql, params);

    // Grouping by schedule in JS to make it easier for the frontend
    const reportData = [];
    const schedulesMap = new Map();

    rows.forEach(row => {
        if (!schedulesMap.has(row.horario_id)) {
            schedulesMap.set(row.horario_id, {
                id: row.horario_id,
                dia_semana: row.dia_semana,
                hora_inicio: row.hora_inicio,
                hora_fin: row.hora_fin,
                tipo: row.horario_tipo,
                actividad_nombre: row.actividad_nombre,
                lugar_nombre: row.lugar_nombre,
                profesor_nombre: row.profesor_nombre,
                practicantes: []
            });
            reportData.push(schedulesMap.get(row.horario_id));
        }

        if (row.practicante_id) {
            schedulesMap.get(row.horario_id).practicantes.push({
                id: row.practicante_id,
                nombre: row.practicante_nombre
            });
        }
    });

    res.json({ data: reportData });
}));

/**
 * GET /api/informes/abonos-estado
 * Reporte de abonos activos y vencidos con semáforo visual
 */
router.get('/abonos-estado', asyncHandler(async (req, res) => {
    const { lugar_id, search = '', mes, anio } = req.query;

    let sql = `
        SELECT 
            a.id,
            p.nombre_completo as practicante_nombre,
            ta.nombre as tipo_abono_nombre,
            l.nombre as lugar_nombre,
            a.fecha_inicio,
            a.fecha_vencimiento,
            a.estado as estado_db,
            a.cantidad,
            a.monto_pactado,
            (SELECT IFNULL(SUM(pg.monto), 0) FROM Pago pg WHERE pg.abono_id = a.id AND pg.deleted_at IS NULL) as total_pagado_efectivo,
            (
                SELECT IFNULL(SUM(mc.monto), 0) 
                FROM MovimientoCaja mc 
                JOIN Pago pg2 ON mc.usado_en_pago_id = pg2.id 
                WHERE pg2.abono_id = a.id AND mc.deleted_at IS NULL AND pg2.deleted_at IS NULL
            ) as total_notas_credito,
            (
                SELECT IFNULL(SUM(d.monto), 0)
                FROM Deuda d
                WHERE d.abono_id = a.id
                  AND d.estado = 'pendiente'
                  AND d.deleted_at IS NULL
            ) as saldo_deuda_explicit,
            DATEDIFF(a.fecha_vencimiento, CURDATE()) as dias_para_vencer
        FROM Abono a
        JOIN Practicante p ON a.practicante_id = p.id
        JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
        JOIN Lugar l ON a.lugar_id = l.id
        WHERE a.deleted_at IS NULL 
          AND p.deleted_at IS NULL
          AND p.activo = 1
    `;
    const params = [];

    if (mes && anio) {
        const lastDayOfMonth = new Date(anio, mes, 0).toISOString().split('T')[0];
        sql += ` AND (
            (MONTH(a.fecha_inicio) = ? AND YEAR(a.fecha_inicio) = ?)
            OR (MONTH(a.fecha_vencimiento) = ? AND YEAR(a.fecha_vencimiento) = ?)
            OR (a.fecha_vencimiento < ? AND a.estado != 'cancelado')
        )`;
        params.push(parseInt(mes, 10), parseInt(anio, 10), parseInt(mes, 10), parseInt(anio, 10), lastDayOfMonth);
    }

    // Regla de visualización: 
    // 1. Si el abono está activo y vigente hoy, se muestra.
    // 2. Si no hay ningún abono activo hoy para esa persona, se muestra solo el más reciente (el que genera la deuda).
    sql += ` AND (
        (a.estado = 'activo' AND a.fecha_vencimiento >= CURDATE())
        OR 
        (
            NOT EXISTS (
                SELECT 1 FROM Abono a2 
                WHERE a2.practicante_id = a.practicante_id 
                  AND a2.id != a.id
                  AND a2.estado = 'activo' 
                  AND a2.fecha_vencimiento >= CURDATE()
                  AND a2.deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM Abono a3
                WHERE a3.practicante_id = a.practicante_id
                  AND a3.id > a.id
                  AND a3.deleted_at IS NULL
            )
        )
    )`;

    if (lugar_id) {
        sql += ' AND (l.id = ? OR l.parent_id = ?)';
        params.push(lugar_id, lugar_id);
    }

    if (search) {
        sql += ' AND p.nombre_completo LIKE ?';
        params.push(`%${search}%`);
    }

    sql += ' ORDER BY a.fecha_vencimiento ASC';

    const [rows] = await pool.execute(sql, params);

    // Procesar semáforo en el backend para simplificar el frontend
    const data = rows.map(row => {
        let semaforo = 'verde';
        let estado_actual = 'Activo';

        if (row.estado_db === 'vencido' || row.estado_db === 'cancelado' || row.dias_para_vencer < 0) {
            semaforo = 'rojo';
            estado_actual = row.estado_db === 'cancelado' ? 'Cancelado' : 'Vencido';
        } else if (row.dias_para_vencer <= 7) {
            semaforo = 'amarillo';
            estado_actual = 'Próximo a vencer';
        }

        return {
            ...row,
            semaforo,
            estado_actual,
            total_pagado: parseFloat(row.total_pagado_efectivo || 0) + parseFloat(row.total_notas_credito || 0),
            saldo_pendiente: parseFloat(row.saldo_deuda_explicit || 0)
        };
    });

    res.json({ data });
}));

/**
 * GET /api/informes/ganancia-actividad
 * Reporte de ingresos discriminados por actividad (Tai Chi, Chi Kung/Yoga, Libre)
 */
router.get('/ganancia-actividad', asyncHandler(async (req, res) => {
    const { mes, anio, lugar_id } = req.query;
    if (!mes || !anio) throw new AppError('Mes y año son obligatorios', 400);

    // 1. Get all payments using the shared service (UNIFIED LOGIC)
    const allPagos = await PagoService.getAllPayments({
        mes: parseInt(mes, 10),
        anio: parseInt(anio, 10),
        lugar_id: lugar_id ? parseInt(lugar_id, 10) : undefined,
        filter_by_mes_abono: false // Cash flow mode for consistency
    });

    // Clasificación por actividad
    const resumen = {
        tai_chi: { nombre: 'Tai Chi Chuan', total: 0, pagos: 0, horas_grupales: 0, horas_flexibles: 0, costo_salon_grupal: 0, costo_salon_flexible: 0, detalles: [] },
        chi_kung_yoga: { nombre: 'Chi Kung y Yoga Suave', total: 0, pagos: 0, horas_grupales: 0, horas_flexibles: 0, costo_salon_grupal: 0, costo_salon_flexible: 0, detalles: [] },
        libre: { nombre: 'Libre / Combinado', total: 0, pagos: 0, horas_grupales: 0, horas_flexibles: 0, costo_salon_grupal: 0, costo_salon_flexible: 0, detalles: [] },
        otros: { nombre: 'Otras Actividades', total: 0, pagos: 0, horas_grupales: 0, horas_flexibles: 0, costo_salon_grupal: 0, costo_salon_flexible: 0, detalles: [] },
        generales: { nombre: 'Cuotas y Gastos Generales', total: 0, pagos: 0, horas_grupales: 0, horas_flexibles: 0, costo_salon_grupal: 0, costo_salon_flexible: 0, detalles: [] },
        totalNCApplied: 0 // New field to track saved cash via NCs
    };

    // Procesar todos los movimientos (Ingresos y Egresos)
    allPagos.forEach(p => {
        // Skip Credit Notes (virtual movements) to match Balance liquidity
        if (p.metodo_pago === 'nota_credito') return;
        
        const montoCash = Math.abs(parseFloat(p.monto));
        const montoOriginal = Math.abs(parseFloat(p.monto_original));
        const ncApplied = Math.max(0, montoOriginal - montoCash);
        
        const nombreAbono = (p.tipo_abono_nombre || 'S/D').toLowerCase();
        const nombreActividad = (p.actividad_nombre || 'S/D').toLowerCase();
        const categoria = p.categoria; // 'grupal', 'particular', 'compartida'
        
        const item = { 
            nombre: p.tipo_abono_nombre || (p.pago_tipo === 'ingreso' ? 'Ingreso Varios' : 'Egreso Varios'), 
            total: p.pago_tipo === 'ingreso' ? montoCash : -montoOriginal, 
            pagos: 1,
            categoria: categoria,
            nc_aplicada: ncApplied
        };

        let actKey = 'generales';

        if (p.pago_tipo === 'ingreso') {
            if (categoria) {
                // Subscription incomes
                if (categoria !== 'grupal') actKey = 'otros';
                else if (nombreAbono.includes('libre') || nombreAbono.includes('combinado')) actKey = 'libre';
                else if (nombreAbono.includes('tai chi') || nombreAbono.includes('taichi')) actKey = 'tai_chi';
                else if (nombreAbono.includes('chi kung') || nombreAbono.includes('chikung') || nombreAbono.includes('yoga') || nombreAbono.includes('suave')) actKey = 'chi_kung_yoga';
                else actKey = 'otros';
                resumen[actKey].pagos += 1;
            } else if (nombreAbono.includes('cuota social') || nombreAbono.includes('recepción')) {
                actKey = 'generales';
            } else {
                actKey = 'generales';
            }
            resumen[actKey].total += montoCash;
            resumen[actKey].detalles.push(item);

        } else if (p.pago_tipo === 'egreso') {
            if (p.tipo_abono_nombre === 'Costo de Espacio') {
                // Salon Cost expenses - Attribute to activity using p.actividad_nombre
                
                // If it's NOT grupal, it must go to 'otros' (Otras Actividades / Particulares)
                if (categoria && categoria !== 'grupal') {
                    actKey = 'otros';
                } else if (nombreActividad.includes('tai chi') || nombreActividad.includes('taichi')) {
                    actKey = 'tai_chi';
                } else if (nombreActividad.includes('chi kung') || nombreActividad.includes('chikung') || nombreActividad.includes('yoga') || nombreActividad.includes('suave')) {
                    actKey = 'chi_kung_yoga';
                } else if (nombreActividad.includes('libre') || nombreActividad.includes('combinado')) {
                    actKey = 'libre';
                } else {
                    actKey = 'otros';
                }
                
                if (categoria === 'grupal' || !categoria) {
                    resumen[actKey].costo_salon_grupal += montoOriginal;
                } else {
                    resumen[actKey].costo_salon_flexible += montoOriginal;
                }
            } else {
                // Other expenses (Social fee club, sales, etc.) -> Generales
                actKey = 'generales';
                resumen[actKey].costo_salon_grupal += montoOriginal;
            }
            
            resumen.totalNCApplied += ncApplied;
            resumen[actKey].detalles.push({ ...item, nombre: `Gasto: ${item.nombre}` });
        }
    });

    // 2. Cálculo de Horas para Rentabilidad (needed for the UI ratio, not for margin calculation)
    const firstDay = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).toISOString().split('T')[0];

    let sqlHoras = `
        SELECT 
            c.tipo as clase_tipo,
            act.nombre as actividad_nombre,
            SUM(TIME_TO_SEC(TIMEDIFF(c.hora_fin, c.hora))) / 3600 as horas
        FROM Clase c
        JOIN Actividad act ON c.actividad_id = act.id
        WHERE c.deleted_at IS NULL 
          AND c.estado NOT IN ('cancelada', 'suspendida', 'sin_actividad')
          AND c.fecha >= ? AND c.fecha <= ?
    `;
    const paramsHoras = [firstDay, lastDay];
    if (lugar_id) {
        sqlHoras += ' AND (c.lugar_id = ? OR c.lugar_id IN (SELECT id FROM Lugar WHERE parent_id = ?))';
        paramsHoras.push(lugar_id, lugar_id);
    }
    sqlHoras += ' GROUP BY c.tipo, act.nombre';

    const [rowsHoras] = await pool.execute(sqlHoras, paramsHoras);
    rowsHoras.forEach(row => {
        const nombre = row.actividad_nombre.toLowerCase();
        const horas = parseFloat(row.horas || 0);
        let actKey = 'otros';

        if (row.clase_tipo === 'grupal') {
            if (nombre.includes('tai chi') || nombre.includes('taichi')) actKey = 'tai_chi';
            else if (nombre.includes('chi kung') || nombre.includes('chikung') || nombre.includes('yoga') || nombre.includes('suave')) actKey = 'chi_kung_yoga';
            else if (nombre.includes('libre') || nombre.includes('combinado')) actKey = 'libre';
            resumen[actKey].horas_grupales += horas;
        } else {
            resumen.otros.horas_flexibles += horas;
        }
    });

    // --- REDISTRIBUCIÓN PROPORCIONAL DE INGRESOS Y COSTOS "LIBRE" ---
    if (resumen.libre.total > 0 || resumen.libre.costo_salon_grupal > 0) {
        const hTC = resumen.tai_chi.horas_grupales;
        const hCKY = resumen.chi_kung_yoga.horas_grupales;
        const totalH = hTC + hCKY;

        if (totalH > 0) {
            const ratioTC = hTC / totalH;
            const ratioCKY = hCKY / totalH;
            
            const montoLibre = resumen.libre.total;
            const costoLibre = resumen.libre.costo_salon_grupal;
            const pagosLibre = resumen.libre.pagos;

            // Distribuir ingresos
            resumen.tai_chi.total += montoLibre * ratioTC;
            resumen.chi_kung_yoga.total += montoLibre * ratioCKY;

            // Distribuir costos
            resumen.tai_chi.costo_salon_grupal += costoLibre * ratioTC;
            resumen.chi_kung_yoga.costo_salon_grupal += costoLibre * ratioCKY;

            // Registrar la distribución en detalles para transparencia
            if (montoLibre > 0) {
                resumen.tai_chi.detalles.push({
                    nombre: `Ingreso Prop. Abonos Libres`,
                    total: montoLibre * ratioTC,
                    pagos: 0,
                    categoria: 'distribucion'
                });
                resumen.chi_kung_yoga.detalles.push({
                    nombre: `Ingreso Prop. Abonos Libres`,
                    total: montoLibre * ratioCKY,
                    pagos: 0,
                    categoria: 'distribucion'
                });
            }

            // Limpiar categoría Libre (ya está distribuida)
            resumen.libre.total = 0;
            resumen.libre.costo_salon_grupal = 0;
            resumen.libre.pagos = 0;
            resumen.libre.detalles = [];
        }
    }

    res.json({ data: resumen });
}));

export default router;
