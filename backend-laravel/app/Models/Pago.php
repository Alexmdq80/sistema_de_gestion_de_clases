<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pago extends Model
{
    use SoftDeletes;

    protected $table = 'Pago';

    protected $fillable = [
        'practicante_id',
        'abono_id',
        'pago_socio_id',
        'mes_abono',
        'lugar_id',
        'fecha',
        'monto',
        'metodo_pago',
        'notas',
        'deuda_id',
    ];

    protected $casts = [
        'fecha' => 'date',
        'monto' => 'float',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    public function abono(): BelongsTo
    {
        return $this->belongsTo(Abono::class, 'abono_id');
    }

    public function pagoSocio(): BelongsTo
    {
        return $this->belongsTo(PagoSocio::class, 'pago_socio_id');
    }

    public function deuda(): BelongsTo
    {
        return $this->belongsTo(Deuda::class, 'deuda_id');
    }
}
