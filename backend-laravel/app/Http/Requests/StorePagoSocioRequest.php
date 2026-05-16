<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePagoSocioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'socio_id' => 'required|exists:Socio,id',
            'monto' => 'required|numeric|min:0',
            'fecha_pago' => 'nullable|date',
            'mes_abono' => 'nullable|string|max:50',
            'fecha_vencimiento' => 'nullable|date',
            'observaciones' => 'nullable|string',
            'pagado_directo' => 'nullable|boolean',
            'estado_desconocido' => 'nullable|boolean',
        ];
    }
}
