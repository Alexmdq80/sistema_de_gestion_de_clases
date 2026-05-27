<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreClaseRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tipo' => 'nullable|string',
            'horario_id' => 'nullable|exists:Horario,id',
            'actividad_id' => 'required|exists:Actividad,id',
            'lugar_id' => 'required|exists:Lugar,id',
            'profesor_id' => 'nullable|exists:User,id',
            'fecha' => 'required|date',
            'hora' => 'required|string',
            'hora_fin' => 'required|string',
            'estado' => 'required|string|in:programada,realizada,cancelada,suspendida,cerrada,sin_actividad',
            'motivo_cancelacion' => 'nullable|string',
            'observaciones' => 'nullable|string',
            'usuario_id' => 'nullable|exists:User,id',
            'pago_espacio_realizado' => 'boolean',
            'fecha_pago_espacio' => 'nullable|date',
            'monto_pago_espacio' => 'nullable|numeric',
            'monto_referencia_espacio' => 'nullable|numeric',
        ];
    }
}
