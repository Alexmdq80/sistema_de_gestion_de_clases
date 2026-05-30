<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistorialDeuda extends Model
{
    protected $table = 'HistorialDeuda';

    public $timestamps = false; // It has a 'fecha' field with default CURRENT_TIMESTAMP

    protected $fillable = [
        'deuda_id',
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

    public function deuda(): BelongsTo
    {
        return $this->belongsTo(Deuda::class, 'deuda_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
