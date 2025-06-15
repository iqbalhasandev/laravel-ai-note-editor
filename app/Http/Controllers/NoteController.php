<?php

namespace App\Http\Controllers;

use App\Models\Note;
use App\Services\OpenAIService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NoteController extends Controller
{
    use AuthorizesRequests;

    /**
     * Display a listing of the notes.
     */
    public function index(): InertiaResponse
    {
        $notes = Auth::user()->notes()
            ->orderBy('updated_at', 'desc')
            ->get(['id', 'title', 'content', 'tags', 'updated_at']);

        return Inertia::render('Notes/Index', [
            'notes' => $notes,
        ]);
    }

    /**
     * Show the form for creating a new note.
     */
    public function show(Note $note): InertiaResponse
    {
        $this->authorize('view', $note);

        return Inertia::render('Notes/Note', [
            'note' => $note,
        ]);
    }

    /**
     * Store a newly created note in storage.
     */
    public function store(Request $request): RedirectResponse
    {
        // Validate the request data
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        // Create the note
        $note = Auth::user()->notes()->create([
            'title' => $request->title,
            'content' => $request->content,
        ]);

        // Redirect to the note editor with a success message
        return redirect()->route('notes.show', $note)
            ->with('success', 'Note created successfully');
    }

    /**
     * Update the specified note in storage.
     *
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function update(Request $request, Note $note)
    {
        $this->authorize('update', $note);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'content' => 'sometimes|string',
            'tags' => 'sometimes|array',
            'summary' => 'sometimes|nullable|string',
        ]);

        $note->update($request->only([
            'title',
            'content',
            'tags',
            'summary',
        ]));

        // For API requests, return JSON
        if ($request->expectsJson()) {
            return response()->json($note);
        }

        // For Inertia requests, redirect back with success message
        return back()->with('success', 'Note updated successfully');
    }

    /**
     * Remove the specified note from storage.
     */
    public function destroy(Note $note): RedirectResponse
    {
        $this->authorize('delete', $note);

        $note->delete();

        return redirect()->back()
            ->with('success', 'Note deleted successfully');
    }

    public function enhance(Request $request, Note $note)
    {
        $this->authorize('update', $note);

        $request->validate([
            'action' => 'required|in:summarize,improve,generate_tags,insights',
        ]);
        $openAIService = new OpenAIService;

        // Determine typing speed settings based on the action or query parameters
        $typingSpeed = $request->input('typingSpeed', 'medium'); // default to medium
        $typingDelayMs = 30; // default medium speed (ms)

        switch ($typingSpeed) {
            case 'slow':
                $typingDelayMs = 70;
                break;
            case 'fast':
                $typingDelayMs = 10;
                break;
                // medium is default
        }

        return new StreamedResponse(function () use ($openAIService, $request, $note, $typingDelayMs) {
            // Send the content to OpenAI and stream back the results
            $openAIService->streamEnhancement(
                $note->content,
                $request->action,
                function ($chunk) use ($typingDelayMs) {
                    echo 'data: '.json_encode([
                        'chunk' => $chunk,
                        'typingDelayMs' => $typingDelayMs,
                    ])."\n\n";
                    flush();
                }
            );

            // Send a close event to notify the client that we're done
            echo "event: close\n";
            echo "data: {\"done\": true}\n\n";
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no', // Prevents buffering on Nginx
        ]);
    }

    public function saveEnhancement(Request $request, Note $note)
    {
        $this->authorize('update', $note);

        $request->validate([
            'type' => 'required|in:summary,tags,content',
            'data' => 'required',
        ]);

        switch ($request->type) {
            case 'summary':
                $note->update(['summary' => $request->data]);
                break;
            case 'tags':
                $note->update(['tags' => $request->data]);
                break;
            case 'content':
                $note->update(['content' => $request->data]);
                break;
        }

        return response()->json(['message' => 'Enhancement saved']);
    }
}
