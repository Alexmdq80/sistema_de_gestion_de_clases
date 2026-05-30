<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Socio;
use App\Models\Practicante;
use App\Models\Horario;
use App\Http\Requests\StoreSocioRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class SocioController extends Controller
{
    public function candidates()
    {
        $sql = "
            SELECT DISTINCT p.id as practicante_id, p.nombre_completo, p.es_profesor,
                   COALESCE(l.parent_id, l.id) as real_lugar_id,
                   COALESCE(lp.nombre, l.nombre) as real_lugar_nombre,
                   COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                   COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Practicante p
            -- Case 1: Active Abonos
            LEFT JOIN Abono a ON p.id = a.practicante_id AND a.estado = 'activo' AND a.fecha_vencimiento >= CURDATE() AND a.deleted_at IS NULL
            LEFT JOIN TipoAbono ta ON a.tipo_abono_id = ta.id
            -- Link Abono to Lugar either directly or via Horarios
            LEFT JOIN TipoAbono_Horario tah ON ta.id = tah.tipo_abono_id
            LEFT JOIN Horario ah ON tah.horario_id = ah.id

            -- Case 2: Professors teaching at locations
            LEFT JOIN Horario ph ON p.id = ph.profesor_id AND ph.deleted_at IS NULL AND ph.activo = 1

            -- Join with Lugar through either direct link, abono schedule, or teaching schedule
            JOIN Lugar l ON (
                l.id = ta.lugar_id OR
                l.id = ah.lugar_id OR
                l.id = ph.lugar_id
            )
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE p.deleted_at IS NULL
              AND (
                  (l.parent_id IS NULL AND l.cobra_cuota_social = 1) OR
                  (l.parent_id IS NOT NULL AND lp.cobra_cuota_social = 1)
              )
              AND NOT EXISTS (
                  SELECT 1 FROM Socio s
                  WHERE s.practicante_id = p.id
                    AND s.lugar_id = COALESCE(l.parent_id, l.id)
                    AND s.deleted_at IS NULL
              )
        ";

        try {
            $results = DB::select($sql);
            return response()->json(['data' => $results]);
        } catch (\Exception $e) {
            Log::error('Error fetching socio candidates: ' . $e->getMessage());
            return response()->json(['error' => 'Error al obtener candidatos a socio'], 500);
        }
    }

    public function myTeacherLugares(Request $request)
    {
        $user = $request->user();
        $practicante = Practicante::where('user_id', $user->id)->first();

        if (!$practicante) {
            return response()->json(['data' => []]);
        }

        $sql = "
            SELECT DISTINCT
                COALESCE(l.parent_id, l.id) as id,
                COALESCE(lp.nombre, l.nombre) as nombre,
                COALESCE(lp.cuota_social_general, l.cuota_social_general) as cuota_social_general,
                COALESCE(lp.cuota_social_descuento, l.cuota_social_descuento) as cuota_social_descuento
            FROM Horario h
            JOIN Lugar l ON h.lugar_id = l.id
            LEFT JOIN Lugar lp ON l.parent_id = lp.id
            WHERE h.profesor_id = ? AND h.deleted_at IS NULL AND h.activo = 1
        ";

        try {
            $results = DB::select($sql, [$practicante->id]);
            return response()->json(['data' => $results]);
        } catch (\Exception $e) {
            Log::error('Error fetching teacher locations: ' . $e->getMessage());
            return response()->json(['error' => 'Error al obtener sedes del profesor'], 500);
        }
    }

    public function teacherAlerts(Request $request)
    {
        $user = $request->user();
        $practicante = Practicante::where('user_id', $user->id)->first();

        if (!$practicante) {
            return response()->json([
                'missingRegistration' => [],
                'expiredPayments' => [],
                'soonToExpire' => []
            ]);
        }

        $practicanteId = $practicante->id;

        // Identificar sedes requeridas (desde Horarios)
        $lugares = Horario::where('profesor_id', $practicanteId)
            ->where('activo', true)
            ->with(['lugar.parent'])
            ->get()
            ->map(function ($h) {
                $l = $h->lugar;
                if (!$l) return null;
                // Si es un sub-lugar, usamos el padre (sede principal)
                return $l->parent_id ? $l->parent : $l;
            })
            ->filter(function($l) {
                // Solo nos interesan lugares que cobran cuota social
                return $l && $l->cobra_cuota_social;
            })
            ->unique('id')
            ->values();

        $alerts = [
            'missingRegistration' => [],
            'expiredPayments' => [],
            'soonToExpire' => []
        ];

        foreach ($lugares as $lugar) {
            $socio = Socio::where('practicante_id', $practicanteId)
                ->where('lugar_id', $lugar->id)
                ->first();

            if (!$socio) {
                $alerts['missingRegistration'][] = $lugar;
                continue;
            }

            $latestPayment = $socio->pagos()
                ->orderBy('fecha_vencimiento', 'desc')
                ->first();

            if (!$latestPayment) {
                $alerts['expiredPayments'][] = array_merge($lugar->toArray(), ['reason' => 'Sin pagos registrados']);
            } else {
                $vencimiento = \Carbon\Carbon::parse($latestPayment->fecha_vencimiento);
                $today = \Carbon\Carbon::today();
                $nextWeek = \Carbon\Carbon::today()->addDays(7);

                if ($vencimiento->lt($today)) {
                    $alerts['expiredPayments'][] = array_merge($lugar->toArray(), ['vencimiento' => $latestPayment->fecha_vencimiento]);
                } elseif ($vencimiento->lte($nextWeek)) {
                    $alerts['soonToExpire'][] = array_merge($lugar->toArray(), ['vencimiento' => $latestPayment->fecha_vencimiento]);
                }
            }
        }

        return response()->json(['data' => $alerts]);
    }

    public function index(Request $request)
    {
        $query = Socio::with(['practicante', 'lugar']);

        if ($request->has('lugar_id')) {
            $query->where('lugar_id', $request->lugar_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('practicante', function($q) use ($search) {
                $q->where('nombre_completo', 'like', "%{$search}%");
            });
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(StoreSocioRequest $request)
    {
        $socio = Socio::create($request->validated());
        return response()->json([
            'message' => 'Socio registrado exitosamente',
            'data' => $socio->load(['practicante', 'lugar'])
        ], 201);
    }

    public function show($id)
    {
        $socio = Socio::with(['practicante', 'lugar', 'pagos'])->find($id);
        if (!$socio) return response()->json(['error' => 'Socio no encontrado'], 404);
        return response()->json(['data' => $socio]);
    }

    public function update(StoreSocioRequest $request, $id)
    {
        $socio = Socio::find($id);
        if (!$socio) return response()->json(['error' => 'Socio no encontrado'], 404);
        
        $socio->update($request->validated());
        return response()->json(['message' => 'Datos de socio actualizados', 'data' => $socio]);
    }

    public function destroy($id)
    {
        $socio = Socio::find($id);
        if (!$socio) return response()->json(['error' => 'Socio no encontrado'], 404);

        return DB::transaction(function () use ($socio) {
            $oldData = $socio->toArray();
            $socio->delete();

            // Registrar Historial
            HistorialSocio::create([
                'socio_id' => $socio->id,
                'accion' => 'DELETE',
                'datos_anteriores' => $oldData,
                'datos_nuevos' => null,
                'usuario_id' => auth()->id()
            ]);

            return response()->json(['message' => 'Socio eliminado']);
        });
    }
}
> 'Socio eliminado']);
    }
}
