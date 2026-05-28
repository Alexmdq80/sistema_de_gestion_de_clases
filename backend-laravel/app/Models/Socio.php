<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Socio extends Model
{
    use SoftDeletes;

    protected $table = 'Socio';

    protected $fillable = [
        'practicante_id',
        'lugar_id',
        'numero_socio',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Accesor para el nombre del practicante.
     */
    public function getNombreCompletoAttribute()
    {
        return $this->practicante?->nombre_completo;
    }

    /**
     * Accesor para el nombre del lugar.
     */
    public function getLugarNombreAttribute()
    {
        return $this->lugar?->nombre;
    }

    /**
     * Accesor para saber si es profesor.
     */
    public function getEsProfesorAttribute()
    {
        return (bool) $this->practicante?->es_profesor;
    }

    /**
     * Accesor para la cuota social general del lugar.
     */
    public function getCuotaSocialGeneralAttribute()
    {
        $lugar = $this->lugar;
        if (!$lugar) return 0;
        if ($lugar->parent_id) {
            return (float) ($lugar->parent->cuota_social_general ?? $lugar->cuota_social_general);
        }
        return (float) $lugar->cuota_social_general;
    }

    /**
     * Accesor para la cuota social con descuento del lugar.
     */
    public function getCuotaSocialDescuentoAttribute()
    {
        $lugar = $this->lugar;
        if (!$lugar) return 0;
        if ($lugar->parent_id) {
            return (float) ($lugar->parent->cuota_social_descuento ?? $lugar->cuota_social_descuento);
        }
        return (float) $lugar->cuota_social_descuento;
    }

    /**
     * Campos que se agregan automáticamente al JSON.
     */
    protected $appends = [
        'nombre_completo',
        'lugar_nombre',
        'es_profesor',
        'cuota_social_general',
        'cuota_social_descuento',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(PagoSocio::class, 'socio_id');
    }
}
