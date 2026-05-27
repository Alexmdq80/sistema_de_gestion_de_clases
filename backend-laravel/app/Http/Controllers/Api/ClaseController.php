<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Clase;
use App\Models\Asistencia;
use App\Models\Deuda;
use App\Models\Lugar;
use App\Models\MovimientoCaja;
use App\Services\AsistenciaService;
use App\Http\Requests\StoreClaseRequest;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ClaseController extends Controller
{
    protected $asistenciaService;

    public function __construct(AsistenciaService $asistenciaService)
    {
        $this->asistenciaService = $asistenciaService;
    }

    public function index(Request $request)
    {
        $query = Clase::with(['actividad', 'lugar', 'profesor', 'horario']);

        // Filtro por rango de fechas (soporta ambos formatos)
        $fechaInicio = $request->get('fecha_inicio') ?: $request->get('start_date');
        $fechaFin = $request->get('fecha_fin') ?: $request->get('end_date');

        if ($fechaInicio && $fechaFin) {
            $query->whereBetween('fecha', [$fechaInicio, $fechaFin]);
        } elseif ($request->has('fecha')) {
            $query->where('fecha', $request->fecha);
        }

        // Filtro por lugar o actividad
        if ($request->has('lugar_id')) {
            $query->where('lugar_id', $request->lugar_id);
        }
        if ($request->has('actividad_id')) {
            $query->where('actividad_id', $request->actividad_id);
        }

        return response()->json([
            'data' => $query->orderBy('fecha', 'desc')->orderBy('hora', 'asc')->get()
        ]);
    }

    public function store(StoreClaseRequest $request)
    {
        $clase = Clase::create($request->validated());
        return response()->json([
            'message' => 'Clase programada exitosamente', 
            'data' => $clase->load(['actividad', 'lugar'])
        ], 201);
    }

    public function show($id)
    {
        $clase = Clase::with(['actividad', 'lugar', 'profesor', 'asistencias.practicante'])->find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);
        return response()->json(['data' => $clase]);
    }

    public function update(StoreClaseRequest $request, $id)
    {
        $clase = Clase::find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);
        
        $data = $request->validated();
        $userId = $request->user() ? $request->user()->id : null;

        // RESTRICTION: Do not allow updates to closed classes
        if ($clase->estado === 'cerrada') {
            // Check for actual changes in main fields
            $hasActualChanges = false;
            $fieldsToCheck = ['estado', 'tipo', 'actividad_id', 'lugar_id', 'fecha', 'hora', 'hora_fin', 'profesor_id'];
            
            foreach ($fieldsToCheck as $field) {
                if (isset($data[$field]) && $data[$field] != $clase->$field) {
                    $hasActualChanges = true;
                    break;
                }
            }

            if ($hasActualChanges) {
                return response()->json(['error' => 'No se pueden modificar los datos principales de una clase que ya está cerrada'], 400);
            }
        }

        // RESTRICTION: Only allow closing if it was previously 'realizada'
        if (isset($data['estado']) && $data['estado'] === 'cerrada' && $clase->estado !== 'realizada' && $clase->estado !== 'cerrada') {
            return response()->json(['error' => 'Solo se puede cerrar una clase que ya ha sido marcada como "Realizada"'], 400);
        }

        try {
            return DB::transaction(function() use ($clase, $data, $userId, $request) {
                // Logic for salon costs (debts)
                $isNewPayment = ($data['pago_espacio_realizado'] ?? false) == true && $clase->pago_espacio_realizado == false;
                $isEditingPaymentWithCharge = ($data['pago_espacio_realizado'] ?? false) == true && $request->get('cobrar_salon') == true;

                if (($isNewPayment || $isEditingPaymentWithCharge) && $request->get('cobrar_salon') && in_array($data['estado'] ?? $clase->estado, ['cancelada', 'suspendida'])) {
                    Deuda::where('clase_id', $clase->id)->delete();
                    
                    $lugar = Lugar::find($data['lugar_id'] ?? $clase->lugar_id);
                    $montoACobrar = $data['monto_pago_espacio'] ?? ($lugar ? $lugar->costo_tarifa : 0);
                    $practicantesIds = $request->get('practicantes_ids');

                    if ($montoACobrar > 0 && is_array($practicantesIds)) {
                        $montoPorPersona = $montoACobrar / count($practicantesIds);
                        foreach ($practicantesIds as $pId) {
                            $estadoClaseLabel = ($data['estado'] ?? $clase->estado) === 'cancelada' ? 'Cancelada' : 'Suspendida';
                            Deuda::create([
                                'practicante_id' => $pId,
                                'monto' => $montoPorPersona,
                                'concepto' => "Costo de Salón - Clase {$estadoClaseLabel} del {$clase->fecha->toDateString()}",
                                'fecha' => $clase->fecha,
                                'estado' => 'pendiente',
                                'clase_id' => $clase->id,
                                'usuario_id' => $userId
                            ]);
                        }
                    }
                }

                // Logic for Credit Notes (Nota de Crédito)
                $isBeingCancelledOrSuspended = in_array($data['estado'] ?? '', ['cancelada', 'suspendida', 'sin_actividad']) && 
                                             !in_array($clase->estado, ['cancelada', 'suspendida', 'sin_actividad']);
                $wasAlreadyPaid = $clase->pago_espacio_realizado || ($data['pago_espacio_realizado'] ?? false);

                if ($isBeingCancelledOrSuspended && $wasAlreadyPaid && $request->get('generar_nota_credito') == true) {
                    $montoCredito = $data['monto_nota_credito'] ?? ($clase->monto_pago_espacio ?: 0);
                    if ($montoCredito > 0) {
                        $labelEstado = ($data['estado'] == 'sin_actividad') ? 'Sin Actividad' : (($data['estado'] == 'cancelada') ? 'Cancelada' : 'Suspendida');
                        $descripcion = "Nota de Crédito por Clase {$labelEstado} del {$clase->fecha->toDateString()} ({$clase->hora})";
                        
                        MovimientoCaja::create([
                            'tipo' => 'ingreso',
                            'monto' => $montoCredito,
                            'categoria' => 'Nota de Crédito',
                            'descripcion' => $descripcion,
                            'fecha' => $clase->fecha,
                            'lugar_id' => $clase->lugar_id,
                            'clase_id' => $clase->id,
                            'usuario_id' => $userId
                        ]);
                    }
                }

                // Logic for reactivating class (delete credit note)
                $isReactivating = !in_array($data['estado'] ?? 'realizada', ['cancelada', 'suspendida', 'sin_actividad']) && 
                                 in_array($clase->estado, ['cancelada', 'suspendida', 'sin_actividad']);
                if ($isReactivating) {
                    MovimientoCaja::where('clase_id', $clase->id)->where('categoria', 'Nota de Crédito')->delete();
                }

                // Logic for unmarking payment (cancel debts and release credit note)
                if (($data['pago_espacio_realizado'] ?? true) == false && $clase->pago_espacio_realizado == true) {
                    Deuda::where('clase_id', $clase->id)->delete();
                    MovimientoCaja::where('usado_en_clase_id', $clase->id)->update(['usado_en_clase_id' => null]);
                }

                // Applying or removing credit note usage
                if (($data['pago_espacio_realizado'] ?? false) == true && $request->has('nota_credito_id')) {
                    MovimientoCaja::where('usado_en_clase_id', $clase->id)->update(['usado_en_clase_id' => null]);
                    
                    $notaId = $request->get('nota_credito_id');
                    if ($notaId) {
                        $nota = MovimientoCaja::find($notaId);
                        if ($nota) {
                            $montoNota = (float)$nota->monto;
                            $montoPago = (float)($data['monto_pago_espacio'] ?? ($clase->monto_pago_espacio ?: 0));

                            if ($montoNota > $montoPago) {
                                MovimientoCaja::create([
                                    'tipo' => 'ingreso',
                                    'monto' => $montoNota - $montoPago,
                                    'categoria' => 'Nota de Crédito',
                                    'descripcion' => "Sobrante de Nota de Crédito ID {$nota->id} aplicada a clase del {$clase->fecha->toDateString()}",
                                    'fecha' => $clase->fecha,
                                    'lugar_id' => $clase->lugar_id,
                                    'usuario_id' => $userId
                                ]);
                            }
                            $nota->update(['usado_en_clase_id' => $clase->id]);
                        }
                    }
                }

                $clase->update($data);
                return response()->json([
                    'message' => 'Clase actualizada', 
                    'data' => $clase
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error al actualizar la clase', 'details' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $clase = Clase::find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);
        $clase->delete();
        return response()->json(['message' => 'Clase eliminada']);
    }

    public function generar(Request $request)
    {
        $request->validate([
            'startDate' => 'required|date',
            'endDate' => 'required|date'
        ]);

        $userId = $request->user() ? $request->user()->id : null;
        $clases = $this->asistenciaService->generarClasesDesdeHorarios(
            $request->startDate, 
            $request->endDate, 
            $userId
        );

        return response()->json([
            'message' => count($clases) . ' clases generadas con éxito',
            'data' => $clases
        ], 201);
    }

    public function practicantes($id)
    {
        $clase = Clase::find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);

        // Obtener elegibles
        $elegibles = $this->asistenciaService->getEligiblePracticantes($clase);

        // Obtener quienes ya tienen asistencia marcada
        $asistenciasActuales = Asistencia::where('clase_id', $id)->get()->keyBy('practicante_id');

        // Cruzar datos
        $data = array_map(function($p) use ($asistenciasActuales) {
            $pArray = (array)$p;
            $pArray['asistio'] = isset($asistenciasActuales[$pArray['id']]) ? $asistenciasActuales[$pArray['id']]->asistio : false;
            // Simplificación: por ahora no calculamos asistencias_esta_semana aquí si no es crítico
            // En Node se calculaba en el SQL o post-proceso.
            return $pArray;
        }, $elegibles);

        return response()->json(['data' => $data]);
    }

    public function updatePracticantes(Request $request, $id)
    {
        $clase = Clase::find($id);
        if (!$clase) return response()->json(['error' => 'Clase no encontrada'], 404);

        if ($clase->estado === 'cerrada') {
            return response()->json(['error' => 'No se puede modificar la asistencia de una clase cerrada'], 400);
        }

        $request->validate([
            'updates' => 'required|array',
            'updates.*.practicante_id' => 'required|exists:Practicante,id',
            'updates.*.asistio' => 'required|boolean'
        ]);

        $updates = $request->get('updates');

        foreach ($updates as $u) {
            Asistencia::updateOrCreate(
                ['clase_id' => $id, 'practicante_id' => $u['practicante_id']],
                ['asistio' => $u['asistio']]
            );
        }

        return response()->json(['message' => 'Asistencia procesada con éxito']);
    }
}
