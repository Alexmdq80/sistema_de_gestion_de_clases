<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pago;
use App\Models\MovimientoCaja;
use App\Http\Requests\StorePagoRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PagoController extends Controller
{
    public function index(Request $request)
    {
        $query = Pago::with(['practicante', 'lugar']);

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('fecha', [$request->start_date, $request->end_date]);
        }

        return response()->json(['data' => $query->orderBy('fecha', 'desc')->get()]);
    }

    public function store(StorePagoRequest $request)
    {
        return DB::transaction(function () use ($request) {
            // 1. Crear el Registro de Pago
            $pago = Pago::create($request->validated());

            // 2. Crear automáticamente el Movimiento de Caja (Ingreso)
            MovimientoCaja::create([
                'tipo' => 'ingreso',
                'monto' => $pago->monto,
                'categoria' => 'Abono/Clase',
                'descripcion' => "Cobro de abono - {$pago->mes_abono}. " . ($pago->notas ?? ''),
                'fecha' => $pago->fecha,
                'lugar_id' => $pago->lugar_id,
                'practicante_id' => $pago->practicante_id,
                'usuario_id' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Pago y movimiento de caja registrados correctamente',
                'data' => $pago
            ], 201);
        });
    }

    public function destroy($id)
    {
        return DB::transaction(function () use ($id) {
            $pago = Pago::find($id);
            if (!$pago) return response()->json(['error' => 'Pago no encontrado'], 404);

            // Nota: Aquí deberíamos decidir si anulamos también el movimiento de caja
            // Por ahora hacemos soft delete del pago
            $pago->delete();

            return response()->json(['message' => 'Pago anulado exitosamente']);
        });
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

            MovimientoCaja::create([
                'tipo' => 'ingreso',
                'monto' => $pago->monto,
                'categoria' => 'Abono/Clase',
                'descripcion' => "Pago parcial abono - {$pago->mes_abono}. " . ($pago->notas ?? ''),
                'fecha' => $pago->fecha,
                'lugar_id' => $pago->lugar_id,
                'practicante_id' => $pago->practicante_id,
                'usuario_id' => auth()->id(),
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

            MovimientoCaja::create([
                'tipo' => 'ingreso',
                'monto' => $pago->monto,
                'categoria' => 'Cuota Social',
                'descripcion' => "Cobro cuota social - {$pago->mes_abono}. " . ($pago->notas ?? ''),
                'fecha' => $pago->fecha,
                'lugar_id' => $pago->lugar_id,
                'practicante_id' => $pago->practicante_id,
                'usuario_id' => auth()->id(),
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

        $pago->update($validated);

        return response()->json([
            'message' => 'Pago actualizado exitosamente',
            'data' => $pago
        ]);
    }
}
