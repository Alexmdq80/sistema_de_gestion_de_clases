<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Socio;
use App\Models\PagoSocio;
use App\Models\Pago;
use App\Models\Clase;
use App\Models\MovimientoCaja;
use App\Models\Practicante;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class InformeController extends Controller
{
    /**
     * Reporte de Padrón Detallado de Socios.
     * Determina quién pagó la cuota, quién reingresó, etc.
     */
    public function padronSocios(Request $request)
    {
        $request->validate([
            'mes' => 'required|integer|between:1,12',
            'anio' => 'required|integer',
        ]);

        $mes = $request->mes;
        $anio = $request->anio;
        $lugar_id = $request->lugar_id;

        $monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        $mesAbono = "{$monthNames[$mes - 1]} {$anio}";

        // Fecha umbral para practicantes archivados (2 meses)
        $thresholdDate = Carbon::create($anio, $mes, 1)->subMonths(2);

        $query = Socio::query()
            ->join('Practicante', 'Socio.practicante_id', '=', 'Practicante.id')
            ->join('Lugar', 'Socio.lugar_id', '=', 'Lugar.id')
            ->leftJoin('PagoSocio', function($join) use ($mesAbono) {
                $join->on('PagoSocio.socio_id', '=', 'Socio.id')
                     ->where('PagoSocio.mes_abono', '=', $mesAbono)
                     ->whereNull('PagoSocio.deleted_at');
            })
            ->select([
                'Socio.id as sistema_id',
                'Socio.numero_socio',
                'Practicante.nombre_completo',
                'Practicante.dni',
                'Practicante.activo',
                'Practicante.archivado_at',
                'Practicante.reingreso_at',
                'Practicante.created_at',
                'Lugar.nombre as sede_nombre',
                'PagoSocio.mes_abono',
                'PagoSocio.monto',
                'PagoSocio.fecha_pago',
                'PagoSocio.estado_desconocido',
                DB::raw("CASE 
                    WHEN PagoSocio.id IS NULL THEN 'Pendiente'
                    WHEN PagoSocio.estado_desconocido = 1 THEN 'Relación Directa'
                    WHEN PagoSocio.monto >= Lugar.cuota_social_general OR PagoSocio.monto >= Lugar.cuota_social_descuento THEN 'Completa'
                    ELSE 'Parcial'
                END as tipo_pago")
            ])
            ->whereNull('Socio.deleted_at')
            ->where(function($q) use ($thresholdDate) {
                $q->where('Practicante.activo', 1)
                  ->orWhere('Practicante.archivado_at', '>=', $thresholdDate);
            });

        if ($lugar_id) {
            $query->where(function($q) use ($lugar_id) {
                $q->where('Lugar.id', $lugar_id)
                  ->orWhere('Lugar.parent_id', $lugar_id);
            });
        }

        return response()->json(['data' => $query->orderBy('Lugar.nombre')->orderBy('Practicante.nombre_completo')->get()]);
    }

    /**
     * Balance Mensual.
     * Calcula ingresos, egresos y rentabilidad.
     */
    public function balanceMensual(Request $request)
    {
        $request->validate([
            'mes' => 'required|integer|between:1,12',
            'anio' => 'required|integer',
        ]);

        $mes = $request->mes;
        $anio = $request->anio;
        $lugar_id = $request->lugar_id;

        $firstDay = Carbon::create($anio, $mes, 1)->startOfDay();
        $lastDay = Carbon::create($anio, $mes, 1)->endOfMonth()->endOfDay();

        // 1. Ingresos y Egresos de Caja
        $movimientos = MovimientoCaja::whereBetween('fecha', [$firstDay, $lastDay])
            ->when($lugar_id, function($q) use ($lugar_id) {
                $q->where('lugar_id', $lugar_id);
            })
            ->select('tipo', DB::raw('SUM(monto) as total'))
            ->groupBy('tipo')
            ->get();

        $otrosIngresos = $movimientos->where('tipo', 'ingreso')->first()->total ?? 0;
        $otrosEgresos = $movimientos->where('tipo', 'egreso')->first()->total ?? 0;

        // 2. Horas dictadas para rentabilidad
        $totalHoras = Clase::whereBetween('fecha', [$firstDay, $lastDay])
            ->whereNotIn('estado', ['cancelada', 'suspendida', 'sin_actividad'])
            ->when($lugar_id, function($q) use ($lugar_id) {
                $q->where('lugar_id', $lugar_id);
            })
            ->select(DB::raw('SUM(TIME_TO_SEC(TIMEDIFF(hora_fin, hora))) / 3600 as horas'))
            ->first()->horas ?? 0;

        $totalIngresos = $otrosIngresos;
        $totalEgresos = $otrosEgresos;
        $balanceNeto = $totalIngresos - $totalEgresos;
        $gananciaPorHora = $totalHoras > 0 ? $balanceNeto / $totalHoras : 0;

        return response()->json([
            'data' => [
                'periodo' => Carbon::create($anio, $mes, 1)->locale('es')->monthName . " " . $anio,
                'totalIngresos' => (float)$totalIngresos,
                'totalEgresos' => (float)$totalEgresos,
                'balanceNeto' => (float)$balanceNeto,
                'totalHoras' => (float)$totalHoras,
                'gananciaPorHora' => (float)$gananciaPorHora
            ]
        ]);
    }

    /**
     * Reporte de Cumpleaños.
     */
    public function cumpleanos(Request $request)
    {
        $mes = $request->mes ?? Carbon::now()->month;
        $lugar_id = $request->lugar_id;

        $query = Practicante::query()
            ->select('Practicante.nombre_completo', 'Practicante.fecha_nacimiento', 'Practicante.cumple_dia', 'Practicante.cumple_mes')
            ->where(function($q) use ($mes) {
                $q->whereMonth('fecha_nacimiento', $mes)
                  ->orWhere('cumple_mes', $mes);
            })
            ->whereNull('Practicante.deleted_at')
            ->when($lugar_id, function($q) use ($lugar_id) {
                $q->join('Socio', 'Socio.practicante_id', '=', 'Practicante.id')
                  ->where('Socio.lugar_id', $lugar_id)
                  ->whereNull('Socio.deleted_at');
            });

        return response()->json([
            'data' => $query->orderByRaw('COALESCE(cumple_dia, DAY(fecha_nacimiento))')->get()
        ]);
    }

    /**
     * Reporte de inscripciones por horario.
     */
    public function inscripcionesHorarios(Request $request)
    {
        $lugar_id = $request->lugar_id;

        $horarios = \App\Models\Horario::with(['actividad', 'lugar', 'profesor'])
            ->where('activo', 1)
            ->where('tipo', 'grupal')
            ->when($lugar_id, function($q) use ($lugar_id) {
                $q->where(function($sq) use ($lugar_id) {
                    $sq->where('lugar_id', $lugar_id)
                       ->orWhereHas('lugar', function($l) use ($lugar_id) {
                           $l->where('parent_id', $lugar_id);
                       });
                });
            })
            ->orderBy('dia_semana')
            ->orderBy('hora_inicio')
            ->get();

        $reportData = $horarios->map(function($h) {
            $inscripciones = \App\Models\InscripcionHorario::where('horario_id', $h->id)
                ->where('activo', 1)
                ->whereNull('fecha_hasta')
                ->whereNull('deleted_at')
                ->with('practicante')
                ->get();

            return [
                'id' => $h->id,
                'dia_semana' => $h->dia_semana,
                'hora_inicio' => $h->hora_inicio,
                'hora_fin' => $h->hora_fin,
                'tipo' => $h->tipo,
                'actividad_nombre' => $h->actividad->nombre,
                'lugar_nombre' => $h->lugar->nombre,
                'profesor_nombre' => $h->profesor?->nombre_completo,
                'practicantes' => $inscripciones->filter(function($i) {
                    return $i->practicante && $i->practicante->activo && is_null($i->practicante->deleted_at);
                })->map(function($i) {
                    return [
                        'id' => $i->practicante->id,
                        'nombre' => $i->practicante->nombre_completo,
                    ];
                })->values()
            ];
        });

        return response()->json(['data' => $reportData]);
    }

    /**
     * Reporte de Estado de Abonos (Activos y Vencidos).
     * Sincronizado con la lógica de Node.js.
     */
    public function abonosEstado(Request $request)
    {
        $mes = $request->mes;
        $anio = $request->anio;
        $lugar_id = $request->lugar_id;
        $search = $request->search;

        $lastDayOfMonth = null;
        if ($mes && $anio) {
            $lastDayOfMonth = Carbon::create($anio, $mes, 1)->endOfMonth()->toDateString();
        }

        $query = \App\Models\Abono::query()
            ->join('Practicante', 'Abono.practicante_id', '=', 'Practicante.id')
            ->join('TipoAbono', 'Abono.tipo_abono_id', '=', 'TipoAbono.id')
            ->join('Lugar', 'Abono.lugar_id', '=', 'Lugar.id')
            ->select([
                'Abono.id',
                'Practicante.nombre_completo as practicante_nombre',
                'TipoAbono.nombre as tipo_abono_nombre',
                'Lugar.nombre as lugar_nombre',
                'Abono.fecha_inicio',
                'Abono.fecha_vencimiento',
                'Abono.estado as estado_db',
                'Abono.cantidad',
                'Abono.monto_pactado',
                'Abono.mes_abono',
                'Abono.practicante_id',
                DB::raw('DATEDIFF(Abono.fecha_vencimiento, CURDATE()) as dias_para_vencer')
            ])
            ->whereNull('Abono.deleted_at')
            ->whereNull('Practicante.deleted_at')
            ->where('Practicante.activo', 1);

        // 1. Filtros de búsqueda y lugar
        if ($search) {
            $query->where('Practicante.nombre_completo', 'LIKE', "%{$search}%");
        }

        if ($lugar_id) {
            $query->where(function($q) use ($lugar_id) {
                $q->where('Lugar.id', $lugar_id)
                  ->orWhere('Lugar.parent_id', $lugar_id);
            });
        }

        // 2. Filtros de Fecha (Mes/Año + Deudas)
        if ($mes && $anio) {
            $query->where(function($q) use ($mes, $anio, $lastDayOfMonth) {
                $q->where(function($sq) use ($mes, $anio) {
                    $sq->whereMonth('Abono.fecha_inicio', $mes)
                       ->whereYear('Abono.fecha_inicio', $anio);
                })
                ->orWhere(function($sq) use ($mes, $anio) {
                    $sq->whereMonth('Abono.fecha_vencimiento', $mes)
                       ->whereYear('Abono.fecha_vencimiento', $anio);
                })
                ->orWhere(function($sq) use ($lastDayOfMonth) {
                    $sq->where('Abono.fecha_vencimiento', '<', $lastDayOfMonth)
                       ->where('Abono.estado', '!=', 'cancelado');
                });
            });
        }

        // 3. Regla de visualización: Ocultar viejos si hay uno nuevo activo
        $query->where(function($q) {
            $q->where(function($sq) {
                $sq->where('Abono.estado', 'activo')
                   ->where('Abono.fecha_vencimiento', '>=', now()->toDateString());
            })
            ->orWhere(function($sq) {
                // No tiene ningún abono activo vigente
                $sq->whereNotExists(function($sub) {
                    $sub->select(DB::raw(1))
                        ->from('Abono as a2')
                        ->whereRaw('a2.practicante_id = Abono.practicante_id')
                        ->whereRaw('a2.id != Abono.id')
                        ->where('a2.estado', 'activo')
                        ->where('a2.fecha_vencimiento', '>=', now()->toDateString())
                        ->whereNull('a2.deleted_at');
                })
                // Y es el abono más reciente (el que genera la deuda)
                ->whereNotExists(function($sub) {
                    $sub->select(DB::raw(1))
                        ->from('Abono as a3')
                        ->whereRaw('a3.practicante_id = Abono.practicante_id')
                        ->whereRaw('a3.id > Abono.id')
                        ->whereNull('a3.deleted_at');
                });
            });
        });

        $rows = $query->orderBy('Abono.fecha_vencimiento', 'ASC')->get();

        $data = $rows->map(function($row) {
            $semaforo = 'verde';
            $estado_actual = 'Activo';

            if ($row->estado_db === 'vencido' || $row->estado_db === 'cancelado' || $row->dias_para_vencer < 0) {
                $semaforo = 'rojo';
                $estado_actual = $row->estado_db === 'cancelado' ? 'Cancelado' : 'Vencido';
            } elseif ($row->dias_para_vencer <= 7) {
                $semaforo = 'amarillo';
                $estado_actual = 'Próximo a vencer';
            }

            // Obtener saldo de deuda explícita (sincronizado con Node.js)
            $saldoDeuda = \App\Models\Deuda::where('practicante_id', $row->practicante_id)
                ->where('estado', 'pendiente')
                ->whereNull('deleted_at')
                ->where(function($q) use ($row) {
                    if ($row->mes_abono) {
                        $q->where('concepto', 'LIKE', "%{$row->mes_abono}%");
                    }
                    $q->orWhere('concepto', 'LIKE', '%abono%');
                })
                ->sum('monto');

            return [
                'id' => $row->id,
                'practicante_nombre' => $row->practicante_nombre,
                'tipo_abono_nombre' => $row->tipo_abono_nombre,
                'lugar_nombre' => $row->lugar_nombre,
                'fecha_inicio' => $row->fecha_inicio->toDateString(),
                'fecha_vencimiento' => $row->fecha_vencimiento->toDateString(),
                'estado_db' => $row->estado_db,
                'cantidad' => $row->cantidad,
                'monto_pactado' => (float)$row->monto_pactado,
                'dias_para_vencer' => $row->dias_para_vencer,
                'semaforo' => $semaforo,
                'estado_actual' => $estado_actual,
                'saldo_pendiente' => (float)$saldoDeuda
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * Reporte de Ganancia por Actividad.
     * Discrimina ingresos por Tai Chi, Chi Kung/Yoga, Libre.
     */
    public function gananciaActividad(Request $request)
    {
        $request->validate([
            'mes' => 'required|integer|between:1,12',
            'anio' => 'required|integer',
        ]);

        $mes = $request->mes;
        $anio = $request->anio;
        $lugar_id = $request->lugar_id;

        $query = Pago::query()
            ->join('Abono', 'Pago.abono_id', '=', 'Abono.id')
            ->join('TipoAbono', 'Abono.tipo_abono_id', '=', 'TipoAbono.id')
            ->leftJoin('Lugar', 'Pago.lugar_id', '=', 'Lugar.id')
            ->select([
                'TipoAbono.nombre as tipo_abono_nombre',
                'TipoAbono.categoria as tipo_abono_categoria',
                DB::raw('SUM(Pago.monto) as total_recaudado'),
                DB::raw('COUNT(Pago.id) as cantidad_pagos')
            ])
            ->whereNull('Pago.deleted_at')
            ->whereMonth('Pago.fecha', $mes)
            ->whereYear('Pago.fecha', $anio);

        if ($lugar_id) {
            $query->where(function($q) use ($lugar_id) {
                $q->where('Pago.lugar_id', $lugar_id)
                  ->orWhere('Lugar.parent_id', $lugar_id);
            });
        }

        $rows = $query->groupBy('TipoAbono.nombre', 'TipoAbono.categoria')->get();

        // --- NUEVA LÓGICA DE COSTOS POR ACTIVIDAD ---
        $firstDay = Carbon::create($anio, $mes, 1)->startOfDay();
        $lastDay = Carbon::create($anio, $mes, 1)->endOfMonth()->endOfDay();

        $clases = \App\Models\Clase::query()
            ->join('Actividad', 'Clase.actividad_id', '=', 'Actividad.id')
            ->join('Lugar', 'Clase.lugar_id', '=', 'Lugar.id')
            ->select([
                'Clase.tipo as clase_tipo',
                'Actividad.nombre as actividad_nombre',
                'Lugar.costo_tarifa',
                'Lugar.tipo_tarifa',
                DB::raw('SUM(TIME_TO_SEC(TIMEDIFF(Clase.hora_fin, Clase.hora))) / 3600 as horas')
            ])
            ->whereNull('Clase.deleted_at')
            ->whereNotIn('Clase.estado', ['cancelada', 'suspendida', 'sin_actividad'])
            ->whereBetween('Clase.fecha', [$firstDay, $lastDay])
            ->when($lugar_id, function($q) use ($lugar_id) {
                $q->where(function($sq) use ($lugar_id) {
                    $sq->where('Clase.lugar_id', $lugar_id)
                       ->orWhereHas('lugar', function($l) use ($lugar_id) {
                           $l->where('parent_id', $lugar_id);
                       });
                });
            })
            ->groupBy('Clase.tipo', 'Actividad.nombre', 'Lugar.costo_tarifa', 'Lugar.tipo_tarifa')
            ->get();

        $resumen = [
            'tai_chi' => ['nombre' => 'Tai Chi Chuan', 'total' => 0, 'pagos' => 0, 'horas_grupales' => 0, 'horas_flexibles' => 0, 'costo_salon_grupal' => 0, 'costo_salon_flexible' => 0, 'detalles' => []],
            'chi_kung_yoga' => ['nombre' => 'Chi Kung y Yoga Suave', 'total' => 0, 'pagos' => 0, 'horas_grupales' => 0, 'horas_flexibles' => 0, 'costo_salon_grupal' => 0, 'costo_salon_flexible' => 0, 'detalles' => []],
            'libre' => ['nombre' => 'Libre / Combinado', 'total' => 0, 'pagos' => 0, 'horas_grupales' => 0, 'horas_flexibles' => 0, 'costo_salon_grupal' => 0, 'costo_salon_flexible' => 0, 'detalles' => []],
            'otros' => ['nombre' => 'Otros', 'total' => 0, 'pagos' => 0, 'horas_grupales' => 0, 'horas_flexibles' => 0, 'costo_salon_grupal' => 0, 'costo_salon_flexible' => 0, 'detalles' => []],
        ];

        foreach ($rows as $row) {
            $nombre = strtolower($row->tipo_abono_nombre);
            $categoria = $row->tipo_abono_categoria;
            $monto = (float)$row->total_recaudado;
            $pagos = (int)$row->cantidad_pagos;
            $item = [
                'nombre' => $row->tipo_abono_nombre,
                'total' => $monto,
                'pagos' => $pagos,
                'categoria' => $categoria
            ];

            // Si NO es grupal, va directo a "otros"
            if ($categoria !== 'grupal') {
                $resumen['otros']['total'] += $monto;
                $resumen['otros']['pagos'] += $pagos;
                $resumen['otros']['detalles'][] = $item;
            } elseif (str_contains($nombre, 'libre') || str_contains($nombre, 'combinado')) {
                $resumen['libre']['total'] += $monto;
                $resumen['libre']['pagos'] += $pagos;
                $resumen['libre']['detalles'][] = $item;
            } elseif (str_contains($nombre, 'tai chi') || str_contains($nombre, 'taichi')) {
                $resumen['tai_chi']['total'] += $monto;
                $resumen['tai_chi']['pagos'] += $pagos;
                $resumen['tai_chi']['detalles'][] = $item;
            } elseif (str_contains($nombre, 'chi kung') || str_contains($nombre, 'chikung') || str_contains($nombre, 'yoga') || str_contains($nombre, 'suave')) {
                $resumen['chi_kung_yoga']['total'] += $monto;
                $resumen['chi_kung_yoga']['pagos'] += $pagos;
                $resumen['chi_kung_yoga']['detalles'][] = $item;
            } else {
                $resumen['otros']['total'] += $monto;
                $resumen['otros']['pagos'] += $pagos;
                $resumen['otros']['detalles'][] = $item;
            }
        }

        foreach ($clases as $clase) {
            $nombreAct = strtolower($clase->actividad_nombre);
            $horas = (float)$clase->horas;
            $costoUnitario = (float)$clase->costo_tarifa;
            $costoTotal = $clase->tipo_tarifa === 'por_hora' ? ($horas * $costoUnitario) : $costoUnitario;

            $actKey = 'otros';

            if ($clase->clase_tipo === 'grupal') {
                if (str_contains($nombreAct, 'tai chi') || str_contains($nombreAct, 'taichi')) {
                    $actKey = 'tai_chi';
                } elseif (str_contains($nombreAct, 'chi kung') || str_contains($nombreAct, 'chikung') || str_contains($nombreAct, 'yoga') || str_contains($nombreAct, 'suave')) {
                    $actKey = 'chi_kung_yoga';
                } elseif (str_contains($nombreAct, 'libre') || str_contains($nombreAct, 'combinado')) {
                    $actKey = 'libre';
                }
                
                $resumen[$actKey]['horas_grupales'] += $horas;
                $resumen[$actKey]['costo_salon_grupal'] += $costoTotal;
            } else {
                $resumen['otros']['horas_flexibles'] += $horas;
                $resumen['otros']['costo_salon_flexible'] += $costoTotal;
            }
        }

        // --- REDISTRIBUCIÓN PROPORCIONAL DE INGRESOS "LIBRE" ---
        if ($resumen['libre']['total'] > 0) {
            $hTC = $resumen['tai_chi']['horas_grupales'];
            $hCKY = $resumen['chi_kung_yoga']['horas_grupales'];
            $totalH = $hTC + $hCKY;

            if ($totalH > 0) {
                $ratioTC = $hTC / $totalH;
                $ratioCKY = $hCKY / $totalH;
                $montoLibre = $resumen['libre']['total'];
                $pagosLibre = $resumen['libre']['pagos'];

                $resumen['tai_chi']['total'] += $montoLibre * $ratioTC;
                $resumen['chi_kung_yoga']['total'] += $montoLibre * $ratioCKY;

                if ($montoLibre * $ratioTC > 0) {
                    $resumen['tai_chi']['detalles'][] = [
                        'nombre' => 'Ingreso Proporcional de Abonos Libres',
                        'total' => $montoLibre * $ratioTC,
                        'pagos' => $pagosLibre,
                        'categoria' => 'distribucion'
                    ];
                }
                if ($montoLibre * $ratioCKY > 0) {
                    $resumen['chi_kung_yoga']['detalles'][] = [
                        'nombre' => 'Ingreso Proporcional de Abonos Libres',
                        'total' => $montoLibre * $ratioCKY,
                        'pagos' => $pagosLibre,
                        'categoria' => 'distribucion'
                    ];
                }

                $resumen['libre']['total'] = 0;
                $resumen['libre']['pagos'] = 0;
                $resumen['libre']['detalles'] = [];
            }
        }

        return response()->json(['data' => $resumen]);
    }
}
