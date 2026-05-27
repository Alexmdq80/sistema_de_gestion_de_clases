<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PresupuestoItem extends Model
{
    protected $table = 'PresupuestoItem';

    // Disable timestamps as they are not standard in this table except for created_at
    public $timestamps = false;

    protected $fillable = [
        'presupuesto_id',
        'descripcion',
        'cantidad',
        'precio_unitario',
        'subtotal',
        'abono_id',
    ];

    protected $casts = [
        'precio_unitario' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function presupuesto(): BelongsTo
    {
        return $this->belongsTo(Presupuesto::class, 'presupuesto_id');
    }

    public function abono(): BelongsTo
    {
        return $this->belongsTo(TipoAbono::class, 'abono_id');
    }
}
