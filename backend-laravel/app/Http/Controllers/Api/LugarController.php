<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lugar;
use App\Http\Requests\StoreLugarRequest;
use Illuminate\Http\Request;

class LugarController extends Controller
{
    public function index()
    {
        // Traemos los lugares con la información de su padre
        return response()->json(['data' => Lugar::with('parent')->get()]);
    }

    public function store(StoreLugarRequest $request)
    {
        $lugar = Lugar::create($request->validated());
        return response()->json([
            'message' => 'Lugar creado exitosamente',
            'data' => $lugar
        ], 201);
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
        $lugar->update($request->validated());
        return response()->json([
            'message' => 'Lugar actualizado exitosamente',
            'data' => $lugar
        ]);
    }

    public function destroy($id)
    {
        $lugar = Lugar::find($id);
        if (!$lugar) {
            return response()->json(['error' => 'Lugar no encontrado'], 404);
        }
        $lugar->delete();
        return response()->json(['message' => 'Lugar eliminado exitosamente']);
    }
}
