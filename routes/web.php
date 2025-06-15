<?php

use App\Http\Controllers\AIController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\NoteController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/',  [HomeController::class, 'home'])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [HomeController::class, 'dashboard'])->name('dashboard');
    //  Note routes
    Route::resource('notes', NoteController::class)->except(['create', 'edit']);
    // Explicitly define note show route with name
    Route::get('notes/{note}', [NoteController::class, 'show'])->name('notes.show');
    // AI Enhancement routes
    Route::get('/notes/{note}/enhance/', [NoteController::class, 'enhance'])
        ->name('notes.enhance');
    Route::post('/notes/{note}/save-enhancement', [NoteController::class, 'saveEnhancement'])
        ->name('notes.saveEnhancement');
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
