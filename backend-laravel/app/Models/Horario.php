<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Horario extends Model
{
    use SoftDeletes;

    protected $table = 'Horario';

    protected $fillable = [
        'tipo',
        'actividad_id',
        'lugar_id',
        'profesor_id',
        'dia_semana',
        'hora_inicio',
        'hora_fin',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'dia_semana' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function actividad(): BelongsTo
    {
        return $this->belongsTo(Actividad::class, 'actividad_id');
    }

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    public function profesor(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'profesor_id');
    }

    public function clases(): HasMany
    {
        return $this->hasMany(Clase::class, 'horario_id');
    }
}
