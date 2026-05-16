<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asistencia extends Model
{
    use SoftDeletes;

    protected $table = 'Asistencia';

    protected $fillable = [
        'practicante_id',
        'clase_id',
        'asistio',
    ];

    protected $casts = [
        'asistio' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function practicante(): BelongsTo
    {
        return $this->belongsTo(Practicante::class, 'practicante_id');
    }

    public function clase(): BelongsTo
    {
        return $this->belongsTo(Clase::class, 'clase_id');
    }
}
