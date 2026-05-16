<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTipoAbonoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => 'required|string|max:255',
            'duracion_dias' => 'nullable|integer|min:0',
            'precio' => 'required|numeric|min:0',
            'descripcion' => 'nullable|string',
            'activo' => 'nullable|boolean',
            'categoria' => 'required|in:grupal,particular,compartida,otro',
            'lugar_id' => 'nullable|exists:Lugar,id',
            'clases_por_semana' => 'nullable|integer|min:0',
            'max_personas' => 'nullable|integer|min:1',
            'horarios' => 'nullable|array', // Para sincronizar horarios si se envían
            'horarios.*' => 'exists:Horario,id',
        ];
    }
}
