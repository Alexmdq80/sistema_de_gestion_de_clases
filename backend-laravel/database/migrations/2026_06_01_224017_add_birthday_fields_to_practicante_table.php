<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Practicante', function (Blueprint $row) {
            $row->integer('cumple_dia')->nullable()->after('fecha_nacimiento');
            $row->integer('cumple_mes')->nullable()->after('cumple_dia');
        });
    }

    public function down(): void
    {
        Schema::table('Practicante', function (Blueprint $row) {
            $row->dropColumn(['cumple_dia', 'cumple_mes']);
        });
    }
};
