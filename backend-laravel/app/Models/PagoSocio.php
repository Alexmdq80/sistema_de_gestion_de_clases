<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PagoSocio extends Model
{
    use SoftDeletes;

    protected $table = 'PagoSocio';

    protected $fillable = [
        'socio_id',
        'monto',
        'fecha_pago',
        'mes_abono',
        'fecha_vencimiento',
        'observaciones',
        'usuario_id',
        'pagado_directo',
        'estado_desconocido',
    ];

    protected $casts = [
        'monto' => 'float',
        'fecha_pago' => 'date',
        'fecha_vencimiento' => 'date',
        'pagado_directo' => 'boolean',
        'estado_desconocido' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Accesor para saber si el socio es profesor.
     */
    public function getEsProfesorAttribute()
    {
        return (bool) $this->socio?->practicante?->es_profesor;
    }

    /**
     * Accesor para el nombre completo del practicante.
     */
    public function getNombreCompletoAttribute()
    {
        return $this->socio?->practicante?->nombre_completo;
    }

    /**
     * Accesor para el nombre del lugar.
     */
    public function getLugarNombreAttribute()
    {
        return $this->socio?->lugar?->nombre;
    }

    /**
     * Accesor para la tarifa general del lugar (o su padre).
     */
    public function getTarifaGeneralAttribute()
    {
        $lugar = $this->socio?->lugar;
        if (!$lugar) return 0;
        if ($lugar->parent_id) {
            return (float) ($lugar->parent->cuota_social_general ?? $lugar->cuota_social_general);
        }
        return (float) $lugar->cuota_social_general;
    }

    /**
     * Accesor para la tarifa con descuento del lugar (o su padre).
     */
    public function getTarifaDescuentoAttribute()
    {
        $lugar = $this->socio?->lugar;
        if (!$lugar) return 0;
        if ($lugar->parent_id) {
            return (float) ($lugar->parent->cuota_social_descuento ?? $lugar->cuota_social_descuento);
        }
        return (float) $lugar->cuota_social_descuento;
    }

    /**
     * Accesor para el monto recibido (pago previo del alumno).
     */
    public function getMontoRecibidoPagoAttribute()
    {
        return (float) $this->pagos()->whereNull('deleted_at')->sum('monto');
    }

    /**
     * Accesor para el abono ID vinculado (si existe).
     */
    public function getLinkedAbonoIdAttribute()
    {
        return $this->pagos()->whereNull('deleted_at')->whereNotNull('abono_id')->value('abono_id');
    }

    /**
     * Campos que se agregan automáticamente al JSON.
     */
    protected $appends = [
        'es_profesor',
        'nombre_completo',
        'lugar_nombre',
        'tarifa_general',
        'tarifa_descuento',
        'monto_recibido_pago',
        'linked_abono_id',
    ];

    public function socio(): BelongsTo
    {
        return $this->belongsTo(Socio::class, 'socio_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function pagos()
    {
        return $this->hasMany(Pago::class, 'pago_socio_id');
    }
}
