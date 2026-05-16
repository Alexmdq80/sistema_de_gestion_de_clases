<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Practicante;
use App\Http\Requests\StorePracticanteRequest;
use Illuminate\Http\Request;

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
        $practicante = Practicante::create($request->validated());

        return response()->json([
            'message' => 'Practicante creado exitosamente',
            'data' => $practicante
        ], 201);
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

        $practicante->update($request->validated());

        return response()->json([
            'message' => 'Practicante actualizado exitosamente',
            'data' => $practicante
        ]);
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

        $practicante->delete();

        return response()->json([
            'message' => 'Practicante eliminado exitosamente (Soft Delete)'
        ]);
    }
}
