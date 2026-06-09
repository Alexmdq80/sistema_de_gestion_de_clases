<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deuda extends Model
{
    protected $table = 'Deuda';

    protected $fillable = [
        'practicante_id',
        'monto',
        'concepto',
        'fecha',
        'estado',
        'clase_id',
        'abono_id',
        'pago_id',
        'usuario_id',
    ];

    protected $casts = [
        'monto' => 'float',
        'fecha' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function clase(): BelongsTo
    {
        return $this->belongsTo(Clase::class, 'clase_id');
    }

    public function abono(): BelongsTo
    {
        return $this->belongsTo(Abono::class, 'abono_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
