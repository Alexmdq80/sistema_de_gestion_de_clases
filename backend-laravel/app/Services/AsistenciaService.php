<?php

namespace App\Services;

use App\Models\Horario;
use App\Models\Clase;
use App\Models\Asistencia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AsistenciaService
{
    /**
     * Genera instancias de Clase para un rango de fechas basado en los Horarios activos.
     */
    public function generarClasesDesdeHorarios($startDate, $endDate, $userId)
    {
        $horarios = Horario::where('activo', true)->get();
        
        $start = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);
        $clasesGeneradas = [];

        // Obtener clases existentes en ese rango para evitar duplicados
        $clasesExistentes = Clase::whereBetween('fecha', [$startDate, $endDate])->get();
        
        $existenteMap = [];
        $slotOcupadoMap = [];

        foreach ($clasesExistentes as $c) {
            $fechaStr = $c->fecha->toDateString();

            // 1. Mapa por ID de horario (para clases automáticas)
            if ($c->horario_id) {
                $existenteMap["{$c->horario_id}_{$fechaStr}"] = true;
            }

            // 2. Mapa por slot físico (para evitar duplicados con clases manuales)
            $horaHHMM = substr($c->hora, 0, 5);
            $slotOcupadoMap["{$fechaStr}_{$c->lugar_id}_{$c->actividad_id}_{$horaHHMM}"] = true;
        }

        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $diaSemana = $d->dayOfWeek; // 0 (Domingo) a 6 (Sábado) en Carbon
            
            // Ajustar día de semana si es necesario (en Node d.getDay() es 0=Dom, 6=Sab)
            // Carbon dayOfWeek es 0=Dom, 1=Lun, ..., 6=Sab. Coinciden.
            
            $fechaStr = $d->toDateString();
            $horariosDelDia = $horarios->filter(function($h) use ($diaSemana) {
                return $h->dia_semana == $diaSemana;
            });

            foreach ($horariosDelDia as $h) {
                $scheduleKey = "{$h->id}_{$fechaStr}";
                $horaHHMM = substr($h->hora_inicio, 0, 5);
                $slotKey = "{$fechaStr}_{$h->lugar_id}_{$h->actividad_id}_{$horaHHMM}";

                if (!isset($existenteMap[$scheduleKey]) && !isset($slotOcupadoMap[$slotKey])) {
                    $nuevaClase = Clase::create([
                        'horario_id' => $h->id,
                        'tipo' => $h->tipo,
                        'actividad_id' => $h->actividad_id,
                        'lugar_id' => $h->lugar_id,
                        'profesor_id' => $h->profesor_id,
                        'fecha' => $fechaStr,
                        'hora' => $h->hora_inicio,
                        'hora_fin' => $h->hora_fin,
                        'usuario_id' => $userId,
                        'estado' => 'programada',
                        'observaciones' => 'Generada automáticamente desde horario semanal'
                    ]);
                    $clasesGeneradas[] = $nuevaClase;
                    
                    $existenteMap[$scheduleKey] = true;
                    $slotOcupadoMap[$slotKey] = true;
                }
            }
        }

        return $clasesGeneradas;
    }

    /**
     * Obtiene los practicantes elegibles para una clase (con abono activo).
     */
    public function getEligiblePracticantes($clase)
    {
        $fechaClase = $clase->fecha->toDateString();
        $horarioId = $clase->horario_id ?: 0;

        $sql = "
            SELECT 
                p.id, 
                p.nombre_completo, 
                COALESCE(GROUP_CONCAT(DISTINCT ta.nombre SEPARATOR ', '), 'Sin Abono Activo') as abono_nombre,
                IF(ih.id IS NOT NULL, 1, 0) as es_inscripto
            FROM Practicante p
            LEFT JOIN Abono ab ON p.id = ab.practicante_id 
                AND ab.estado = 'activo' 
                AND ab.deleted_at IS NULL
                AND ab.fecha_inicio <= ?
                AND ab.fecha_vencimiento >= ?
            LEFT JOIN TipoAbono ta ON ab.tipo_abono_id = ta.id
            LEFT JOIN InscripcionHorario ih ON p.id = ih.practicante_id 
                AND ih.horario_id = ? 
                AND ih.activo = 1
            WHERE p.deleted_at IS NULL AND p.es_profesor = 0 AND p.activo = 1
            GROUP BY p.id, p.nombre_completo, ih.id
            ORDER BY es_inscripto DESC, p.nombre_completo ASC
        ";

        return DB::select($sql, [$fechaClase, $fechaClase, $horarioId]);
    }
}
