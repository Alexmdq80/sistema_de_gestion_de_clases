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

    protected $appends = [
        'profesor_nombre',
        'actividad_nombre',
        'lugar_nombre',
        'asistentes_count',
        'nota_credito_id',
        'nota_credito_monto',
        'tiene_nota_credito',
        'costo_tarifa',
        'tipo_tarifa',
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

    /**
     * En clases particulares/flexibles, el horario_id puede apuntar directamente a un Abono.
     */
    public function abono(): BelongsTo
    {
        return $this->belongsTo(Abono::class, 'horario_id');
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
        return $this->belongsTo(Practicante::class, 'profesor_id');
    }

    public function asistencias(): HasMany
    {
        return $this->hasMany(Asistencia::class, 'clase_id');
    }

    public function getProfesorNombreAttribute(): ?string
    {
        return $this->profesor ? $this->profesor->nombre_completo : null;
    }

    public function getActividadNombreAttribute(): ?string
    {
        return $this->actividad ? $this->actividad->nombre : null;
    }

    public function getLugarNombreAttribute(): ?string
    {
        return $this->lugar ? $this->lugar->nombre : null;
    }

    public function getAsistentesCountAttribute(): int
    {
        return $this->asistencias()->where('asistio', true)->count();
    }

    public function getNotaCreditoIdAttribute(): ?int
    {
        return MovimientoCaja::where('usado_en_clase_id', $this->id)
            ->whereNull('deleted_at')
            ->value('id');
    }

    public function getNotaCreditoMontoAttribute(): ?float
    {
        return MovimientoCaja::where('usado_en_clase_id', $this->id)
            ->whereNull('deleted_at')
            ->value('monto');
    }

    public function getTieneNotaCreditoAttribute(): bool
    {
        return $this->nota_credito_id !== null;
    }

    public function getCostoTarifaAttribute(): float
    {
        return (float) ($this->lugar->costo_tarifa ?? 0);
    }

    public function getTipoTarifaAttribute(): string
    {
        return $this->lugar->tipo_tarifa ?? 'por_hora';
    }
}
