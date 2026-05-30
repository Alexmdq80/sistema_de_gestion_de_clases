<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistorialPagoSocio extends Model
{
    protected $table = 'HistorialPagoSocio';

    public $timestamps = false;

    protected $fillable = [
        'pago_socio_id',
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

    public function pagoSocio(): BelongsTo
    {
        return $this->belongsTo(PagoSocio::class, 'pago_socio_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
