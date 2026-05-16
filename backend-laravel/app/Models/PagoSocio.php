<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PagoSocio extends Model
{
    use SoftDeletes;

    protected $table = 'PagoSocio';

    protected $fillable = [
        'socio_id',
        'monto',
        'fecha_pago',
        'mes_abono',
        'fecha_vencimiento',
        'observaciones',
        'usuario_id',
        'pagado_directo',
        'estado_desconocido',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha_pago' => 'date',
        'fecha_vencimiento' => 'date',
        'pagado_directo' => 'boolean',
        'estado_desconocido' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function socio(): BelongsTo
    {
        return $this->belongsTo(Socio::class, 'socio_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
