<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deuda;
use App\Models\Abono;
use App\Models\Pago;
use App\Models\HistorialDeuda;
use App\Models\HistorialAbono;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DeudaController extends Controller
{
    /**
     * Lista todas las deudas con filtros opcionales (solo tabla Deuda).
     */
    public function index(Request $request)
    {
        $practicanteId = $request->get('practicante_id');
        $estadoFilter = $request->get('estado');

        $sql = "
            SELECT 
                d.id, d.practicante_id, 
                (d.monto - IFNULL((SELECT SUM(monto) FROM Pago WHERE deuda_id = d.id AND deleted_at IS NULL), 0)) as monto,
                d.concepto, d.fecha, d.estado,
                NULL as original_estado,
                d.created_at,
                p.nombre_completo as practicante_nombre,
                'manual' as tipo,
                d.monto as monto_original
            FROM Deuda d
            JOIN Practicante p ON d.practicante_id = p.id
            WHERE d.deleted_at IS NULL
        ";

        $bindings = [];

        if ($practicanteId) {
            $sql .= " AND d.practicante_id = ?";
            $bindings[] = $practicanteId;
        }

        if ($estadoFilter) {
            $sql .= " AND d.estado = ?";
            $bindings[] = $estadoFilter;
        }

        $sql .= " ORDER BY d.fecha DESC, d.created_at DESC";

        $data = DB::select($sql, $bindings);

        return response()->json(['data' => $data]);
    }

    /**
     * Marca una deuda como pagada. Soporta deudas manuales y de Abono.
     */
    public function pagar(Request $request, $id)
    {
        $tipo = $request->get('tipo', 'manual');
        $montoEsperado = $request->get('monto_esperado');
        $montoPago = $request->get('monto_pago');
        $userId = $request->user()->id;

        $today = Carbon::now();
        $monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        $currentMesAbono = $monthNames[$today->month - 1] . " " . $today->year;

        return DB::transaction(function() use ($id, $tipo, $montoEsperado, $montoPago, $userId, $currentMesAbono, $today) {
            if ($tipo === 'abono') {
                $abono = Abono::findOrFail($id);
                
                // Si el monto esperado cambia, actualizar Abono.monto_pactado y registrar historial
                if ($montoEsperado !== null && (float)$montoEsperado !== (float)$abono->monto_pactado) {
                    $oldAbono = $abono->toArray();
                    $abono->update(['monto_pactado' => $montoEsperado]);
                    $this->recordAbonoHistory($id, 'UPDATE', $oldAbono, $abono->fresh()->toArray(), $userId);
                }

                $totalPagado = Pago::where('abono_id', $id)->whereNull('deleted_at')->sum('monto');
                $saldoPendiente = $abono->monto_pactado - $totalPagado;

                if ($saldoPendiente <= 0) {
                    return response()->json(['error' => 'Este abono no tiene saldo pendiente'], 400);
                }

                $montoAFinal = $montoPago ?: $saldoPendiente;

                $pago = Pago::create([
                    'practicante_id' => $abono->practicante_id,
                    'abono_id' => $id,
                    'lugar_id' => $abono->lugar_id,
                    'monto' => $montoAFinal,
                    'metodo_pago' => 'efectivo',
                    'fecha' => $today->toDateString(),
                    'mes_abono' => $currentMesAbono,
                    'notas' => '[PAGO REGISTRADO DESDE GESTIÓN DE DEUDAS]'
                ]);

                return response()->json(['message' => 'Pago de abono registrado correctamente', 'data' => $pago]);
            }

            $deuda = Deuda::findOrFail($id);
            if ($deuda->estado !== 'pendiente') {
                return response()->json(['error' => 'Solo se pueden pagar deudas pendientes'], 400);
            }

            // Si el monto esperado cambia, actualizar Deuda.monto y registrar historial
            if ($montoEsperado !== null && (float)$montoEsperado !== (float)$deuda->monto) {
                $oldDeuda = $deuda->toArray();
                $deuda->update(['monto' => $montoEsperado]);
                $this->recordDeudaHistory($id, 'UPDATE', $oldDeuda, $deuda->fresh()->toArray(), $userId);
            }

            $lugarId = null;
            if ($deuda->clase_id) {
                $lugarId = DB::table('Clase')->where('id', $deuda->clase_id)->value('lugar_id');
            }

            $montoAFinal = $montoPago ?: $deuda->monto;

            $pago = Pago::create([
                'practicante_id' => $deuda->practicante_id,
                'deuda_id' => $id,
                'monto' => $montoAFinal,
                'mes_abono' => $currentMesAbono,
                'lugar_id' => $lugarId,
                'fecha' => $today->toDateString(),
                'metodo_pago' => 'efectivo',
                'notas' => "[PAGO DE DEUDA MANUAL: {$deuda->concepto}]"
            ]);

            $totalPagado = Pago::where('deuda_id', $id)->whereNull('deleted_at')->sum('monto');
            if ($totalPagado >= $deuda->monto) {
                $oldDeuda = $deuda->toArray();
                $deuda->update(['estado' => 'pagada']);
                $this->recordDeudaHistory($id, 'PAY', $oldDeuda, $deuda->fresh()->toArray(), $userId);
                return response()->json(['message' => 'Deuda pagada por completo', 'data' => $deuda, 'pago' => $pago]);
            }

            return response()->json(['message' => 'Pago parcial registrado', 'pago' => $pago]);
        });
    }

    /**
     * Cancela una deuda. Si es de Abono, marca el Abono como cancelado.
     */
    public function cancelar(Request $request, $id)
    {
        $tipo = $request->get('tipo', 'manual');
        $userId = $request->user()->id;

        if ($tipo === 'abono') {
            $abono = Abono::findOrFail($id);
            $oldAbono = $abono->toArray();
            $abono->update(['estado' => 'cancelado']);
            $this->recordAbonoHistory($id, 'UPDATE', $oldAbono, $abono->fresh()->toArray(), $userId);
            return response()->json(['message' => 'Abono y su deuda asociada han sido cancelados']);
        }

        $deuda = Deuda::findOrFail($id);
        if ($deuda->estado !== 'pendiente') {
            return response()->json(['error' => 'Solo se pueden cancelar deudas pendientes'], 400);
        }

        $oldDeuda = $deuda->toArray();
        $deuda->update(['estado' => 'cancelada']);
        $this->recordDeudaHistory($id, 'CANCEL', $oldDeuda, $deuda->fresh()->toArray(), $userId);
        return response()->json(['message' => 'Deuda cancelada correctamente', 'data' => $deuda]);
    }

    /**
     * Eliminación lógica (soft delete).
     */
    public function destroy(Request $request, $id)
    {
        $deuda = Deuda::findOrFail($id);
        $userId = $request->user()->id;
        
        $oldDeuda = $deuda->toArray();
        $deuda->delete();
        $this->recordDeudaHistory($id, 'DELETE', $oldDeuda, null, $userId);
        
        return response()->json(['message' => 'Registro de deuda eliminado']);
    }

    private function recordDeudaHistory($deudaId, $action, $oldData, $newData, $userId)
    {
        HistorialDeuda::create([
            'deuda_id' => $deudaId,
            'accion' => $action,
            'datos_anteriores' => $oldData,
            'datos_nuevos' => $newData,
            'usuario_id' => $userId
        ]);
    }

    private function recordAbonoHistory($abonoId, $action, $oldData, $newData, $userId)
    {
        HistorialAbono::create([
            'abono_id' => $abonoId,
            'accion' => $action,
            'datos_anteriores' => $oldData,
            'datos_nuevos' => $newData,
            'usuario_id' => $userId
        ]);
    }
}
