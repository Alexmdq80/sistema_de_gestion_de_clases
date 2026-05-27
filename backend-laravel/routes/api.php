<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PracticanteController;
use App\Http\Controllers\Api\ActividadController;
use App\Http\Controllers\Api\LugarController;
use App\Http\Controllers\Api\TipoAbonoController;
use App\Http\Controllers\Api\HorarioController;
use App\Http\Controllers\Api\ClaseController;
use App\Http\Controllers\Api\AsistenciaController;
use App\Http\Controllers\Api\SocioController;
use App\Http\Controllers\Api\PagoSocioController;
use App\Http\Controllers\Api\PagoController;
use App\Http\Controllers\Api\CajaController;
use App\Http\Controllers\Api\InformeController;
use App\Http\Controllers\Api\PresupuestoController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Rutas de Autenticación V2
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
});

// Rutas de Negocio V2 (Protegidas)
Route::middleware('auth:sanctum')->group(function () {
    // Practicantes (CRUD completo)
    Route::apiResource('practicantes', PracticanteController::class);

    // Actividades (CRUD completo)
    Route::apiResource('actividades', ActividadController::class);

    // Lugares (CRUD completo)
    Route::apiResource('lugares', LugarController::class);

    // Tipos de Abono (CRUD completo con relaciones)
    Route::apiResource('tipos-abono', TipoAbonoController::class);

    // Horarios y Agenda
    Route::get('horarios/practicante/{id}', [HorarioController::class, 'getByPracticante']);
    Route::post('horarios/practicante/{id}', [HorarioController::class, 'updateByPracticante']);
    Route::apiResource('horarios', HorarioController::class);
    
    Route::prefix('asistencia')->group(function () {
        Route::get('practicante/{id}', [AsistenciaController::class, 'findByPracticante']);
        Route::get('clases/generar', [ClaseController::class, 'generar']);
        Route::get('clases/{clase}/practicantes', [ClaseController::class, 'practicantes']);
        Route::post('clases/{clase}/practicantes', [ClaseController::class, 'updatePracticantes']);
        Route::apiResource('clases', ClaseController::class);
        Route::apiResource('asistencias', AsistenciaController::class);
    });

    // Presupuestos
    Route::apiResource('presupuestos', PresupuestoController::class);

    // Membresía y Socios
    Route::get('socios/candidates', [SocioController::class, 'candidates']);
    Route::get('socios/my-teacher-lugares', [SocioController::class, 'myTeacherLugares']);
    Route::get('socios/teacher-alerts', [SocioController::class, 'teacherAlerts']);
    Route::apiResource('socios', SocioController::class);
    Route::apiResource('pagos-socios', PagoSocioController::class);

    // Finanzas y Caja
    Route::apiResource('pagos', PagoController::class);
    Route::apiResource('caja', CajaController::class);
    Route::get('/categorias-caja', function() {
        return response()->json(['data' => App\Models\CategoriaMovimiento::all()]);
    });

    // Informes y Reportes
    Route::prefix('informes')->group(function () {
        Route::get('/padron-socios-pagos', [InformeController::class, 'padronSocios']);
        Route::get('/balance-mensual', [InformeController::class, 'balanceMensual']);
        Route::get('/practicantes/cumpleanos', [InformeController::class, 'cumpleanos']);
    });
    
    // Ejemplo de ruta para verificar el usuario actual
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
