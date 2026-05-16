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

        return response()->json($query->orderBy('fecha', 'desc')->get());
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
}
