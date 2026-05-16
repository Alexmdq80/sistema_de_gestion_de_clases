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
            ->select('nombre_completo', 'fecha_nacimiento')
            ->whereMonth('fecha_nacimiento', $mes)
            ->whereNull('deleted_at');

        return response()->json(['data' => $query->orderByRaw('DAY(fecha_nacimiento)')->get()]);
    }
}
