<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InscripcionHorario extends Model
{
    use SoftDeletes;

    protected $table = 'InscripcionHorario';

    protected $fillable = [
        'practicante_id',
        'horario_id',
        'fecha_desde',
        'fecha_hasta',
        'activo',
    ];

    protected $casts = [
        'fecha_desde' => 'date',
        'fecha_hasta' => 'date',
        'activo' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function horario(): BelongsTo
    {
        return $this->belongsTo(Horario::class, 'horario_id');
    }

    /**
     * Scope a query to only include active inscriptions.
     */
    public function scopeActiva($query)
    {
        return $query->where('activo', true)
                     ->whereNull('fecha_hasta')
                     ->whereNull('deleted_at');
    }
}
