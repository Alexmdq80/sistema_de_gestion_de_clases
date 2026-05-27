<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Practicante extends Model
{
    use SoftDeletes;

    /**
     * La tabla asociada al modelo.
     *
     * @var string
     */
    protected $table = 'Practicante';

    /**
     * Los atributos que se pueden asignar masivamente.
     *
     * @var array
     */
    protected $fillable = [
        'user_id',
        'es_profesor',
        'nombre_completo',
        'dni',
        'fecha_nacimiento',
        'genero',
        'telefono',
        'email',
        'direccion',
        'condiciones_medicas',
        'medicamentos',
        'limitaciones_fisicas',
        'alergias',
        'emergencia_nombre',
        'emergencia_telefono',
        'obra_social',
        'obra_social_nro',
        'emergencia_servicio',
        'emergencia_servicio_telefono',
        'ocupacion',
        'estudios',
        'actividad_fisica_actual',
        'actividad_fisica_detalle',
        'actividad_fisica_anios_inactivo',
        'actividad_fisica_anterior',
        'observaciones_adicionales',
        'activo',
        'archivado_at',
        'reingreso_at',
    ];

    /**
     * Los atributos que deben ser convertidos a tipos nativos.
     *
     * @var array
     */
    protected $casts = [
        'es_profesor' => 'boolean',
        'actividad_fisica_actual' => 'boolean',
        'activo' => 'boolean',
        'fecha_nacimiento' => 'date',
        'archivado_at' => 'datetime',
        'reingreso_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * The "booted" method of the model.
     */
    protected static function booted()
    {
        static::saving(function ($practicante) {
            if ($practicante->isDirty('activo')) {
                if (!$practicante->activo) {
                    $practicante->archivado_at = now();
                } else {
                    $practicante->archivado_at = null;
                    if ($practicante->exists) {
                        $practicante->reingreso_at = now();
                    }
                }
            }
        });
    }
}
