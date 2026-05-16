<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TipoAbono;
use App\Http\Requests\StoreTipoAbonoRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TipoAbonoController extends Controller
{
    public function index()
    {
        return response()->json(['data' => TipoAbono::with(['lugar', 'horarios'])->get()]);
    }

    public function store(StoreTipoAbonoRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $tipoAbono = TipoAbono::create($request->validated());

            if ($request->has('horarios')) {
                $tipoAbono->horarios()->sync($request->horarios);
            }

            return response()->json([
                'message' => 'Tipo de Abono creado exitosamente',
                'data' => $tipoAbono->load(['lugar', 'horarios'])
            ], 201);
        });
    }

    public function show($id)
    {
        $tipoAbono = TipoAbono::with(['lugar', 'horarios'])->find($id);
        if (!$tipoAbono) {
            return response()->json(['error' => 'Tipo de Abono no encontrado'], 404);
        }
        return response()->json(['data' => $tipoAbono]);
    }

    public function update(StoreTipoAbonoRequest $request, $id)
    {
        $tipoAbono = TipoAbono::find($id);
        if (!$tipoAbono) {
            return response()->json(['error' => 'Tipo de Abono no encontrado'], 404);
        }

        return DB::transaction(function () use ($request, $tipoAbono) {
            $tipoAbono->update($request->validated());

            if ($request->has('horarios')) {
                $tipoAbono->horarios()->sync($request->horarios);
            }

            return response()->json([
                'message' => 'Tipo de Abono actualizado exitosamente',
                'data' => $tipoAbono->load(['lugar', 'horarios'])
            ]);
        });
    }

    public function destroy($id)
    {
        $tipoAbono = TipoAbono::find($id);
        if (!$tipoAbono) {
            return response()->json(['error' => 'Tipo de Abono no encontrado'], 404);
        }
        
        $tipoAbono->delete();
        return response()->json(['message' => 'Tipo de Abono eliminado exitosamente']);
    }
}
