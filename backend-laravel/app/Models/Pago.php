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

    protected $appends = [
        'pago_tipo',
        'tipo_abono_nombre',
        'categoria',
        'practicante_nombre',
        'lugar_nombre',
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

    public function getPagoTipoAttribute(): string
    {
        return 'ingreso';
    }

    public function getTipoAbonoNombreAttribute(): string
    {
        if ($this->abono && $this->abono->tipoAbono) {
            return $this->abono->tipoAbono->nombre;
        }
        return 'Recepción Cuota Social';
    }

    public function getCategoriaAttribute(): ?string
    {
        return $this->abono && $this->abono->tipoAbono ? $this->abono->tipoAbono->categoria : null;
    }

    public function getPracticanteNombreAttribute(): ?string
    {
        return $this->practicante ? $this->practicante->nombre_completo : null;
    }

    public function getLugarNombreAttribute(): ?string
    {
        return $this->lugar ? $this->lugar->nombre : null;
    }
}
