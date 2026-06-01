<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pago;
use App\Models\MovimientoCaja;
use App\Models\Practicante;
use App\Models\TipoAbono;
use App\Models\Abono;
use App\Models\HistorialAbono;
use App\Http\Requests\StorePagoRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PagoController extends Controller
{
    public function index(Request $request)
    {
        $lugarId = $request->get('lugar_id');
        $filterByMesAbono = $request->get('filter_by_mes_abono') === 'true';
        $mes = $request->get('mes');
        $anio = $request->get('anio');
        $fechaInicio = $request->get('fecha_inicio') ?: $request->get('start_date');
        $fechaFin = $request->get('fecha_fin') ?: $request->get('end_date');

        // 1. Incomes (Student payments)
        $queryIncomes = Pago::with(['practicante', 'lugar', 'abono.tipoAbono']);

        if ($filterByMesAbono && $mes && $anio) {
            $monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            $mesNombre = $monthNames[$mes - 1];
            $queryIncomes->where('mes_abono', 'LIKE', "%{$mesNombre}%{$anio}%");
        } elseif ($fechaInicio && $fechaFin) {
            $queryIncomes->whereBetween('fecha', [$fechaInicio, $fechaFin]);
        }

        if ($lugarId && $lugarId !== 'all') {
            $queryIncomes->where(function($q) use ($lugarId) {
                $q->where('lugar_id', $lugarId)
                  ->orWhereHas('lugar', fn($sq) => $sq->where('parent_id', $lugarId));
            });
        }

        $incomes = $queryIncomes->orderBy('fecha', 'desc')->get();

        // 2. Expenses (Pago Cuota Social al Club - from PagoSocio)
        $queryExpenses = \App\Models\PagoSocio::with(['socio.practicante', 'socio.lugar']);

        if ($filterByMesAbono && $mes && $anio) {
            $monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            $mesNombre = $monthNames[$mes - 1];
            $queryExpenses->where('mes_abono', 'LIKE', "%{$mesNombre}%{$anio}%");
        } elseif ($fechaInicio && $fechaFin) {
            $queryExpenses->whereBetween('fecha_pago', [$fechaInicio, $fechaFin]);
        } else {
            // If no filters, PagoSocio should only be returned if it has a payment date
            $queryExpenses->whereNotNull('fecha_pago');
        }

        if ($lugarId && $lugarId !== 'all') {
            $queryExpenses->whereHas('socio', function($q) use ($lugarId) {
                $q->where('lugar_id', $lugarId)
                  ->orWhereHas('lugar', fn($sq) => $sq->where('parent_id', $lugarId));
            });
        }

        $expenses = $queryExpenses->orderBy('fecha_pago', 'desc')->get()->map(function($ps) {
            if (!$ps->socio || !$ps->socio->practicante || !$ps->socio->lugar) {
                return null;
            }
            return [
                'id' => $ps->id * -1000, // Matching Node's logic for virtual IDs
                'practicante_id' => $ps->socio->practicante_id,
                'pago_socio_id' => $ps->id,
                'mes_abono' => $ps->mes_abono,
                'lugar_id' => $ps->socio->lugar_id,
                'fecha' => $ps->fecha_pago,
                'monto' => $ps->monto * -1,
                'metodo_pago' => 'efectivo',
                'notas' => "Pago Cuota Social al Club: " . ($ps->observaciones ?? ''),
                'pago_tipo' => 'egreso',
                'tipo_abono_nombre' => 'Egreso Cuota Social (Club)',
                'categoria' => null,
                'practicante_nombre' => $ps->socio->practicante->nombre_completo,
                'lugar_nombre' => $ps->socio->lugar->nombre,
            ];
        })->filter();

        // 3. Other movements (MovimientoCaja)
        $queryCaja = MovimientoCaja::with(['practicante', 'lugar']);
        if ($fechaInicio && $fechaFin) {
            $queryCaja->whereBetween('fecha', [$fechaInicio, $fechaFin]);
        }
        if ($lugarId && $lugarId !== 'all') {
            $queryCaja->where(function($q) use ($lugarId) {
                $q->where('lugar_id', $lugarId)
                  ->orWhereHas('lugar', fn($sq) => $sq->where('parent_id', $lugarId));
            });
        }

        $otherMovements = $queryCaja->orderBy('fecha', 'desc')->get()->map(function($m) {
            return [
                'id' => $m->id * -5000,
                'practicante_id' => $m->practicante_id,
                'pago_socio_id' => null,
                'mes_abono' => null, // Opcional: calcular mes/año como en Node
                'lugar_id' => $m->lugar_id,
                'fecha' => $m->fecha->toDateString(),
                'monto' => $m->tipo === 'egreso' ? $m->monto * -1 : $m->monto,
                'metodo_pago' => $m->categoria === 'Nota de Crédito' ? 'nota_credito' : 'efectivo',
                'notas' => $m->descripcion,
                'pago_tipo' => $m->tipo,
                'tipo_abono_nombre' => $m->categoria,
                'categoria' => null,
                'practicante_nombre' => $m->practicante ? $m->practicante->nombre_completo : 'Global',
                'lugar_nombre' => $m->lugar ? $m->lugar->nombre : 'N/A',
            ];
        });

        // Merge and return
        $data = $incomes->concat($expenses)->concat($otherMovements)->sortByDesc('fecha')->values();

        return response()->json(['data' => $data]);
    }

    public function store(StorePagoRequest $request)
    {
        return DB::transaction(function () use ($request) {
            // 1. Crear el Registro de Pago
            $pago = Pago::create($request->validated());

            return response()->json([
                'message' => 'Pago registrado correctamente',
                'data' => $pago
            ], 201);
        });
    }

    public function destroy($id)
    {
        return DB::transaction(function () use ($id) {
            $pago = Pago::find($id);
            if (!$pago) return response()->json(['error' => 'Pago no encontrado'], 404);

            $userId = auth()->id();

            // 1. Soft delete del pago
            $pago->delete();

            // 1b. Liberar notas de crédito asociadas
            MovimientoCaja::where('usado_en_pago_id', $pago->id)->update(['usado_en_pago_id' => null]);

            // 2. Si está vinculado a un Abono, marcar abono como cancelado
            if ($pago->abono_id) {
                $abono = Abono::find($pago->abono_id);
                if ($abono) {
                    $oldAbono = $abono->toArray();
                    $abono->update(['estado' => 'cancelado']);
                    
                    // Registrar historial
                    HistorialAbono::create([
                        'abono_id' => $abono->id,
                        'accion' => 'UPDATE',
                        'datos_anteriores' => $oldAbono,
                        'datos_nuevos' => $abono->fresh()->toArray(),
                        'usuario_id' => $userId
                    ]);
                }
            }

            // 3. Si está vinculado a un PagoSocio, eliminarlo también
            if ($pago->pago_socio_id) {
                $pagoSocio = \App\Models\PagoSocio::find($pago->pago_socio_id);
                if ($pagoSocio) {
                    $pagoSocio->delete();
                }
            }

            return response()->json(['message' => 'Pago anulado exitosamente']);
        });
    }

    /**
     * Alias para eliminar pago desde la ruta de practicantes.
     */
    public function destroyFromPracticante($practicanteId, $pagoId)
    {
        // Validamos que el pago pertenezca al practicante
        $pago = Pago::where('id', $pagoId)->where('practicante_id', $practicanteId)->first();
        if (!$pago) return response()->json(['error' => 'Pago no encontrado para este practicante'], 404);

        return $this->destroy($pagoId);
    }

    /**
     * Obtener todos los pagos de un practicante específico.
     */
    public function getByPracticante($id)
    {
        $pagos = Pago::with(['abono.tipoAbono', 'lugar'])
            ->where('practicante_id', $id)
            ->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json(['data' => $pagos]);
    }

    /**
     * Registrar un pago de abono desde la ficha del practicante.
     */
    public function storePracticantePago(Request $request, $id)
    {
        $request->validate([
            'tipo_abono_id' => 'required|exists:TipoAbono,id',
            'monto' => 'required|numeric|min:0',
            'monto_pactado' => 'nullable|numeric|min:0',
            'metodo_pago' => 'required|string',
            'cantidad' => 'integer|min:1',
            'fecha_pago' => 'nullable|date',
            'fecha_vencimiento' => 'nullable|date',
            'mes_abono' => 'nullable|string',
            'lugar_id' => 'nullable|exists:Lugar,id',
            'notas' => 'nullable|string',
            'nota_credito_id' => 'nullable|exists:MovimientoCaja,id',
            'nota_credito_ids' => 'nullable|array',
            'nota_credito_ids.*' => 'exists:MovimientoCaja,id'
        ]);

        return DB::transaction(function () use ($request, $id) {
            $practicante = Practicante::findOrFail($id);
            $tipoAbono = TipoAbono::findOrFail($request->tipo_abono_id);
            $userId = auth()->id();

            $today = Carbon::now();
            $fechaPago = $request->fecha_pago ?: $today->toDateString();
            $cantidad = $request->cantidad ?: 1;

            // 1. Determinar fecha de inicio
            $activeAbono = Abono::findActiveByPracticanteId($id);
            $fechaInicio = $today->copy();

            $isFlexible = in_array($tipoAbono->categoria, ['particular', 'compartida']);

            if (!$isFlexible && $activeAbono && Carbon::parse($activeAbono->fecha_vencimiento)->gte($today)) {
                $fechaInicio = Carbon::parse($activeAbono->fecha_vencimiento)->addDay();
            }

            // 2. Calcular fecha de vencimiento
            if ($request->fecha_vencimiento) {
                $fechaVencimiento = Carbon::parse($request->fecha_vencimiento);
            } else {
                $duracion = $tipoAbono->duracion_dias !== null ? $tipoAbono->duracion_dias : 0;
                $totalDuracion = $duracion * $cantidad;
                $fechaVencimiento = $fechaInicio->copy()->addDays($totalDuracion);
            }

            // Seguridad: fechaVencimiento >= fechaInicio
            if ($fechaVencimiento->lt($fechaInicio)) {
                $fechaInicio = $fechaVencimiento->copy();
            }

            // 3. Crear Abono
            $abono = Abono::create([
                'practicante_id' => $id,
                'tipo_abono_id' => $request->tipo_abono_id,
                'fecha_inicio' => $fechaInicio->toDateString(),
                'fecha_vencimiento' => $fechaVencimiento->toDateString(),
                'mes_abono' => $request->mes_abono,
                'lugar_id' => $request->lugar_id ?: $tipoAbono->lugar_id,
                'estado' => 'activo',
                'cantidad' => $cantidad,
                'monto_pactado' => $request->monto_pactado ?? ($tipoAbono->precio * $cantidad)
            ]);

            // Registrar historial del Abono
            HistorialAbono::create([
                'abono_id' => $abono->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $abono->toArray(),
                'usuario_id' => $userId
            ]);

            // 4. Crear Pago
            $pago = Pago::create([
                'practicante_id' => $id,
                'abono_id' => $abono->id,
                'mes_abono' => $abono->mes_abono,
                'lugar_id' => $abono->lugar_id,
                'fecha' => $fechaPago,
                'monto' => $request->monto,
                'metodo_pago' => $request->metodo_pago,
                'notas' => $request->notas
            ]);

            // 5. Aplicar Notas de Crédito si existen
            $notaIds = $request->nota_credito_ids ?: ($request->nota_credito_id ? [$request->nota_credito_id] : []);
            
            if (count($notaIds) > 0) {
                // Determine how much NC value we should actually consume
                $targetTotal = $request->monto_pactado ?? ($tipoAbono->precio * $cantidad);
                $remainingToCover = max(0, $targetTotal - (float)$request->monto);

                foreach ($notaIds as $ncId) {
                    $nc = MovimientoCaja::where('id', $ncId)
                        ->where('practicante_id', $id)
                        ->whereNull('usado_en_pago_id')
                        ->whereNull('usado_en_clase_id')
                        ->first();

                    if ($nc) {
                        if ($nc->monto <= $remainingToCover + 0.01) {
                            // Use full NC
                            $nc->update(['usado_en_pago_id' => $pago->id]);
                            $remainingToCover -= $nc->monto;
                        } else {
                            // Split NC: Use only what's needed
                            $amountToUse = $remainingToCover;
                            $remainder = $nc->monto - $amountToUse;
                            $oldMonto = $nc->monto;

                            // 1. Update original to the amount used and mark as used
                            $nc->update([
                                'monto' => $amountToUse,
                                'usado_en_pago_id' => $pago->id,
                                'descripcion' => ($nc->descripcion ?: '') . " (Uso parcial de $" . number_format($oldMonto, 2) . ")"
                            ]);

                            // 2. Create new NC for the remainder
                            MovimientoCaja::create([
                                'tipo' => $nc->tipo,
                                'monto' => $remainder,
                                'categoria' => $nc->categoria,
                                'descripcion' => "Saldo restante de NC #{$nc->id} (Original: $" . number_format($oldMonto, 2) . ")",
                                'fecha' => $nc->fecha,
                                'lugar_id' => $nc->lugar_id,
                                'practicante_id' => $nc->practicante_id,
                                'usuario_id' => $userId
                            ]);

                            $remainingToCover = 0;
                        }
                    }

                    if ($remainingToCover <= 0) break;
                }
            }

            return response()->json([
                'message' => 'Pago registrado correctamente',
                'data' => $pago
            ], 201);
        });
    }

    /**
     * Obtener el balance de un abono específico (monto pactado vs pagado).
     */
    public function abonoBalance($id)
    {
        $abono = \App\Models\Abono::find($id);
        if (!$abono) return response()->json(['error' => 'Abono no encontrado'], 404);

        $totalPagado = Pago::where('abono_id', $id)
            ->whereNull('deleted_at')
            ->sum('monto');

        return response()->json([
            'data' => [
                'monto_pactado' => (float)$abono->monto_pactado,
                'estado' => $abono->estado,
                'total_pagado' => (float)$totalPagado,
                'saldo_pendiente' => (float)($abono->monto_pactado - $totalPagado)
            ]
        ]);
    }

    /**
     * Registrar un pago parcial para un abono existente.
     */
    public function storePartial(Request $request)
    {
        $request->validate([
            'abono_id' => 'required|exists:Abono,id',
            'monto' => 'required|numeric|min:0',
            'metodo_pago' => 'required|string',
            'fecha_pago' => 'nullable|date',
            'notas' => 'nullable|string'
        ]);

        return DB::transaction(function () use ($request) {
            $abono = \App\Models\Abono::findOrFail($request->abono_id);
            $fecha = $request->fecha_pago ?: now()->toDateString();
            
            // Determinar mes de abono basado en la fecha
            $meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            $carbonFecha = \Carbon\Carbon::parse($fecha);
            $mesAbono = $meses[$carbonFecha->month - 1] . " " . $carbonFecha->year;

            $pago = Pago::create([
                'practicante_id' => $abono->practicante_id,
                'abono_id' => $abono->id,
                'lugar_id' => $abono->lugar_id,
                'monto' => $request->monto,
                'metodo_pago' => $request->metodo_pago,
                'fecha' => $fecha,
                'mes_abono' => $mesAbono,
                'notas' => $request->notas
            ]);

            return response()->json(['data' => $pago], 201);
        });
    }

    /**
     * Registrar un pago de cuota social únicamente.
     */
    public function storeSocialFee(Request $request)
    {
        $request->validate([
            'practicante_id' => 'required|exists:Practicante,id',
            'lugar_id' => 'required|exists:Lugar,id',
            'monto' => 'required|numeric|min:0',
            'fecha_pago' => 'required|date',
            'metodo_pago' => 'required|string',
            'mes_abono' => 'nullable|string',
            'observaciones' => 'nullable|string'
        ]);

        return DB::transaction(function () use ($request) {
            $pago = Pago::create([
                'practicante_id' => $request->practicante_id,
                'lugar_id' => $request->lugar_id,
                'monto' => $request->monto,
                'fecha' => $request->fecha_pago,
                'metodo_pago' => $request->metodo_pago,
                'mes_abono' => $request->mes_abono,
                'notas' => $request->observaciones,
                'abono_id' => null
            ]);

            // Registrar Historial Pago
            HistorialPago::create([
                'pago_id' => $pago->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $pago->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json(['data' => $pago], 201);
        });
    }

    public function update(Request $request, $id)
    {
        $pago = Pago::find($id);
        if (!$pago) return response()->json(['error' => 'Pago no encontrado'], 404);

        $validated = $request->validate([
            'monto' => 'sometimes|required|numeric|min:0',
            'metodo_pago' => 'sometimes|required|string',
            'fecha' => 'sometimes|required|date',
            'mes_abono' => 'sometimes|required|string',
            'notas' => 'nullable|string',
            'lugar_id' => 'sometimes|required|exists:Lugar,id'
        ]);

        $oldData = $pago->toArray();
        $pago->update($validated);

        // Registrar Historial Pago
        HistorialPago::create([
            'pago_id' => $pago->id,
            'accion' => 'UPDATE',
            'datos_anteriores' => $oldData,
            'datos_nuevos' => $pago->fresh()->toArray(),
            'usuario_id' => auth()->id()
        ]);

        return response()->json([
            'message' => 'Pago actualizado exitosamente',
            'data' => $pago
        ]);
    }
}
