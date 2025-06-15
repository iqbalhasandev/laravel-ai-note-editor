<?php

namespace App\Services;

use OpenAI\Laravel\Facades\OpenAI;
use Illuminate\Support\Facades\Log;

class OpenAIService
{
    protected $model;

    public function __construct()
    {
        $this->model = config('openai.model');
    }

    public function streamEnhancement($content, $action, $callback)
    {
        try {
            $prompt = $this->getPromptForAction($action, $content);

            $stream = OpenAI::chat()->createStreamed([
                'model' => $this->model,
                'messages' => [
                    ['role' => 'user', 'content' => $prompt]
                ],
                'max_tokens' => 1000,
            ]);

            foreach ($stream as $response) {
                if (isset($response->choices[0]->delta->content)) {
                    $callback($response->choices[0]->delta->content);
                }
            }
        } catch (\Exception $e) {
            Log::error('OpenAI API error: ' . $e->getMessage());
            $callback("\nError: " . $e->getMessage() . "\n");
        }
    }

    private function getPromptForAction($action, $content)
    {
        switch ($action) {
            case 'summarize':
                return "Please provide a concise summary of the following text:\n\n" . $content;
            case 'improve':
                return "Please improve the writing quality, grammar, and clarity of the following text:\n\n" . $content;
            case 'generate_tags':
                return "Generate 5-8 relevant tags for the following content. Return only the tags as a comma-separated list:\n\n" . $content;
            case 'insights':
                return "Analyze the following text and provide insights about its key themes, tone, structure, and any notable patterns or issues. Format your response in a well-organized manner:\n\n" . $content;
            default:
                return $content;
        }
    }
}
