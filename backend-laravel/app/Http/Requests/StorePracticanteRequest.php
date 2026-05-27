<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePracticanteRequest extends FormRequest
{
    /**
     * Determinar si el usuario está autorizado para hacer esta solicitud.
     */
    public function authorize(): bool
    {
        return true; // Dejamos que el middleware auth:sanctum maneje la autorización básica
    }

    /**
     * Reglas de validación.
     */
    public function rules(): array
    {
        return [
            'nombre_completo' => 'required|string|max:255',
            'dni' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'telefono' => 'nullable|string|max:20',
            'fecha_nacimiento' => 'nullable|date',
            'genero' => 'nullable|in:M,F,Otro,Prefiero no decir',
            'direccion' => 'nullable|string',
            'condiciones_medicas' => 'nullable|string',
            'medicamentos' => 'nullable|string',
            'limitaciones_fisicas' => 'nullable|string',
            'alergias' => 'nullable|string',
            'emergencia_nombre' => 'nullable|string|max:255',
            'emergencia_telefono' => 'nullable|string|max:50',
            'obra_social' => 'nullable|string|max:255',
            'obra_social_nro' => 'nullable|string|max:100',
            'emergencia_servicio' => 'nullable|string|max:255',
            'emergencia_servicio_telefono' => 'nullable|string|max:50',
            'ocupacion' => 'nullable|string|max:255',
            'estudios' => 'nullable|string|max:255',
            'actividad_fisica_actual' => 'nullable|boolean',
            'actividad_fisica_detalle' => 'nullable|string',
            'actividad_fisica_anios_inactivo' => 'nullable|integer',
            'actividad_fisica_anterior' => 'nullable|string',
            'observaciones_adicionales' => 'nullable|string',
            'es_profesor' => 'nullable|boolean',
            'user_id' => 'nullable|exists:User,id',
            'activo' => 'nullable|boolean',
        ];
    }

    /**
     * Mensajes de error personalizados (opcional).
     */
    public function messages(): array
    {
        return [
            'nombre_completo.required' => 'El nombre completo es obligatorio.',
            'email.email' => 'El formato del correo electrónico no es válido.',
            'genero.in' => 'El género seleccionado no es válido.',
            'user_id.exists' => 'El usuario asociado no existe.',
        ];
    }
}
