<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistorialInscripcionHorario extends Model
{
    protected $table = 'HistorialInscripcionHorario';

    public $timestamps = false;

    protected $fillable = [
        'inscripcion_id',
        'accion',
        'datos_anteriores',
        'datos_nuevos',
        'usuario_id',
    ];

    protected $casts = [
        'datos_anteriores' => 'array',
        'datos_nuevos' => 'array',
        'fecha' => 'datetime',
    ];

    public function inscripcion(): BelongsTo
    {
        return $this->belongsTo(InscripcionHorario::class, 'inscripcion_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
