<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovimientoCaja extends Model
{
    use SoftDeletes;

    protected $table = 'MovimientoCaja';

    protected $fillable = [
        'tipo',
        'monto',
        'categoria',
        'descripcion',
        'fecha',
        'lugar_id',
        'clase_id',
        'usado_en_clase_id',
        'practicante_id',
        'usuario_id',
    ];

    protected $casts = [
        'monto' => 'float',
        'fecha' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(Lugar::class, 'lugar_id');
    }

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
