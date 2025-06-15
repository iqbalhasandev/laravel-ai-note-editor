<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class HomeController extends Controller
{

    /**
     * Display the home page.
     *
     * @return \Inertia\Response
     */
    public function home(): InertiaResponse
    {
        return Inertia::render('welcome');
    }

    /**
     * Display the dashboard.
     *
     * @return \Illuminate\View\View
     */
    public function dashboard(): RedirectResponse
    {
        return \redirect()->route('notes.index');
    }
}
