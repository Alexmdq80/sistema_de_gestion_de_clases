<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Abono extends Model
{
    use SoftDeletes;

    protected $table = 'Abono';

    protected $fillable = [
        'practicante_id',
        'tipo_abono_id',
        'fecha_inicio',
        'fecha_vencimiento',
        'mes_abono',
        'lugar_id',
        'estado',
        'cantidad',
        'monto_pactado',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_vencimiento' => 'date',
        'cantidad' => 'integer',
        'monto_pactado' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function tipoAbono(): BelongsTo
    {
        return $this->belongsTo(TipoAbono::class, 'tipo_abono_id');
    }

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(Pago::class, 'abono_id');
    }

    public function historial(): HasMany
    {
        return $this->hasMany(HistorialAbono::class, 'abono_id');
    }

    /**
     * Obtener el abono activo de un practicante.
     */
    public static function findActiveByPracticanteId($practicanteId)
    {
        return self::where('practicante_id', $practicanteId)
            ->where('estado', 'activo')
            ->where('fecha_vencimiento', '>=', now()->toDateString())
            ->orderBy('fecha_vencimiento', 'desc')
            ->first();
    }
}
