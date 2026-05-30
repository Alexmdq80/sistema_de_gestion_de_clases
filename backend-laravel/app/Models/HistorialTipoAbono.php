<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistorialTipoAbono extends Model
{
    protected $table = 'HistorialTipoAbono';

    public $timestamps = false;

    protected $fillable = [
        'tipo_abono_id',
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

    public function tipoAbono(): BelongsTo
    {
        return $this->belongsTo(TipoAbono::class, 'tipo_abono_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
