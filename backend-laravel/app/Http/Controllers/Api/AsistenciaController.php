<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asistencia;
use App\Models\Clase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AsistenciaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Asistencia::with(['practicante', 'clase']);
        return response()->json(['data' => $query->get()]);
    }

    /**
     * GET /api/asistencia/practicante/{id}
     */
    public function findByPracticante(Request $request, $id)
    {
        // Esta lógica es para ver el historial de un alumno
        // Incluye clases donde está anotado o clases flexibles disponibles
        $query = Clase::with(['actividad', 'lugar'])
            ->leftJoin('Asistencia', function($join) use ($id) {
                $join->on('Clase.id', '=', 'Asistencia.clase_id')
                     ->where('Asistencia.practicante_id', '=', $id);
            })
            // Agregamos un check para ver si está inscripto en el horario de la clase
            ->leftJoin('InscripcionHorario', function($join) use ($id) {
                $join->on('Clase.horario_id', '=', 'InscripcionHorario.horario_id')
                     ->where('InscripcionHorario.practicante_id', '=', $id)
                     ->where('InscripcionHorario.activo', '=', 1);
            })
            ->select(
                'Clase.*', 
                'Asistencia.id as asistencia_id', 
                'Asistencia.asistio',
                DB::raw('IF(Asistencia.id IS NOT NULL OR InscripcionHorario.id IS NOT NULL, 1, 0) as ya_anotado')
            )
            ->whereNull('Clase.deleted_at')
            ->where(function($q) {
                $q->whereNotNull('Asistencia.id')
                  ->orWhereNotNull('InscripcionHorario.id')
                  ->orWhere(function($sq) {
                      $sq->where('Clase.tipo', 'flexible')
                         ->where('Clase.estado', 'programada');
                  });
            });

        if ($request->has('fecha_inicio')) {
            $query->where('Clase.fecha', '>=', $request->fecha_inicio);
        }
        if ($request->has('fecha_fin')) {
            $query->where('Clase.fecha', '<=', $request->fecha_fin);
        }
        if ($request->has('tipo')) {
            $query->where('Clase.tipo', $request->tipo);
        }

        // Importante: Si filtramos por InscripcionHorario, pueden salir duplicados si hay varias 
        // inscripciones (históricas vs actuales), pero el WHERE activo=1 y el LEFT JOIN deberían limitarlo.
        // Agrupamos por ID de clase para estar seguros.
        $results = $query->groupBy('Clase.id')
                        ->orderBy('Clase.fecha', 'desc')
                        ->orderBy('Clase.hora', 'desc')
                        ->get();

        return response()->json(['data' => $results]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
