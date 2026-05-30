<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lugar;
use App\Models\HistorialLugar;
use App\Http\Requests\StoreLugarRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LugarController extends Controller
{
    public function index()
    {
        // Traemos los lugares con la información de su padre
        return response()->json(['data' => Lugar::with('parent')->get()]);
    }

    public function store(StoreLugarRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $lugar = Lugar::create($request->validated());

            HistorialLugar::create([
                'lugar_id' => $lugar->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $lugar->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Lugar creado exitosamente',
                'data' => $lugar
            ], 201);
        });
    }

    public function show($id)
    {
        // Traemos el lugar con sus sub-lugares (children)
        $lugar = Lugar::with(['parent', 'children'])->find($id);
        if (!$lugar) {
            return response()->json(['error' => 'Lugar no encontrado'], 404);
        }
        return response()->json(['data' => $lugar]);
    }

    public function update(StoreLugarRequest $request, $id)
    {
        $lugar = Lugar::find($id);
        if (!$lugar) {
            return response()->json(['error' => 'Lugar no encontrado'], 404);
        }

        return DB::transaction(function () use ($request, $lugar) {
            $oldData = $lugar->toArray();
            $lugar->update($request->validated());

            HistorialLugar::create([
                'lugar_id' => $lugar->id,
                'accion' => 'UPDATE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => $lugar->fresh()->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Lugar actualizado exitosamente',
                'data' => $lugar
            ]);
        });
    }

    public function destroy($id)
    {
        $lugar = Lugar::find($id);
        if (!$lugar) {
            return response()->json(['error' => 'Lugar no encontrado'], 404);
        }

        // 1. Verificar si tiene sub-lugares activos
        $subLugaresCount = $lugar->children()->count();
        if ($subLugaresCount > 0) {
            return response()->json([
                'error' => "No se puede eliminar la sede porque tiene {$subLugaresCount} sub-lugar(es) o sala(s) vinculadas. Elimine primero los sub-lugares."
            ], 400);
        }

        // 2. Verificar Horarios Activos
        $horariosActivosCount = \App\Models\Horario::where('lugar_id', $id)
            ->where('activo', true)
            ->count();
        
        if ($horariosActivosCount > 0) {
            return response()->json([
                'error' => "No se puede eliminar la sede porque tiene {$horariosActivosCount} horario(s) activo(s). Desactive o mueva los horarios primero."
            ], 400);
        }

        // 3. Verificar Tipos de Abono vinculados directamente
        $tiposAbonoActivosCount = \App\Models\TipoAbono::where('lugar_id', $id)
            ->where('activo', true)
            ->count();
            
        if ($tiposAbonoActivosCount > 0) {
            return response()->json([
                'error' => "No se puede eliminar la sede porque existen tipos de abono activos configurados para este lugar."
            ], 400);
        }

        // 4. Verificar Socios Activos (miembros del club en esa sede)
        $sociosCount = \App\Models\Socio::where('lugar_id', $id)->count();
        if ($sociosCount > 0) {
            return response()->json([
                'error' => "No se puede eliminar la sede porque tiene {$sociosCount} socio(s) registrados. Debe darlos de baja o moverlos de sede primero."
            ], 400);
        }

        return DB::transaction(function () use ($lugar) {
            $oldData = $lugar->toArray();
            $lugar->delete();

            HistorialLugar::create([
                'lugar_id' => $lugar->id,
                'accion' => 'DELETE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => null,
                'usuario_id' => auth()->id()
            ]);

            return response()->json(['message' => 'Lugar eliminado exitosamente']);
        });
    }
}
