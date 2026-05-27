<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Presupuesto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PresupuestoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Presupuesto::with(['practicante']);

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('cliente_nombre', 'like', "%{$search}%")
                  ->orWhereHas('practicante', function($sq) use ($search) {
                      $sq->where('nombre_completo', 'like', "%{$search}%");
                  });
            });
        }

        $presupuestos = $query->orderBy('fecha', 'desc')->get();

        return response()->json([
            'data' => $presupuestos
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'practicante_id' => 'nullable|exists:Practicante,id',
            'cliente_nombre' => 'required|string|max:255',
            'fecha' => 'required|date',
            'total' => 'required|numeric',
            'observaciones' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.descripcion' => 'required|string',
            'items.*.cantidad' => 'required|integer|min:1',
            'items.*.precio_unitario' => 'required|numeric',
            'items.*.subtotal' => 'required|numeric',
            'items.*.abono_id' => 'nullable|exists:TipoAbono,id',
        ]);

        try {
            return DB::transaction(function () use ($validated, $request) {
                $presupuesto = Presupuesto::create([
                    'practicante_id' => $validated['practicante_id'],
                    'cliente_nombre' => $validated['cliente_nombre'],
                    'fecha' => $validated['fecha'],
                    'total' => $validated['total'],
                    'observaciones' => $validated['observaciones'],
                    'usuario_id' => $request->user() ? $request->user()->id : null,
                ]);

                foreach ($validated['items'] as $item) {
                    $presupuesto->items()->create($item);
                }

                return response()->json([
                    'message' => 'Presupuesto guardado con éxito',
                    'data' => $presupuesto->load('items')
                ], 201);
            });
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al guardar el presupuesto',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $presupuesto = Presupuesto::with(['practicante', 'items.abono', 'usuario'])->find($id);

        if (!$presupuesto) {
            return response()->json(['error' => 'Presupuesto no encontrado'], 404);
        }

        return response()->json(['data' => $presupuesto]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $presupuesto = Presupuesto::find($id);

        if (!$presupuesto) {
            return response()->json(['error' => 'Presupuesto no encontrado'], 404);
        }

        $presupuesto->delete();

        return response()->json([
            'message' => 'Presupuesto eliminado con éxito'
        ]);
    }
}
