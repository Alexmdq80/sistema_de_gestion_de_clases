<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Horario;
use App\Models\InscripcionHorario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HorarioController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Horario::with(['actividad', 'lugar', 'profesor']);

        if ($request->has('actividad_id')) {
            $query->where('actividad_id', $request->actividad_id);
        }
        if ($request->has('lugar_id')) {
            $query->where('lugar_id', $request->lugar_id);
        }
        if ($request->has('dia_semana')) {
            $query->where('dia_semana', $request->dia_semana);
        }
        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        }
        if ($request->has('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        return response()->json([
            'data' => $query->get()
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'actividad_id' => 'required|exists:Actividad,id',
            'lugar_id' => 'required|exists:Lugar,id',
            'dia_semana' => 'required|integer|between:0,6',
            'hora_inicio' => 'required',
            'hora_fin' => 'required',
            'tipo' => 'required|string',
            'profesor_id' => 'nullable|exists:User,id',
            'activo' => 'boolean'
        ]);

        $horario = Horario::create($validated);

        return response()->json([
            'data' => $horario->load(['actividad', 'lugar', 'profesor'])
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $horario = Horario::with(['actividad', 'lugar', 'profesor'])->find($id);
        if (!$horario) return response()->json(['error' => 'Horario no encontrado'], 404);
        return response()->json(['data' => $horario]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $horario = Horario::find($id);
        if (!$horario) return response()->json(['error' => 'Horario no encontrado'], 404);

        $validated = $request->validate([
            'actividad_id' => 'sometimes|required|exists:Actividad,id',
            'lugar_id' => 'sometimes|required|exists:Lugar,id',
            'dia_semana' => 'sometimes|required|integer|between:0,6',
            'hora_inicio' => 'sometimes|required',
            'hora_fin' => 'sometimes|required',
            'tipo' => 'sometimes|required|string',
            'profesor_id' => 'nullable|exists:User,id',
            'activo' => 'boolean'
        ]);

        $horario->update($validated);

        return response()->json([
            'data' => $horario->load(['actividad', 'lugar', 'profesor'])
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $horario = Horario::find($id);
        if (!$horario) return response()->json(['error' => 'Horario no encontrado'], 404);
        $horario->delete();
        return response()->json(['message' => 'Horario eliminado con éxito']);
    }

    /**
     * GET /api/horarios/practicante/{id}
     */
    public function getByPracticante($id)
    {
        $inscripciones = InscripcionHorario::with(['horario.actividad', 'horario.lugar'])
            ->where('practicante_id', $id)
            ->where('activo', true)
            ->get();

        return response()->json([
            'data' => $inscripciones->map(function($ih) {
                return [
                    'id' => $ih->id,
                    'practicante_id' => $ih->practicante_id,
                    'horario_id' => $ih->horario_id,
                    'fecha_inscripcion' => $ih->fecha_inscripcion,
                    'activo' => $ih->activo,
                    'dia_semana' => $ih->horario->dia_semana,
                    'hora_inicio' => $ih->horario->hora_inicio,
                    'hora_fin' => $ih->horario->hora_fin,
                    'actividad_nombre' => $ih->horario->actividad->nombre,
                    'lugar_nombre' => $ih->horario->lugar->nombre,
                ];
            })
        ]);
    }

    /**
     * POST /api/horarios/practicante/{id}
     */
    public function updateByPracticante(Request $request, $id)
    {
        $request->validate([
            'horarioIds' => 'array',
            'horarioIds.*' => 'exists:Horario,id'
        ]);

        $horarioIds = $request->get('horarioIds', []);

        try {
            DB::transaction(function() use ($id, $horarioIds) {
                // Eliminar inscripciones actuales (o marcarlas inactivas)
                // Para consistencia con Node: DELETE
                InscripcionHorario::where('practicante_id', $id)->delete();

                // Insertar nuevas
                $today = now()->toDateString();
                foreach ($horarioIds as $hId) {
                    InscripcionHorario::create([
                        'practicante_id' => $id,
                        'horario_id' => $hId,
                        'fecha_inscripcion' => $today,
                        'activo' => true
                    ]);
                }
            });

            return response()->json(['message' => 'Inscripciones actualizadas con éxito']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error al actualizar inscripciones', 'details' => $e->getMessage()], 500);
        }
    }
}
