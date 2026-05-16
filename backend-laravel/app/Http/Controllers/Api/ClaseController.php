<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Clase;
use App\Http\Requests\StoreClaseRequest;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ClaseController extends Controller
{
    public function index(Request $request)
    {
        $query = Clase::with(['actividad', 'lugar', 'profesor', 'horario']);

        // Filtro por rango de fechas (soporta ambos formatos)
        $fechaInicio = $request->get('fecha_inicio') ?: $request->get('start_date');
        $fechaFin = $request->get('fecha_fin') ?: $request->get('end_date');

        if ($fechaInicio && $fechaFin) {
            $query->whereBetween('fecha', [$fechaInicio, $fechaFin]);
        } elseif ($request->has('fecha')) {
            $query->where('fecha', $request->fecha);
        }

        // Filtro por lugar o actividad
        if ($request->has('lugar_id')) {
            $query->where('lugar_id', $request->lugar_id);
        }
        if ($request->has('actividad_id')) {
            $query->where('actividad_id', $request->actividad_id);
        }

        return response()->json([
            'data' => $query->orderBy('fecha', 'desc')->orderBy('hora', 'asc')->get()
        ]);
    }

    public function store(StoreClaseRequest $request)
    {
        $clase = Clase::create($request->validated());
        return response()->json([
            'message' => 'Clase programada exitosamente', 
            'data' => $clase->load(['actividad', 'lugar'])
        ], 201);
    }

    public function show($id)
    {
        $clase = Clase::with(['actividad', 'lugar', 'profesor', 'asistencias.practicante'])->find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);
        return response()->json(['data' => $clase]);
    }

    public function update(StoreClaseRequest $request, $id)
    {
        $clase = Clase::find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);
        
        $clase->update($request->validated());
        return response()->json([
            'message' => 'Clase actualizada', 
            'data' => $clase
        ]);
    }

    public function destroy($id)
    {
        $clase = Clase::find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);
        $clase->delete();
        return response()->json(['message' => 'Clase eliminada']);
    }

    public function generar(Request $request)
    {
        return response()->json(['message' => 'Funcionalidad de generación de clases en migración', 'data' => []], 501);
    }

    public function practicantes($id)
    {
        return response()->json(['message' => 'Funcionalidad de listado de practicantes en migración', 'data' => []], 501);
    }
}
