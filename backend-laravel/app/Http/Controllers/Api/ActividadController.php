<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Actividad;
use App\Http\Requests\StoreActividadRequest;
use Illuminate\Http\Request;

class ActividadController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Actividad::all()]);
    }

    public function store(StoreActividadRequest $request)
    {
        $actividad = Actividad::create($request->validated());
        return response()->json([
            'message' => 'Actividad creada exitosamente',
            'data' => $actividad
        ], 201);
    }

    public function show($id)
    {
        $actividad = Actividad::find($id);
        if (!$actividad) {
            return response()->json(['error' => 'Actividad no encontrada'], 404);
        }
        return response()->json(['data' => $actividad]);
    }

    public function update(StoreActividadRequest $request, $id)
    {
        $actividad = Actividad::find($id);
        if (!$actividad) {
            return response()->json(['error' => 'Actividad no encontrada'], 404);
        }
        $actividad->update($request->validated());
        return response()->json([
            'message' => 'Actividad actualizada exitosamente',
            'data' => $actividad
        ]);
    }

    public function destroy($id)
    {
        $actividad = Actividad::find($id);
        if (!$actividad) {
            return response()->json(['error' => 'Actividad no encontrada'], 404);
        }
        $actividad->delete();
        return response()->json(['message' => 'Actividad eliminada exitosamente']);
    }
}
