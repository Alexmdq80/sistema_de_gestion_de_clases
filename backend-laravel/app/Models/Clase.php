<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Clase extends Model
{
    use SoftDeletes;

    protected $table = 'Clase';

    protected $fillable = [
        'tipo',
        'horario_id',
        'actividad_id',
        'lugar_id',
        'profesor_id',
        'fecha',
        'hora',
        'hora_fin',
        'estado',
        'motivo_cancelacion',
        'observaciones',
        'usuario_id',
        'pago_espacio_realizado',
        'fecha_pago_espacio',
        'monto_pago_espacio',
        'monto_referencia_espacio',
    ];

    protected $casts = [
        'fecha' => 'date',
        'pago_espacio_realizado' => 'boolean',
        'fecha_pago_espacio' => 'date',
        'monto_pago_espacio' => 'decimal:2',
        'monto_referencia_espacio' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function horario(): BelongsTo
    {
        return $this->belongsTo(Horario::class, 'horario_id');
    }

    public function actividad(): BelongsTo
    {
        return $this->belongsTo(Actividad::class, 'actividad_id');
    }

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    public function profesor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'profesor_id');
    }

    public function asistencias(): HasMany
    {
        return $this->hasMany(Asistencia::class, 'clase_id');
    }
}
