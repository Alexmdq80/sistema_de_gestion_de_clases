<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TipoAbono extends Model
{
    use SoftDeletes;

    protected $table = 'TipoAbono';

    protected $fillable = [
        'nombre',
        'duracion_dias',
        'precio',
        'descripcion',
        'activo',
        'categoria',
        'lugar_id',
        'clases_por_semana',
        'max_personas',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'precio' => 'decimal:2',
        'duracion_dias' => 'integer',
        'clases_por_semana' => 'integer',
        'max_personas' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Relación con el Lugar donde se dicta este abono.
     */
    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    /**
     * Horarios asociados a este tipo de abono.
     */
    public function horarios(): BelongsToMany
    {
        return $this->belongsToMany(Horario::class, 'TipoAbono_Horario', 'tipo_abono_id', 'horario_id');
    }
}
