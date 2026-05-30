<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Actividad;
use App\Models\HistorialActividad;
use App\Http\Requests\StoreActividadRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActividadController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Actividad::all()]);
    }

    public function store(StoreActividadRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $actividad = Actividad::create($request->validated());

            HistorialActividad::create([
                'actividad_id' => $actividad->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $actividad->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Actividad creada exitosamente',
                'data' => $actividad
            ], 201);
        });
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

        return DB::transaction(function () use ($request, $actividad) {
            $oldData = $actividad->toArray();
            $actividad->update($request->validated());

            HistorialActividad::create([
                'actividad_id' => $actividad->id,
                'accion' => 'UPDATE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => $actividad->fresh()->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Actividad actualizada exitosamente',
                'data' => $actividad
            ]);
        });
    }

    public function destroy($id)
    {
        $actividad = Actividad::find($id);
        if (!$actividad) {
            return response()->json(['error' => 'Actividad no encontrada'], 404);
        }

        // 1. Verificar Horarios Activos
        $horariosActivosCount = \App\Models\Horario::where('actividad_id', $id)
            ->where('activo', true)
            ->count();
        
        if ($horariosActivosCount > 0) {
            return response()->json([
                'error' => "No se puede eliminar la actividad porque tiene {$horariosActivosCount} horario(s) activo(s) en la grilla semanal. Por favor, desactive o modifique los horarios primero."
            ], 400);
        }

        // 2. Verificar Tipos de Abono Activos
        $tiposAbonoActivosCount = \App\Models\TipoAbono::whereHas('horarios', function($q) use ($id) {
            $q->where('actividad_id', $id)->where('activo', true);
        })->orWhere(function($q) use ($id) {
            // Nota: En este modelo, la actividad se deduce principalmente via Horarios, 
            // pero si hubiera una relación directa en el futuro se validaría aquí.
        })->count();

        // Una forma más directa de validar Tipos de Abono es ver si existen tipos vinculados a esta actividad
        // que no estén eliminados (vigentes).
        $abonosRelacionados = \App\Models\TipoAbono::where('activo', true)->get()->filter(function($ta) use ($id) {
            return $ta->horarios()->where('actividad_id', $id)->exists();
        });

        if ($abonosRelacionados->count() > 0) {
            return response()->json([
                'error' => "No se puede eliminar la actividad porque está vinculada a tipos de abono activos. Revise la configuración de abonos."
            ], 400);
        }

        return DB::transaction(function () use ($actividad) {
            $oldData = $actividad->toArray();
            $actividad->delete();

            HistorialActividad::create([
                'actividad_id' => $actividad->id,
                'accion' => 'DELETE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => null,
                'usuario_id' => auth()->id()
            ]);

            return response()->json(['message' => 'Actividad eliminada exitosamente']);
        });
    }
}
