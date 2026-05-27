<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InscripcionHorario extends Model
{
    protected $table = 'InscripcionHorario';

    protected $fillable = [
        'practicante_id',
        'horario_id',
        'fecha_inscripcion',
        'activo',
    ];

    protected $casts = [
        'fecha_inscripcion' => 'date',
        'activo' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function horario(): BelongsTo
    {
        return $this->belongsTo(Horario::class, 'horario_id');
    }
}
