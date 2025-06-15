import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AIEnhancementProps {
    note: {
        id: number;
    };
    content: string;
    onContentUpdate: (content: string) => void;
}

export default function AIEnhancement({ note, content, onContentUpdate }: AIEnhancementProps) {
    const [activeTab, setActiveTab] = useState('summarize');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [streamedContent, setStreamedContent] = useState('');
    const [completeContent, setCompleteContent] = useState('');
    const [typingIndex, setTypingIndex] = useState(0);
    const [typingSpeed, setTypingSpeed] = useState(50); // default typing speed in ms
    const [userHasScrolled, setUserHasScrolled] = useState(false);

    const resultContainerRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const autoScrollEnabledRef = useRef<boolean>(true);

    const tabs = [
        { id: 'summarize', label: 'Summarize', icon: '📋' },
        { id: 'improve', label: 'Improve Writing', icon: '✨' },
        { id: 'generate_tags', label: 'Generate Tags', icon: '🏷️' },
    ];

    // Handle user scrolling to disable auto-scroll
    const handleScroll = useCallback(() => {
        if (!resultContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = resultContainerRef.current;
        const isScrolledToBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;

        // If user scrolls up, disable auto-scroll. If they scroll to bottom, re-enable it
        if (!isScrolledToBottom && !userHasScrolled) {
            setUserHasScrolled(true);
            autoScrollEnabledRef.current = false;
        } else if (isScrolledToBottom && userHasScrolled) {
            setUserHasScrolled(false);
            autoScrollEnabledRef.current = true;
        }
    }, [userHasScrolled]);

    // Add scroll event listener
    useEffect(() => {
        const resultContainer = resultContainerRef.current;
        if (resultContainer) {
            resultContainer.addEventListener('scroll', handleScroll);
            return () => resultContainer.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // Reset user scroll state when starting a new enhancement
    useEffect(() => {
        if (!isLoading) {
            setUserHasScrolled(false);
            autoScrollEnabledRef.current = true;
        }
    }, [isLoading]);

    // Effect to handle typing animation with improved performance
    useEffect(() => {
        // Use a recursive setTimeout for better typing animation
        const animateTyping = () => {
            if (completeContent && typingIndex < completeContent.length) {
                // Calculate how many characters to add based on speed
                // For slower speeds, add 1 character at a time
                // For faster speeds, add multiple characters to make it smoother
                let charsToAdd = 1;
                if (typingSpeed <= 10) {
                    charsToAdd = 3; // Add 3 chars at once for fast speed
                } else if (typingSpeed <= 30) {
                    charsToAdd = 2; // Add 2 chars for medium speed
                }

                // Make sure we don't go past the end
                const newIndex = Math.min(typingIndex + charsToAdd, completeContent.length);

                setStreamedContent(completeContent.substring(0, newIndex));
                setTypingIndex(newIndex);

                // If we have more to type, schedule the next update
                if (newIndex < completeContent.length) {
                    typingTimerRef.current = setTimeout(animateTyping, typingSpeed);
                }
            }
        };

        // Start animation if we have new content
        if (typingIndex < completeContent.length) {
            typingTimerRef.current = setTimeout(animateTyping, typingSpeed);
        }

        // Auto-scroll to the bottom when content updates (if enabled)
        if (resultContainerRef.current && autoScrollEnabledRef.current) {
            resultContainerRef.current.scrollTop = resultContainerRef.current.scrollHeight;
        }

        return () => {
            if (typingTimerRef.current) {
                clearTimeout(typingTimerRef.current);
            }
        };
    }, [completeContent, typingIndex, typingSpeed]);

    const handleEnhancement = async (action: string) => {
        if (!content.trim()) {
            alert('Please write some content first');
            return;
        }

        // Reset scroll state when starting a new enhancement
        setUserHasScrolled(false);
        autoScrollEnabledRef.current = true;

        setIsLoading(true);
        setResult('');
        setStreamedContent('');
        setCompleteContent('');
        setTypingIndex(0);

        let accumulatedContent = '';

        try {
            // Create the EventSource for server-sent events
            const eventSource = new EventSource(
                route('notes.enhance', {
                    note: note.id,
                    action: action,
                    typingSpeed: typingSpeed === 70 ? 'slow' : typingSpeed === 10 ? 'fast' : 'medium',
                }),
            );

            // Setup event handlers
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.chunk) {
                        // Check if this is a large chunk and split it if needed
                        const chunk = data.chunk;
                        accumulatedContent += chunk;

                        // Update the complete content which triggers the typing animation
                        setCompleteContent((prevContent) => {
                            // Check if typing index is far behind - if so, accelerate typing
                            if (prevContent.length - typingIndex > 50) {
                                setTypingIndex(prevContent.length - 30);
                            }
                            return accumulatedContent;
                        });

                        // Update typing speed if provided by server
                        if (data.typingDelayMs) {
                            setTypingSpeed(data.typingDelayMs);
                        }
                    }
                } catch {
                    // Ignore parsing errors
                    console.debug('Error parsing event data:', event.data);
                }
            };

            eventSource.onerror = () => {
                console.error('EventSource failed');
                eventSource.close();
                setIsLoading(false);
                // Show all content immediately on error
                setTypingIndex(accumulatedContent.length);
                setStreamedContent(accumulatedContent);
            };

            // When the connection closes, set the result
            eventSource.addEventListener('close', () => {
                eventSource.close();
                setResult(accumulatedContent);
                setIsLoading(false);

                // If content is very large, show it immediately without animation
                if (accumulatedContent.length > 1000) {
                    setTypingIndex(accumulatedContent.length);
                    setStreamedContent(accumulatedContent);
                } else {
                    // For shorter content, accelerate typing to finish quickly
                    setTypingSpeed(5);
                }
            });

            // Set a timeout to close the connection if it takes too long
            setTimeout(() => {
                if (eventSource.readyState !== EventSource.CLOSED) {
                    eventSource.close();
                    setResult(accumulatedContent || 'Enhancement timed out. Please try again.');
                    setIsLoading(false);
                    // Show all content immediately on timeout
                    setTypingIndex(accumulatedContent.length);
                    setStreamedContent(accumulatedContent);
                }
            }, 60000); // 1 minute timeout

            // The function returns here as we're now using event listeners
            // to handle the completion and error states
        } catch (error: unknown) {
            console.error('Enhancement failed:', error);
            setResult('Failed to enhance content. Please try again.');
            setIsLoading(false);
        }
    };

    const saveEnhancement = async (type: string, data: string | string[]) => {
        try {
            await axios.post(route('notes.saveEnhancement', { note: note.id }), { type, data });

            if (type === 'content') {
                onContentUpdate(data as string);
            }

            alert('Enhancement saved successfully!');
        } catch (error: unknown) {
            console.error('Failed to save enhancement:', error);
            alert('Failed to save enhancement');
        }
    };

    const handleRawPhpInsights = async () => {
        if (!content.trim()) {
            alert('Please write some content first');
            return;
        }

        // Reset scroll state when starting insights
        setUserHasScrolled(false);
        autoScrollEnabledRef.current = true;

        setIsLoading(true);
        setResult('');
        setStreamedContent('');
        setCompleteContent('');
        setTypingIndex(0);

        let accumulatedContent = '';

        try {
            // Create the EventSource for server-sent events
            const eventSource = new EventSource(
                route('notes.enhance', {
                    note: note.id,
                    action: 'insights',
                    typingSpeed: 'fast', // Insights can be a bit faster
                }),
            );

            // Setup event handlers
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.chunk) {
                        const chunk = data.chunk;
                        accumulatedContent += chunk;

                        // Update the complete content which triggers the typing animation
                        setCompleteContent((prevContent) => {
                            // Check if typing index is far behind - if so, accelerate typing
                            if (prevContent.length - typingIndex > 50) {
                                setTypingIndex(prevContent.length - 30);
                            }
                            return accumulatedContent;
                        });

                        // Update typing speed if provided by server
                        if (data.typingDelayMs) {
                            setTypingSpeed(data.typingDelayMs);
                        }
                    }
                } catch {
                    // Ignore parsing errors
                    console.debug('Error parsing event data:', event.data);
                }
            };

            eventSource.onerror = () => {
                console.error('EventSource failed');
                eventSource.close();
                setIsLoading(false);
                // Show all content immediately on error
                setTypingIndex(accumulatedContent.length);
                setStreamedContent(accumulatedContent);
            };

            // When the connection closes, set the result
            eventSource.addEventListener('close', () => {
                eventSource.close();
                setResult(accumulatedContent);
                setIsLoading(false);

                // If content is very large, show it immediately without animation
                if (accumulatedContent.length > 1000) {
                    setTypingIndex(accumulatedContent.length);
                    setStreamedContent(accumulatedContent);
                } else {
                    // For shorter content, accelerate typing to finish quickly
                    setTypingSpeed(5);
                }
            });

            // Set a timeout to close the connection if it takes too long
            setTimeout(() => {
                if (eventSource.readyState !== EventSource.CLOSED) {
                    eventSource.close();
                    setResult(accumulatedContent || 'Insights generation timed out. Please try again.');
                    setIsLoading(false);
                    // Show all content immediately on timeout
                    setTypingIndex(accumulatedContent.length);
                    setStreamedContent(accumulatedContent);
                }
            }, 60000); // 1 minute timeout
        } catch (error) {
            console.error('Raw insights error:', error);
            setResult('Failed to generate insights. Please try again.');
            setIsLoading(false);
        }
    };

    const renderActionButtons = () => {
        switch (activeTab) {
            case 'summarize':
                return (
                    <div className="space-y-2">
                        <button
                            onClick={() => handleEnhancement('summarize')}
                            disabled={isLoading}
                            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {isLoading ? 'Generating Summary...' : 'Generate Summary'}
                        </button>
                        {result && (
                            <button
                                onClick={() => saveEnhancement('summary', result)}
                                className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-green-700"
                            >
                                Save Summary
                            </button>
                        )}
                    </div>
                );
            case 'improve':
                return (
                    <div className="space-y-2">
                        <button
                            onClick={() => handleEnhancement('improve')}
                            disabled={isLoading}
                            className="w-full rounded-md bg-purple-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-purple-700 disabled:bg-purple-400"
                        >
                            {isLoading ? 'Improving Content...' : 'Improve Writing'}
                        </button>
                        {result && (
                            <button
                                onClick={() => saveEnhancement('content', result)}
                                className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-green-700"
                            >
                                Replace Note Content
                            </button>
                        )}
                    </div>
                );
            case 'generate_tags':
                return (
                    <div className="space-y-2">
                        <button
                            onClick={() => handleEnhancement('generate_tags')}
                            disabled={isLoading}
                            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-indigo-700 disabled:bg-indigo-400"
                        >
                            {isLoading ? 'Generating Tags...' : 'Generate Tags'}
                        </button>
                        {result && (
                            <button
                                onClick={() =>
                                    saveEnhancement(
                                        'tags',
                                        result.split(',').map((tag) => tag.trim()),
                                    )
                                }
                                className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-green-700"
                            >
                                Save Tags
                            </button>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-4">
                <h3 className="mb-4 text-lg font-medium text-gray-900">AI Enhancement</h3>

                {/* Tabs */}
                <div className="mb-4 flex space-x-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setResult('');
                                setStreamedContent('');
                            }}
                            className={`rounded-md px-4 py-2 text-sm font-medium transition duration-150 ease-in-out ${
                                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                    <div className="flex-1">{renderActionButtons()}</div>
                    <button
                        onClick={handleRawPhpInsights}
                        disabled={isLoading}
                        className="rounded-md bg-orange-600 px-4 py-2 font-medium text-white transition duration-150 ease-in-out hover:bg-orange-700 disabled:bg-orange-400"
                    >
                        📊 Raw PHP Insights
                    </button>
                </div>
            </div>

            {/* Result Display */}
            {(isLoading || streamedContent || result) && (
                <div className="bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Result:</h4>
                    </div>
                    {userHasScrolled && isLoading && (
                        <div className="mb-2 flex items-center justify-center rounded bg-yellow-50 px-2 py-1">
                            <div className="flex items-center">
                                <span className="text-xs text-yellow-700">Auto-scroll disabled.</span>
                                <button
                                    onClick={() => {
                                        setUserHasScrolled(false);
                                        autoScrollEnabledRef.current = true;
                                        if (resultContainerRef.current) {
                                            resultContainerRef.current.scrollTop = resultContainerRef.current.scrollHeight;
                                        }
                                    }}
                                    className="ml-2 rounded bg-yellow-200 px-2 py-1 text-xs text-yellow-800 hover:bg-yellow-300"
                                >
                                    Re-enable
                                </button>
                            </div>
                        </div>
                    )}
                    <div ref={resultContainerRef} className="max-h-64 min-h-24 overflow-y-auto rounded border bg-white p-3">
                        {isLoading && !streamedContent && (
                            <div className="flex items-center space-x-2 text-gray-500">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                                <span>Processing...</span>
                            </div>
                        )}

                        {streamedContent && (
                            <div className="font-mono whitespace-pre-wrap text-gray-700">
                                {streamedContent}
                                {isLoading && <span className="ml-1 animate-pulse font-bold">|</span>}
                            </div>
                        )}

                        {result && !isLoading && <div className="font-mono whitespace-pre-wrap text-gray-700">{result}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
