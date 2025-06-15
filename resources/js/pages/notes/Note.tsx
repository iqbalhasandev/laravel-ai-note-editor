import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, Bot, ChevronDown, ChevronUp, FileText, Pencil, Save, Sparkles, Tags, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Import React Markdown and rehype plugins statically to improve load time
import { Button } from '@headlessui/react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface NoteEditorProps {
    note: {
        id: number;
        title: string;
        content: string;
        tags?: string[];
        summary?: string;
    };
    breadcrumbs: BreadcrumbItem[];
    success?: string;
}

export default function Note({ note, breadcrumbs }: NoteEditorProps) {
    const { success } = usePage().props as { success?: string };
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChanges = useRef(false);
    const [isPreviewMode, setIsPreviewMode] = useState(true);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingSummary, setEditingSummary] = useState(false);

    // AI Enhancement states
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [activeAiTab, setActiveAiTab] = useState('summarize');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiResult, setAiResult] = useState('');
    const [aiStreamedContent, setAiStreamedContent] = useState('');
    const [aiCompleteContent, setAiCompleteContent] = useState('');
    const [aiTypingIndex, setAiTypingIndex] = useState(0);
    const [aiTypingSpeed, setAiTypingSpeed] = useState(50);
    const [userHasScrolled, setUserHasScrolled] = useState(false);

    const aiResultContainerRef = useRef<HTMLDivElement>(null);
    const aiTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const autoScrollEnabledRef = useRef<boolean>(true);

    // Using Inertia's useForm hook for form state management and submission
    const form = useForm({
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        summary: note.summary || '',
    });

    const aiTabs = [
        { id: 'summarize', label: 'Summarize', icon: <FileText className="h-4 w-4" /> },
        { id: 'improve', label: 'Improve', icon: <Sparkles className="h-4 w-4" /> },
        { id: 'generate_tags', label: 'Tags', icon: <Tags className="h-4 w-4" /> },
    ];

    // Calculate word and character count
    useEffect(() => {
        const text = form.data.content;
        setCharCount(text.length);
        setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
    }, [form.data.content]);

    // Save note with Inertia form handling - wrapped in useCallback to avoid dependency issues
    const saveNote = useCallback(() => {
        // Skip if no unsaved changes
        if (!hasUnsavedChanges.current) return;

        form.put(`/notes/${note.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setLastSaved(new Date());
                hasUnsavedChanges.current = false;
                toast.success('Note saved successfully!');
            },
            onError: (errors) => {
                console.error('Failed to save note:', errors);
                toast.error('Failed to save note');
            },
        });
    }, [form, note.id, setLastSaved]);

    // Detect changes to form data
    useEffect(() => {
        // Check for changes
        const hasChanges =
            form.data.title !== note.title ||
            form.data.content !== note.content ||
            JSON.stringify(form.data.tags) !== JSON.stringify(note.tags || []) ||
            form.data.summary !== (note.summary || '');

        hasUnsavedChanges.current = hasChanges;
    }, [form.data.title, form.data.content, form.data.tags, form.data.summary, note.title, note.content, note.tags, note.summary]);

    // Auto-save functionality with optimized debounce timing
    useEffect(() => {
        if (!autoSaveEnabled || !hasUnsavedChanges.current) return;

        // Clear existing timeout to prevent multiple saves
        if (autoSaveTimeout.current) {
            clearTimeout(autoSaveTimeout.current);
        }

        // Set up new timeout for auto-save
        autoSaveTimeout.current = setTimeout(() => {
            saveNote();
        }, 2000); // 2 seconds debounce time for better user experience

        return () => {
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
        };
    }, [form.data.title, form.data.content, form.data.tags, form.data.summary, autoSaveEnabled, saveNote]);

    // Track changes in title editing status
    useEffect(() => {
        // When exiting edit mode, check if the title has actually changed from the original note
        if (!editingTitle && form.data.title !== note.title) {
            // If autosave is enabled, save the changes
            if (autoSaveEnabled) {
                saveNote();
            }
        }
    }, [editingTitle, form.data.title, note.title, autoSaveEnabled, saveNote]);

    // Track changes in editing status
    useEffect(() => {
        // When exiting edit mode, check if the summary has actually changed from the original note
        if (!editingSummary && form.data.summary === note.summary) {
            // If summary hasn't changed from the original, don't trigger autosave
            hasUnsavedChanges.current = false;
        }
    }, [editingSummary, form.data.summary, note.summary]);

    // AI Enhancement scroll handling
    const handleAiScroll = useCallback(() => {
        if (!aiResultContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = aiResultContainerRef.current;
        const isScrolledToBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;

        if (!isScrolledToBottom && !userHasScrolled) {
            setUserHasScrolled(true);
            autoScrollEnabledRef.current = false;
        } else if (isScrolledToBottom && userHasScrolled) {
            setUserHasScrolled(false);
            autoScrollEnabledRef.current = true;
        }
    }, [userHasScrolled]);

    // Add scroll event listener for AI results
    useEffect(() => {
        const aiResultContainer = aiResultContainerRef.current;
        if (aiResultContainer) {
            aiResultContainer.addEventListener('scroll', handleAiScroll);
            return () => aiResultContainer.removeEventListener('scroll', handleAiScroll);
        }
    }, [handleAiScroll]);

    // Reset user scroll state when starting a new AI enhancement
    useEffect(() => {
        if (!aiIsLoading) {
            setUserHasScrolled(false);
            autoScrollEnabledRef.current = true;
        }
    }, [aiIsLoading]);

    // AI typing animation effect
    useEffect(() => {
        const animateTyping = () => {
            if (aiCompleteContent && aiTypingIndex < aiCompleteContent.length) {
                let charsToAdd = 1;
                if (aiTypingSpeed <= 10) {
                    charsToAdd = 3;
                } else if (aiTypingSpeed <= 30) {
                    charsToAdd = 2;
                }

                const newIndex = Math.min(aiTypingIndex + charsToAdd, aiCompleteContent.length);
                setAiStreamedContent(aiCompleteContent.substring(0, newIndex));
                setAiTypingIndex(newIndex);

                if (newIndex < aiCompleteContent.length) {
                    aiTypingTimerRef.current = setTimeout(animateTyping, aiTypingSpeed);
                }
            }
        };

        if (aiTypingIndex < aiCompleteContent.length) {
            aiTypingTimerRef.current = setTimeout(animateTyping, aiTypingSpeed);
        }

        if (aiResultContainerRef.current && autoScrollEnabledRef.current) {
            aiResultContainerRef.current.scrollTop = aiResultContainerRef.current.scrollHeight;
        }

        return () => {
            if (aiTypingTimerRef.current) {
                clearTimeout(aiTypingTimerRef.current);
            }
        };
    }, [aiCompleteContent, aiTypingIndex, aiTypingSpeed]);

    // AI Enhancement handler
    const handleAiEnhancement = async (action: string) => {
        if (!form.data.content.trim()) {
            toast.error('Please write some content first');
            return;
        }

        setUserHasScrolled(false);
        autoScrollEnabledRef.current = true;
        setAiIsLoading(true);
        setAiResult('');
        setAiStreamedContent('');
        setAiCompleteContent('');
        setAiTypingIndex(0);

        let accumulatedContent = '';

        try {
            await axios.post(
                route('notes.enhance', {
                    note: note.id,
                }),
                {
                    action: action,
                    typingSpeed: aiTypingSpeed === 70 ? 'slow' : aiTypingSpeed === 10 ? 'fast' : 'medium',
                    content: form.data.content, // Send content in the request body
                },
                {
                    onDownloadProgress: (progressEvent) => {
                        const responseText = progressEvent.event.target.responseText;

                        try {
                            // Handle streaming response
                            const lines = responseText.split('\n\n');
                            let latestContent = '';

                            for (const line of lines) {
                                if (line && line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.substring(6));
                                        if (data.chunk) {
                                            latestContent += data.chunk;

                                            if (data.typingDelayMs) {
                                                setAiTypingSpeed(data.typingDelayMs);
                                            }
                                        }
                                    } catch (e) {
                                        console.debug('Error parsing chunk:', e);
                                    }
                                }
                            }

                            if (latestContent) {
                                accumulatedContent = latestContent;

                                setAiCompleteContent((prevContent) => {
                                    if (prevContent.length - aiTypingIndex > 50) {
                                        setAiTypingIndex(prevContent.length - 30);
                                    }
                                    return accumulatedContent;
                                });
                            }
                        } catch (e) {
                            console.debug('Error processing response:', e);
                        }
                    },
                },
            );

            // Handle successful completion
            setAiResult(accumulatedContent);
            setAiIsLoading(false);

            if (accumulatedContent.length > 1000) {
                setAiTypingIndex(accumulatedContent.length);
                setAiStreamedContent(accumulatedContent);
            } else {
                setAiTypingSpeed(5);
            }
        } catch (error: unknown) {
            console.error('Enhancement failed:', error);
            setAiResult('Failed to enhance content. Please try again.');
            setAiIsLoading(false);
            setAiTypingIndex(0);
            setAiStreamedContent('');
        }

        // Set a timeout for the request
        setTimeout(() => {
            // If still loading after 60 seconds, consider it timed out
            if (aiIsLoading) {
                setAiResult(accumulatedContent || 'Enhancement timed out. Please try again.');
                setAiIsLoading(false);
                setAiTypingIndex(accumulatedContent.length);
                setAiStreamedContent(accumulatedContent);
            }
        }, 60000);
    };

    // Save AI enhancement
    const saveAiEnhancement = async (type: string, data: string | string[]) => {
        try {
            await axios.post(route('notes.saveEnhancement', { note: note.id }), { type, data });

            if (type === 'content') {
                form.setData('content', data as string);
            }

            // Mark that there are changes that need to be saved
            hasUnsavedChanges.current = true;

            toast.success('Enhancement saved successfully!');

            // If autosave is enabled, save the note after saving enhancements
            if (autoSaveEnabled) {
                saveNote();
            }
        } catch (error: unknown) {
            console.error('Failed to save enhancement:', error);
            toast.error('Failed to save enhancement');
        }
    };

    // Handle AI tab click
    const handleAiTabClick = (tabId: string) => {
        // Open AI panel if it's not already open
        if (!showAiPanel) {
            setShowAiPanel(true);
        }

        setActiveAiTab(tabId);
        setAiResult('');
        setAiStreamedContent('');

        if (form.data.content.trim()) {
            handleAiEnhancement(tabId);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (hasUnsavedChanges.current) {
                saveNote();
            }
        }

        // Ctrl/Cmd + E to toggle edit mode
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            setIsPreviewMode(!isPreviewMode);
        }
    };

    // Show success toast on initial load if there is a success message
    useEffect(() => {
        if (success) {
            toast.success(success);
        }
    }, [success]);

    const getAiButtonText = () => {
        if (aiIsLoading) {
            switch (activeAiTab) {
                case 'summarize':
                    return 'Generating Summary...';
                case 'improve':
                    return 'Improving Content...';
                case 'generate_tags':
                    return 'Generating Tags...';
                default:
                    return 'Processing...';
            }
        } else {
            switch (activeAiTab) {
                case 'summarize':
                    return 'Generate Summary';
                case 'improve':
                    return 'Improve Writing';
                case 'generate_tags':
                    return 'Generate Tags';
                default:
                    return 'Process';
            }
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={form.data.title || 'Untitled Note'} />

            <div className="mx-auto mt-4 w-4xl" onKeyDown={handleKeyDown}>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b p-4">
                        <div className="flex items-center space-x-4">
                            <Button
                                onClick={() => router.visit('/dashboard')}
                                className="flex items-center gap-1.5 text-gray-600 transition-colors hover:text-gray-900"
                                aria-label="Back to notes"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                <span className="text-sm font-medium">Back</span>
                            </Button>
                            <div className="flex items-center space-x-2">
                                {form.processing && (
                                    <div className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-blue-600 border-e-transparent align-[-0.125em]"></div>
                                )}
                                {lastSaved && !form.processing && (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                        <Save className="h-3.5 w-3.5" />
                                        <span>Saved {lastSaved.toLocaleTimeString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Button
                                onClick={() => setShowAiPanel(!showAiPanel)}
                                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:from-blue-600 hover:to-blue-700"
                                aria-label="Toggle AI Enhancement"
                            >
                                <Bot className="h-4 w-4" />
                                <span>AI Enhancement</span>
                                {showAiPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* AI Enhancement Panel */}
                    {showAiPanel && (
                        <div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                        <Bot className="h-5 w-5 text-blue-600" />
                                        AI Enhancement
                                    </h3>
                                    <Button
                                        onClick={() => setShowAiPanel(false)}
                                        className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* AI Tabs */}
                                <div className="mb-4 grid grid-cols-4 gap-2">
                                    {aiTabs.map((tab) => (
                                        <Button
                                            key={tab.id}
                                            onClick={() => handleAiTabClick(tab.id)}
                                            className={`flex flex-col items-center rounded-md py-2 transition duration-150 ease-in-out ${
                                                activeAiTab === tab.id
                                                    ? 'bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-300'
                                                    : 'text-gray-600 hover:bg-white hover:text-gray-800'
                                            }`}
                                        >
                                            <div className="mb-1">{tab.icon}</div>
                                            <span className="text-xs font-medium">{tab.label}</span>
                                        </Button>
                                    ))}
                                </div>

                                {/* AI Action Button */}
                                <div className="mb-4">
                                    <Button
                                        onClick={() => handleAiEnhancement(activeAiTab)}
                                        disabled={aiIsLoading || !form.data.content.trim()}
                                        className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 font-medium text-white shadow-sm transition duration-150 ease-in-out hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
                                    >
                                        {aiIsLoading ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                        ) : (
                                            aiTabs.find((tab) => tab.id === activeAiTab)?.icon
                                        )}
                                        <span>{getAiButtonText()}</span>
                                    </Button>
                                </div>

                                {/* AI Result Display */}
                                {(aiIsLoading || aiStreamedContent || aiResult) && (
                                    <div className="rounded-lg border border-gray-200 bg-white">
                                        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
                                            <h4 className="flex items-center gap-1.5 font-medium text-gray-700">
                                                <div
                                                    className={`h-2 w-2 rounded-full ${aiIsLoading ? 'animate-pulse bg-blue-500' : 'bg-green-500'}`}
                                                ></div>
                                                Result
                                            </h4>
                                            {userHasScrolled && aiIsLoading && (
                                                <Button
                                                    onClick={() => {
                                                        setUserHasScrolled(false);
                                                        autoScrollEnabledRef.current = true;
                                                        if (aiResultContainerRef.current) {
                                                            aiResultContainerRef.current.scrollTop = aiResultContainerRef.current.scrollHeight;
                                                        }
                                                    }}
                                                    className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-200"
                                                >
                                                    Auto-scroll
                                                </Button>
                                            )}
                                        </div>
                                        <div
                                            ref={aiResultContainerRef}
                                            className="max-h-64 overflow-y-auto p-3 font-mono text-sm whitespace-pre-wrap text-gray-700"
                                        >
                                            {aiIsLoading && !aiStreamedContent && (
                                                <div className="flex items-center justify-center space-x-2 py-8 text-gray-500">
                                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                                                    <span>Processing...</span>
                                                </div>
                                            )}

                                            {aiStreamedContent && (
                                                <div className="rounded-md bg-gray-50 p-3">
                                                    {aiStreamedContent}
                                                    {aiIsLoading && <span className="ml-1 animate-pulse font-bold">|</span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* AI Action Buttons */}
                                        {aiResult && (
                                            <div className="border-t border-gray-200 p-3">
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => {
                                                            if (activeAiTab === 'generate_tags') {
                                                                const newTags = aiResult.split(',').map((tag) => tag.trim());
                                                                form.setData('tags', newTags);
                                                                saveAiEnhancement('tags', newTags);
                                                            } else if (activeAiTab === 'improve') {
                                                                form.setData('content', aiResult);
                                                                saveAiEnhancement('content', aiResult);
                                                            } else if (activeAiTab === 'summarize') {
                                                                form.setData('summary', aiResult);
                                                                saveAiEnhancement('summary', aiResult);
                                                            }
                                                        }}
                                                        className="flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-green-500 to-green-600 px-3 py-2 font-medium text-white shadow-sm transition duration-150 ease-in-out hover:from-green-600 hover:to-green-700"
                                                    >
                                                        <span>
                                                            Save{' '}
                                                            {activeAiTab === 'generate_tags'
                                                                ? 'Tags'
                                                                : activeAiTab === 'improve'
                                                                  ? 'Content'
                                                                  : 'Summary'}
                                                        </span>
                                                    </Button>

                                                    <Button
                                                        onClick={() => {
                                                            setAiResult('');
                                                            setAiStreamedContent('');
                                                            handleAiEnhancement(activeAiTab);
                                                        }}
                                                        className="flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-gray-200 to-gray-300 px-3 py-2 font-medium text-gray-700 shadow-sm transition duration-150 ease-in-out hover:from-gray-300 hover:to-gray-400"
                                                    >
                                                        <span>Try Again</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Editor */}
                    <div className="p-6">
                        <div className="mb-6">
                            <div className="flex items-center justify-between">
                                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    Title
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setEditingTitle(!editingTitle)}
                                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        {editingTitle ? 'Done' : 'Edit'}
                                    </Button>
                                </div>
                            </div>

                            {editingTitle ? (
                                <input
                                    type="text"
                                    value={form.data.title}
                                    onChange={(e) => {
                                        form.setData('title', e.target.value);
                                        hasUnsavedChanges.current = true;
                                    }}
                                    placeholder="Note title..."
                                    className="focus:ring-opacity-50 w-full resize-none rounded-lg border-gray-300 p-2 text-xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-300 focus:ring focus:ring-blue-200"
                                    autoFocus
                                />
                            ) : (
                                <div className="w-full rounded-lg p-2 text-xl font-bold text-gray-900">
                                    {form.data.title || <span className="text-gray-400">Untitled Note</span>}
                                </div>
                            )}
                            {form.errors.title && <div className="mt-1 text-sm text-red-500">{form.errors.title}</div>}
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center justify-between">
                                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    Content
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        {isPreviewMode ? 'Edit' : 'Preview'}
                                    </Button>
                                    <Button
                                        onClick={() => handleAiTabClick('improve')}
                                        className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        <Bot className="h-3 w-3" />
                                        Generate Content
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {isPreviewMode ? (
                            <div className="">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        p: (props) => <p style={{ whiteSpace: 'pre-wrap' }} {...props} />,
                                        h1: (props) => <h1 className="mt-6 mb-4 text-3xl font-bold" {...props} />,
                                        h2: (props) => <h2 className="mt-5 mb-3 text-2xl font-bold" {...props} />,
                                        h3: (props) => <h3 className="mt-4 mb-2 text-xl font-bold" {...props} />,
                                        h4: (props) => <h4 className="mt-4 mb-2 text-lg font-bold" {...props} />,
                                        code: ({ className, ...props }) => {
                                            const isCodeBlock = className?.includes('language-');

                                            return isCodeBlock ? (
                                                <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 text-gray-100">
                                                    <code className={className} {...props} />
                                                </pre>
                                            ) : (
                                                <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-800" {...props} />
                                            );
                                        },
                                        li: (props) => <li style={{ whiteSpace: 'pre-wrap' }} className="my-1" {...props} />,
                                        text: ({ children }) => {
                                            if (typeof children !== 'string') return <>{children}</>;
                                            if (!children.includes('\n')) return <>{children}</>;

                                            return (
                                                <>
                                                    {children.split('\n').map((text, i) => (
                                                        <React.Fragment key={i}>
                                                            {i > 0 && <br />}
                                                            {text}
                                                        </React.Fragment>
                                                    ))}
                                                </>
                                            );
                                        },
                                    }}
                                >
                                    {form.data.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <textarea
                                value={form.data.content}
                                onChange={(e) => form.setData('content', e.target.value)}
                                placeholder="Start writing your note..."
                                className="focus:ring-opacity-50 h-96 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:outline-none"
                                style={{ minHeight: '24rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
                            />
                        )}
                        {form.errors.content && <div className="mt-1 text-sm text-red-500">{form.errors.content}</div>}

                        {/* Word count and autosave toggle */}
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                            <div>
                                {wordCount} {wordCount === 1 ? 'word' : 'words'} | {charCount} {charCount === 1 ? 'character' : 'characters'}
                            </div>
                            <div className="flex items-center space-x-3">
                                {(!autoSaveEnabled || hasUnsavedChanges.current) && (
                                    <Button
                                        onClick={saveNote}
                                        disabled={form.processing || !hasUnsavedChanges.current}
                                        className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                                    >
                                        <Save className="h-3 w-3" />
                                        <span>Save</span>
                                    </Button>
                                )}
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="autosave-toggle"
                                        checked={autoSaveEnabled}
                                        onChange={() => setAutoSaveEnabled(!autoSaveEnabled)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="autosave-toggle" className="cursor-pointer text-sm font-medium text-gray-700">
                                        Autosave
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tags and Summary Section */}
                    <div className="border-b px-6 py-4">
                        {/* Tags */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between">
                                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                    <Tags className="h-4 w-4 text-gray-500" />
                                    Tags
                                </h3>
                                <Button
                                    onClick={() => handleAiTabClick('generate_tags')}
                                    className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                >
                                    <Bot className="h-3 w-3" />
                                    Generate Tags
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {form.data.tags.length > 0 ? (
                                    form.data.tags.map((tag: string, index: number) => (
                                        <div key={index} className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800">
                                            {tag}
                                            <Button
                                                onClick={() => {
                                                    const newTags = [...form.data.tags];
                                                    newTags.splice(index, 1);
                                                    form.setData('tags', newTags);
                                                }}
                                                className="ml-1 rounded-full p-0.5 hover:bg-blue-200"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-500 italic">No tags yet</span>
                                )}
                                <input
                                    type="text"
                                    placeholder="Add tag..."
                                    className="focus:ring-opacity-50 inline-flex h-6 w-24 rounded-full border border-gray-300 px-3 py-1 text-xs focus:border-blue-300 focus:ring focus:ring-blue-200 focus:outline-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                            e.preventDefault();
                                            if (!form.data.tags.includes(e.currentTarget.value.trim())) {
                                                form.setData('tags', [...form.data.tags, e.currentTarget.value.trim()]);
                                            }
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Summary */}
                        <div>
                            <div className="flex items-center justify-between">
                                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    Summary
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => {
                                            if (editingSummary && hasUnsavedChanges.current) {
                                                // Save the note when finishing summary edit
                                                saveNote();
                                            }
                                            setEditingSummary(!editingSummary);
                                        }}
                                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        {editingSummary ? 'Done' : 'Edit'}
                                    </Button>
                                    <Button
                                        onClick={() => handleAiTabClick('summarize')}
                                        className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        <Bot className="h-3 w-3" />
                                        Generate Summary
                                    </Button>
                                </div>
                            </div>
                            {editingSummary ? (
                                <textarea
                                    value={form.data.summary}
                                    onChange={(e) => {
                                        form.setData('summary', e.target.value);
                                        // Mark that there are unsaved changes explicitly
                                        hasUnsavedChanges.current = true;
                                    }}
                                    placeholder="Add a summary for your note..."
                                    className="focus:ring-opacity-50 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:outline-none"
                                    rows={3}
                                />
                            ) : (
                                <p className="text-sm text-gray-700 italic">{form.data.summary ? form.data.summary : 'No summary yet'}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
