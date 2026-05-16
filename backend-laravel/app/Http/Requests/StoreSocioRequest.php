<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSocioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'practicante_id' => 'required|exists:Practicante,id',
            'lugar_id' => 'required|exists:Lugar,id',
            'numero_socio' => 'nullable|string|max:50',
        ];
    }
}
