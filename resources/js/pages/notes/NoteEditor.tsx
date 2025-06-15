import AppLayout from '@/layouts/app-layout';
import AIEnhancement from '@/pages/Notes/Partials/AiEnhancement';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Eye, EyeOff, Save, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Import React Markdown and rehype plugins statically to improve load time
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Import Markdown rendering optimizations

interface NoteEditorProps {
    note: {
        id: number;
        title: string;
        content: string;
    };
    breadcrumbs: BreadcrumbItem[];
    success?: string;
}

export default function NoteEditor({ note, breadcrumbs }: NoteEditorProps) {
    const { success } = usePage().props as { success?: string };
    const [showAI, setShowAI] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);

    // Using Inertia's useForm hook for form state management and submission
    const form = useForm({
        title: note.title,
        content: note.content,
    });

    // Calculate word and character count
    useEffect(() => {
        const text = form.data.content;
        setCharCount(text.length);
        setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
    }, [form.data.content]);

    // Save note with Inertia form handling - wrapped in useCallback to avoid dependency issues
    const saveNote = useCallback(() => {
        // Skip if no changes
        if (form.data.title === note.title && form.data.content === note.content) return;

        form.put(`/notes/${note.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setLastSaved(new Date());
                toast.success('Note saved successfully!');
            },
            onError: (errors) => {
                console.error('Failed to save note:', errors);
                toast.error('Failed to save note');
            },
        });
    }, [form, note.id, note.title, note.content, setLastSaved]);

    // Auto-save functionality with optimized debounce timing
    useEffect(() => {
        if (!autoSaveEnabled) return;

        // Clear existing timeout to prevent multiple saves
        if (autoSaveTimeout.current) {
            clearTimeout(autoSaveTimeout.current);
        }

        // Only trigger save if there are actual changes
        if (form.data.title !== note.title || form.data.content !== note.content) {
            autoSaveTimeout.current = setTimeout(() => {
                saveNote();
            }, 2000); // Reduced from 5 seconds to 2 seconds for better user experience
        }

        return () => {
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
        };
    }, [form.data.title, form.data.content, saveNote, autoSaveEnabled, note.title, note.content]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveNote();
        }

        // Ctrl/Cmd + P to toggle preview mode
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={form.data.title || 'Untitled Note'} />

            <div className="mx-auto mt-4 w-4xl" onKeyDown={handleKeyDown}>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b p-4">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => router.visit('/dashboard')}
                                className="flex items-center gap-1.5 text-gray-600 transition-colors hover:text-gray-900"
                                aria-label="Back to notes"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                <span className="text-sm font-medium">Back</span>
                            </button>
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
                            <button
                                onClick={() => setIsPreviewMode(!isPreviewMode)}
                                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                                aria-label="Toggle preview mode"
                            >
                                {isPreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                <span>{isPreviewMode ? 'Edit' : 'Preview'}</span>
                            </button>

                            <button
                                onClick={() => setShowAI(!showAI)}
                                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 font-medium text-white shadow-md transition duration-200 ease-in-out hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg"
                                aria-label="Toggle AI enhancement panel"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span>AI Enhancement</span>
                            </button>
                        </div>
                    </div>

                    {/* Editor */}
                    <div className="p-6">
                        <input
                            type="text"
                            value={form.data.title}
                            onChange={(e) => form.setData('title', e.target.value)}
                            placeholder="Note title..."
                            className="mb-4 w-full resize-none rounded-lg border-none p-1 text-2xl font-bold text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-100"
                            disabled={isPreviewMode}
                        />
                        {form.errors.title && <div className="mt-1 text-sm text-red-500">{form.errors.title}</div>}

                        {isPreviewMode ? (
                            <div className="prose prose-slate prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:px-4 prose-pre:py-3 prose-img:mx-auto prose-img:rounded-lg max-w-none rounded-lg border border-gray-200 bg-white p-6 leading-relaxed shadow-sm">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        // Optimized paragraph with pre-wrap
                                        p: (props) => (
                                            <p style={{ whiteSpace: 'pre-wrap' }} {...props} />
                                        ),
                                        
                                        // Optimized headings with consistent styling
                                        h1: (props) => (
                                            <h1 className="mt-6 mb-4 text-3xl font-bold" {...props} />
                                        ),
                                        h2: (props) => (
                                            <h2 className="mt-5 mb-3 text-2xl font-bold" {...props} />
                                        ),
                                        h3: (props) => (
                                            <h3 className="mt-4 mb-2 text-xl font-bold" {...props} />
                                        ),
                                        h4: (props) => (
                                            <h4 className="mt-4 mb-2 text-lg font-bold" {...props} />
                                        ),
                                        
                                        // Enhanced code block handling
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
                                        
                                        // List item with pre-wrap for line breaks
                                        li: (props) => (
                                            <li style={{ whiteSpace: 'pre-wrap' }} className="my-1" {...props} />
                                        ),
                                        
                                        // Optimized text processor that only handles line breaks if needed
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
                                className="h-96 w-full resize-none rounded-lg border-none p-2 leading-relaxed text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-100"
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
                                {!autoSaveEnabled && (
                                    <button
                                        onClick={saveNote}
                                        disabled={form.processing}
                                        className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                                    >
                                        <Save className="h-3 w-3" />
                                        <span>Save</span>
                                    </button>
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
                </div>

                {/* AI Enhancement Panel */}
                {showAI && (
                    <div className="mt-6">
                        <div className="overflow-hidden rounded-xl border border-purple-100 bg-purple-50 shadow-sm">
                            <AIEnhancement
                                note={note}
                                content={form.data.content}
                                onContentUpdate={(newContent) => form.setData('content', newContent)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
