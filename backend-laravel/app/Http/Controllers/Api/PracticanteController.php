<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Practicante;
use App\Models\HistorialPracticante;
use App\Http\Requests\StorePracticanteRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PracticanteController extends Controller
{
    /**
     * Listado de practicantes con filtros y paginación.
     */
    public function index(Request $request)
    {
        $query = Practicante::query();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('nombre_completo', 'like', "%{$search}%")
                  ->orWhere('dni', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        }

        $query->orderBy('nombre_completo', 'asc');

        $limit = $request->get('limit', 50);
        $practicantes = $query->paginate($limit);

        return response()->json([
            'data' => $practicantes->items(),
            'total' => $practicantes->total(),
            'page' => $practicantes->currentPage(),
            'last_page' => $practicantes->lastPage(),
            'limit' => $limit
        ]);
    }

    /**
     * Crear un nuevo practicante.
     */
    public function store(StorePracticanteRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $practicante = Practicante::create($request->validated());

            HistorialPracticante::create([
                'practicante_id' => $practicante->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $practicante->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Practicante creado exitosamente',
                'data' => $practicante
            ], 201);
        });
    }

    /**
     * Obtener un practicante específico.
     */
    public function show($id)
    {
        $practicante = Practicante::find($id);

        if (!$practicante) {
            return response()->json(['error' => 'Practicante no encontrado'], 404);
        }

        return response()->json(['data' => $practicante]);
    }

    /**
     * Actualizar un practicante existente.
     */
    public function update(StorePracticanteRequest $request, $id)
    {
        $practicante = Practicante::find($id);

        if (!$practicante) {
            return response()->json(['error' => 'Practicante no encontrado'], 404);
        }

        $data = $request->validated();

        // VALIDACIÓN: No permitir archivar (activo = false) si tiene abono vigente
        if (isset($data['activo']) && $data['activo'] == false && $practicante->activo == true) {
            $hasActiveAbono = \App\Models\Abono::where('practicante_id', $id)
                ->where('estado', 'activo')
                ->where('fecha_vencimiento', '>=', now()->toDateString())
                ->exists();

            if ($hasActiveAbono) {
                return response()->json([
                    'error' => 'No se puede archivar al practicante porque tiene un abono vigente. Debe anular o esperar al vencimiento del abono primero.'
                ], 400);
            }
        }

        return DB::transaction(function () use ($request, $practicante, $data) {
            $oldData = $practicante->toArray();
            $practicante->update($data);

            HistorialPracticante::create([
                'practicante_id' => $practicante->id,
                'accion' => 'UPDATE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => $practicante->fresh()->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Practicante actualizado exitosamente',
                'data' => $practicante
            ]);
        });
    }

    /**
     * Eliminar (Soft Delete) un practicante.
     */
    public function destroy($id)
    {
        $practicante = Practicante::find($id);

        if (!$practicante) {
            return response()->json(['error' => 'Practicante no encontrado'], 404);
        }

        // VALIDACIÓN: No permitir eliminar si tiene abono vigente
        $hasActiveAbono = \App\Models\Abono::where('practicante_id', $id)
            ->where('estado', 'activo')
            ->where('fecha_vencimiento', '>=', now()->toDateString())
            ->exists();

        if ($hasActiveAbono) {
            return response()->json([
                'error' => 'No se puede eliminar al practicante porque tiene un abono vigente. Anule el abono o espere a que venza antes de dar de baja al practicante.'
            ], 400);
        }

        return DB::transaction(function () use ($practicante) {
            $oldData = $practicante->toArray();
            $practicante->delete();

            HistorialPracticante::create([
                'practicante_id' => $practicante->id,
                'accion' => 'DELETE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => null,
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Practicante eliminado exitosamente (Soft Delete)'
            ]);
        });
    }
}
