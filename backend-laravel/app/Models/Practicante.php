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
 * Accesor para el nombre del último abono pagado.
 */
public function getUltimoAbonoNombreAttribute()
{
    return \App\Models\Pago::where('Pago.practicante_id', $this->id)
        ->whereNotNull('Pago.abono_id')
        ->whereNull('Pago.deleted_at')
        ->join('Abono', 'Pago.abono_id', '=', 'Abono.id')
        ->join('TipoAbono', 'Abono.tipo_abono_id', '=', 'TipoAbono.id')
        ->whereNull('Abono.deleted_at')
        ->whereNull('TipoAbono.deleted_at')
        ->orderByDesc('Pago.fecha')
        ->orderByDesc('Pago.id')
        ->value('TipoAbono.nombre');
}

/**
 * Accesor para el mes del último abono pagado.
 */
public function getUltimoAbonoMesAttribute()
{
    return \App\Models\Pago::where('practicante_id', $this->id)
        ->whereNotNull('abono_id')
        ->whereNull('deleted_at')
        ->orderByDesc('fecha')
        ->orderByDesc('id')
        ->value('mes_abono');
}

/**
 * Accesor para la última cuota social recibida.
 */
public function getUltimaCuotaSocialRecibidaMesAttribute()
{
    return \App\Models\Pago::where('practicante_id', $this->id)
        ->whereNull('abono_id')
        ->whereNull('deleted_at')
        ->orderByDesc('fecha')
        ->orderByDesc('id')
        ->value('mes_abono');
}

/**
 * Accesor para la última cuota social pagada a la institución.
 */
public function getUltimaCuotaSocialPagadaMesAttribute()
{
    return \App\Models\PagoSocio::join('Socio', 'PagoSocio.socio_id', '=', 'Socio.id')
        ->where('Socio.practicante_id', $this->id)
        ->whereNotNull('PagoSocio.fecha_pago')
        ->whereNull('PagoSocio.deleted_at')
        ->whereNull('Socio.deleted_at')
        ->orderByDesc('PagoSocio.fecha_pago')
        ->orderByDesc('PagoSocio.id')
        ->value('PagoSocio.mes_abono');
}

/**
 * Accesor para las clases restantes.
 */
public function getClasesRestantesAttribute()
{
    // Solo calcular si el practicante tiene abonos de tipo particular/compartida o duración 0
    $hasRelevantAbonos = \App\Models\Abono::where('practicante_id', $this->id)
        ->whereNull('deleted_at')
        ->whereHas('tipoAbono', function($q) {
            $q->whereIn('categoria', ['particular', 'compartida'])
              ->orWhere('duracion_dias', 0);
        })->exists();

    if (!$hasRelevantAbonos) return null;

    // Total clases compradas
    $compradas = \App\Models\Abono::where('Abono.practicante_id', $this->id)
        ->whereNull('Abono.deleted_at')
        ->whereHas('tipoAbono', function($q) {
            $q->whereIn('categoria', ['particular', 'compartida'])
              ->orWhere('duracion_dias', 0);
        })
        ->whereHas('pagos', function($q) {
            $q->whereNull('deleted_at');
        })
        ->sum('cantidad');
// Total asistencias
$asistidas = \App\Models\Asistencia::where('Asistencia.practicante_id', $this->id)
    ->where('Asistencia.asistio', true)
    ->whereHas('clase', function($q) {
        $q->whereNull('deleted_at')
          ->whereNotIn('estado', ['cancelada', 'sin_actividad', 'suspendida'])
          ->where('fecha', '<=', now()->toDateString());
    })
    ->where(function($q) {
        // Filtro complejo de Node: cl.tipo = 'flexible' OR duracion_dias = 0
        $q->whereHas('clase', fn($sq) => $sq->where('tipo', 'flexible'))
          ->orWhereHas('clase.abono.tipoAbono', fn($sq) => $sq->where('duracion_dias', 0));
    })
    ->count();

    return $compradas - $asistidas;
}

/**
 * Campos que se agregan automáticamente al JSON.
 */
protected $appends = [
    'ultimo_abono_nombre',
    'ultimo_abono_mes',
    'ultima_cuota_social_recibida_mes',
    'ultima_cuota_social_pagada_mes',
    'clases_restantes',
];

/**
 * The "booted" method of the model.
...
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
