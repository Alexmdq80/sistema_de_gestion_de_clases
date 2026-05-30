<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TipoAbono;
use App\Models\HistorialTipoAbono;
use App\Http\Requests\StoreTipoAbonoRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TipoAbonoController extends Controller
{
    public function index()
    {
        return response()->json(['data' => TipoAbono::with(['lugar', 'horarios.lugar'])->get()]);
    }

    public function store(StoreTipoAbonoRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $data = $request->validated();
            
            // Lógica de categoría (Paridad con Node.js)
            $categoria = $data['categoria'] ?? 'grupal';
            $isFlexible = in_array($categoria, ['particular', 'compartida']);
            $duracionDias = $data['duracion_dias'] ?? null;
            
            // clases_por_semana es NULL si es flexible O clase única (duración 0)
            if ($isFlexible || $duracionDias === 0) {
                $data['clases_por_semana'] = null;
            }
            
            if ($categoria === 'particular') {
                $data['max_personas'] = 1;
            } elseif ($categoria === 'compartida') {
                $data['max_personas'] = $data['max_personas'] ?? 2;
            } else {
                $data['max_personas'] = null;
            }

            $tipoAbono = TipoAbono::create($data);

            if ($request->has('horarios')) {
                $tipoAbono->horarios()->sync($request->horarios);
            }

            // Registrar Historial
            HistorialTipoAbono::create([
                'tipo_abono_id' => $tipoAbono->id,
                'accion' => 'CREATE',
                'datos_anteriores' => null,
                'datos_nuevos' => $tipoAbono->fresh()->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Tipo de Abono creado exitosamente',
                'data' => $tipoAbono->load(['lugar', 'horarios.lugar'])
            ], 201);
        });
    }

    public function show($id)
    {
        $tipoAbono = TipoAbono::with(['lugar', 'horarios.lugar'])->find($id);
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
            $oldData = $tipoAbono->toArray();
            $data = $request->validated();
            
            // Lógica de categoría (Paridad con Node.js)
            $categoria = $data['categoria'] ?? $tipoAbono->categoria;
            $isFlexible = in_array($categoria, ['particular', 'compartida']);
            $duracionDias = array_key_exists('duracion_dias', $data) ? $data['duracion_dias'] : $tipoAbono->duracion_dias;
            
            if ($isFlexible || $duracionDias === 0) {
                $data['clases_por_semana'] = null;
            }
            
            if ($categoria === 'particular') {
                $data['max_personas'] = 1;
            } elseif ($categoria === 'compartida') {
                $data['max_personas'] = array_key_exists('max_personas', $data) ? $data['max_personas'] : ($tipoAbono->max_personas ?? 2);
            } else {
                $data['max_personas'] = null;
            }

            $tipoAbono->update($data);

            if ($request->has('horarios')) {
                $tipoAbono->horarios()->sync($request->horarios);
            }

            // Registrar Historial
            HistorialTipoAbono::create([
                'tipo_abono_id' => $tipoAbono->id,
                'accion' => 'UPDATE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => $tipoAbono->fresh()->toArray(),
                'usuario_id' => auth()->id()
            ]);

            return response()->json([
                'message' => 'Tipo de Abono actualizado exitosamente',
                'data' => $tipoAbono->load(['lugar', 'horarios.lugar'])
            ]);
        });
    }

    public function destroy($id)
    {
        $tipoAbono = TipoAbono::find($id);
        if (!$tipoAbono) {
            return response()->json(['error' => 'Tipo de Abono no encontrado'], 404);
        }
        
        $oldData = $tipoAbono->toArray();
        $tipoAbono->delete();

        // Registrar Historial
        HistorialTipoAbono::create([
            'tipo_abono_id' => $id,
            'accion' => 'DELETE',
            'datos_anteriores' => $oldData,
            'datos_nuevos' => null,
            'usuario_id' => auth()->id()
        ]);

        return response()->json(['message' => 'Tipo de Abono eliminado exitosamente']);
    }
}
