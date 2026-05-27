<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MovimientoCaja;
use Illuminate\Http\Request;

class CajaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = MovimientoCaja::query();

        if ($request->has('fecha_inicio')) {
            $query->where('fecha', '>=', $request->fecha_inicio);
        }

        if ($request->has('fecha_fin')) {
            $query->where('fecha', '<=', $request->fecha_fin);
        }

        if ($request->has('lugar_id') && $request->lugar_id !== 'all') {
            $query->where('lugar_id', $request->lugar_id);
        }

        $movimientos = $query->orderBy('fecha', 'desc')->get();

        return response()->json(['data' => $movimientos]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
