<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lugar extends Model
{
    use SoftDeletes;

    protected $table = 'Lugar';

    protected $fillable = [
        'nombre',
        'direccion',
        'activo',
        'cobra_cuota_social',
        'cuota_social_general',
        'cuota_social_descuento',
        'costo_tarifa',
        'tipo_tarifa',
        'parent_id',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'cobra_cuota_social' => 'boolean',
        'cuota_social_general' => 'decimal:2',
        'cuota_social_descuento' => 'decimal:2',
        'costo_tarifa' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * El lugar padre (si existe).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'parent_id');
    }

    /**
     * Sub-lugares o espacios dentro de este lugar.
     */
    public function children(): HasMany
    {
        return $this->hasMany(Lugar::class, 'parent_id');
    }
}
