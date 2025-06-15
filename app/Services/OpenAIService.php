<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;

class OpenAIService
{
    protected $client;
    protected $apiKey;
    protected $model;

    public function __construct()
    {
        $this->client = new Client();
        $this->apiKey = config('services.openai.api_key');
        $this->model = config('services.openai.model');
    }

    public function streamEnhancement($content, $action, $callback)
    {
        try {
            $prompt = $this->getPromptForAction($action, $content);

            $headers = [
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ];

            $body = json_encode([
                'model' => $this->model,
                'messages' => [
                    ['role' => 'user', 'content' => $prompt]
                ],
                'stream' => true,
                'max_tokens' => 1000,
            ]);

            $request = new Request('POST', 'https://api.openai.com/v1/chat/completions', $headers, $body);

            $response = $this->client->send($request, ['stream' => true, 'timeout' => 30]);
            $stream = $response->getBody();

            while (!$stream->eof()) {
                $line = $stream->read(1024);
                $lines = explode("\n", $line);

                foreach ($lines as $line) {
                    if (strpos($line, 'data: ') === 0) {
                        $data = substr($line, 6);
                        if ($data === '[DONE]') {
                            break 2;
                        }

                        $json = json_decode($data, true);
                        if ($json && isset($json['choices'][0]['delta']['content'])) {
                            $callback($json['choices'][0]['delta']['content']);
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            // Send error message to the client
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
