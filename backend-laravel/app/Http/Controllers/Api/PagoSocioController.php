<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PagoSocio;
use App\Models\Socio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PagoSocioController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = PagoSocio::with(['socio.practicante', 'socio.lugar']);

        if ($request->has('socio_id')) {
            $query->where('socio_id', $request->socio_id);
        }

        $pagos = $query->orderByRaw('fecha_pago IS NULL DESC')
                       ->orderBy('fecha_pago', 'desc')
                       ->orderBy('id', 'desc')
                       ->get();

        return response()->json(['data' => $pagos]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'socio_id' => 'required|exists:Socio,id',
            'monto' => 'required|numeric|min:0',
            'fecha_pago' => 'nullable|date',
            'mes_abono' => 'required|string',
            'fecha_vencimiento' => 'nullable|date',
            'observaciones' => 'nullable|string',
            'estado_desconocido' => 'boolean',
            'pagado_directo' => 'boolean'
        ]);

        // Duplication Check
        $exists = PagoSocio::where('socio_id', $validated['socio_id'])
            ->where('mes_abono', $validated['mes_abono'])
            ->exists();
        
        if ($exists) {
            return response()->json(['error' => "Ya existe un pago registrado para {$validated['mes_abono']} para este socio."], 400);
        }

        $socio = Socio::findOrFail($validated['socio_id']);
        $esProfesor = (bool) $socio->practicante?->es_profesor;

        // Restriction: Students MUST use the Pago API (storeSocialFee) for cash registration
        if (!$esProfesor && !($validated['pagado_directo'] ?? false) && !($validated['estado_desconocido'] ?? false)) {
            return response()->json(['error' => 'Los cobros a alumnos deben registrarse desde la sección de Practicantes para impactar en caja.'], 403);
        }

        return DB::transaction(function () use ($validated, $socio) {
            $validated['usuario_id'] = auth()->id();
            $pagoSocio = PagoSocio::create($validated);

            // Registrar Historial
            HistorialPagoSocio::create([
                'pago_socio_id' => $pagoSocio->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $pagoSocio->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Pago de cuota registrado exitosamente',
                'data' => $pagoSocio->load(['socio.practicante', 'socio.lugar'])
            ], 201);
        });
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $pagoSocio = PagoSocio::with(['socio.practicante', 'socio.lugar'])->find($id);
        if (!$pagoSocio) return response()->json(['error' => 'Pago no encontrado'], 404);
        return response()->json(['data' => $pagoSocio]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $pagoSocio = PagoSocio::find($id);
        if (!$pagoSocio) return response()->json(['error' => 'Pago no encontrado'], 404);

        return DB::transaction(function () use ($request, $pagoSocio) {
            $validated = $request->validate([
                'monto' => 'sometimes|required|numeric|min:0',
                'fecha_pago' => 'nullable|date',
                'mes_abono' => 'sometimes|required|string',
                'fecha_vencimiento' => 'nullable|date',
                'observaciones' => 'nullable|string',
                'estado_desconocido' => 'boolean',
                'pagado_directo' => 'boolean'
            ]);

            $oldData = $pagoSocio->toArray();
            $pagoSocio->update($validated);

            // Registrar Historial
            HistorialPagoSocio::create([
                'pago_socio_id' => $pagoSocio->id,
                'accion' => 'UPDATE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => $pagoSocio->fresh()->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Pago de cuota actualizado',
                'data' => $pagoSocio->load(['socio.practicante', 'socio.lugar'])
            ]);
        });
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $pagoSocio = PagoSocio::find($id);
        if (!$pagoSocio) return response()->json(['error' => 'Pago no encontrado'], 404);
        
        $pagoSocio->delete();
        return response()->json(['message' => 'Pago de cuota eliminado exitosamente']);
    }
}
