<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MovimientoCaja;
use Illuminate\Http\Request;

class CajaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = MovimientoCaja::with(['lugar', 'practicante']);

        if ($request->has('fecha_inicio')) {
            $query->where('fecha', '>=', $request->fecha_inicio);
        }

        if ($request->has('fecha_fin')) {
            $query->where('fecha', '<=', $request->fecha_fin);
        }

        if ($request->has('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->has('categoria')) {
            $query->where('categoria', $request->categoria);
        }

        $lugarId = $request->get('lugar_id');
        if ($lugarId && $lugarId !== 'all') {
            $query->where(function($q) use ($lugarId) {
                $q->where('lugar_id', $lugarId)
                  ->orWhereHas('lugar', fn($sq) => $sq->where('parent_id', $lugarId));
            });
        }

        $movimientos = $query->orderBy('fecha', 'desc')->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $movimientos]);
    }

    /**
     * Devuelve las notas de crédito disponibles (sin usar) para un lugar específico.
     */
    public function notasCreditoDisponibles($lugarId)
    {
        $notas = MovimientoCaja::where('categoria', 'Nota de Crédito')
            ->where('lugar_id', $lugarId)
            ->whereNull('usado_en_clase_id')
            ->get();

        return response()->json(['data' => $notas]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'tipo' => 'required|in:ingreso,egreso',
            'monto' => 'required|numeric|min:0',
            'categoria' => 'required|string',
            'fecha' => 'required|date',
            'descripcion' => 'nullable|string',
            'lugar_id' => 'nullable|exists:Lugar,id',
            'practicante_id' => 'nullable|exists:Practicante,id',
        ]);

        $validated['usuario_id'] = $request->user()->id;

        $movimiento = MovimientoCaja::create($validated);

        return response()->json([
            'message' => 'Movimiento registrado con éxito',
            'data' => $movimiento
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $movimiento = MovimientoCaja::with(['lugar', 'practicante'])->findOrFail($id);
        return response()->json(['data' => $movimiento]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $movimiento = MovimientoCaja::findOrFail($id);

        $validated = $request->validate([
            'tipo' => 'sometimes|required|in:ingreso,egreso',
            'monto' => 'sometimes|required|numeric|min:0',
            'categoria' => 'sometimes|required|string',
            'fecha' => 'sometimes|required|date',
            'descripcion' => 'nullable|string',
            'lugar_id' => 'nullable|exists:Lugar,id',
            'practicante_id' => 'nullable|exists:Practicante,id',
        ]);

        $movimiento->update($validated);

        return response()->json([
            'message' => 'Movimiento actualizado con éxito',
            'data' => $movimiento
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $movimiento = MovimientoCaja::findOrFail($id);

        if ($movimiento->usado_en_clase_id) {
            return response()->json([
                'error' => 'No se puede eliminar una Nota de Crédito que ya ha sido aplicada al pago de una clase. Primero debe anular el pago en la clase correspondiente.'
            ], 400);
        }

        $movimiento->delete();

        return response()->json([
            'message' => 'Movimiento eliminado con éxito',
            'data' => ['id' => $id]
        ]);
    }
}
