<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Presupuesto extends Model
{
    use SoftDeletes;

    protected $table = 'Presupuesto';

    protected $fillable = [
        'practicante_id',
        'cliente_nombre',
        'fecha',
        'total',
        'observaciones',
        'usuario_id',
    ];

    protected $casts = [
        'fecha' => 'date',
        'total' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PresupuestoItem::class, 'presupuesto_id');
    }
}
