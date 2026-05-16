<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreLugarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => 'required|string|max:255',
            'direccion' => 'nullable|string',
            'activo' => 'nullable|boolean',
            'cobra_cuota_social' => 'nullable|boolean',
            'cuota_social_general' => 'nullable|numeric|min:0',
            'cuota_social_descuento' => 'nullable|numeric|min:0',
            'costo_tarifa' => 'nullable|numeric|min:0',
            'tipo_tarifa' => 'nullable|in:mensual,por_hora',
            'parent_id' => 'nullable|exists:Lugar,id',
        ];
    }
}
