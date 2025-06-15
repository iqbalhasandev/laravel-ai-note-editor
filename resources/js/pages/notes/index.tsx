import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Clock, Edit2, FilePlus, Search, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Note {
    id: number;
    title: string;
    content: string;
    tags?: string[];
    updated_at: string;
}

interface IndexProps {
    notes: Note[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'My Notes',
        href: '/notes',
    },
];

export default function Index({ notes }: IndexProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<number | null>(null);

    const filteredNotes = notes.filter(
        (note) => note.title.toLowerCase().includes(searchTerm.toLowerCase()) || note.content.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    // Create a new note using Inertia's useForm
    const noteForm = useForm({
        title: '',
        content: '',
    });

    // Reset form when dialog opens
    const handleOpenDialog = () => {
        noteForm.reset();
        noteForm.setData('title', '');
        noteForm.setData('content', '');
        setIsDialogOpen(true);
    };

    const createNewNote = () => {
        toast.promise(
            new Promise((resolve, reject) => {
                noteForm.post('/notes', {
                    onSuccess: (page) => {
                        // Close the dialog
                        setIsDialogOpen(false);
                        resolve(page);
                    },
                    onError: (errors) => {
                        reject(errors);
                    },
                });
            }),
            {
                loading: 'Creating your new note...',
                success: 'Note created successfully!',
                error: 'Failed to create note',
            },
        );
    };

    // Form for deleting notes
    const deleteForm = useForm({});

    const deleteNote = (noteId: number) => {
        toast.promise(
            new Promise((resolve, reject) => {
                deleteForm.delete(`/notes/${noteId}`, {
                    preserveScroll: true,
                    onSuccess: () => {
                        resolve('success');
                        router.reload();
                    },
                    onError: (error) => {
                        reject(error);
                    },
                });
            }),
            {
                loading: 'Deleting note...',
                success: 'Note deleted successfully!',
                error: 'Failed to delete note',
            },
        );
    };

    const openDeleteDialog = (noteId: number) => {
        setNoteToDelete(noteId);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (noteToDelete !== null) {
            deleteNote(noteToDelete);
        }
        setIsDeleteDialogOpen(false);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Notes</h1>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    onClick={handleOpenDialog}
                                    className="flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-medium text-white shadow-md transition duration-200 ease-in-out hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
                                >
                                    <FilePlus className="h-4 w-4" />
                                    New Note
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold">Create New Note</DialogTitle>
                                    <DialogDescription>Create a new note. You can edit the content further after creation.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <label htmlFor="title" className="text-sm font-medium">
                                            Title
                                        </label>
                                        <input
                                            id="title"
                                            type="text"
                                            value={noteForm.data.title}
                                            onChange={(e) => noteForm.setData('title', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            placeholder="Note title..."
                                        />
                                        {noteForm.errors.title && <p className="text-sm text-red-500">{noteForm.errors.title}</p>}
                                    </div>
                                    <div className="grid gap-2">
                                        <label htmlFor="content" className="text-sm font-medium">
                                            Initial Content
                                        </label>
                                        <textarea
                                            id="content"
                                            value={noteForm.data.content}
                                            onChange={(e) => noteForm.setData('content', e.target.value)}
                                            className="h-32 w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            placeholder="Start writing your note..."
                                        />
                                        {noteForm.errors.content && <p className="text-sm text-red-500">{noteForm.errors.content}</p>}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={createNewNote}
                                        disabled={noteForm.processing}
                                        className="ml-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                    >
                                        <FilePlus className="h-4 w-4" />
                                        {noteForm.processing ? 'Creating...' : 'Create Note'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="relative max-w-md">
                        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 pl-10 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredNotes.map((note: Note) => (
                            <div
                                key={note.id}
                                className="group rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:scale-[1.01] hover:border-blue-300 hover:shadow-md"
                            >
                                <div className="p-6">
                                    <div className="mb-4 flex items-start justify-between">
                                        <h3 className="truncate text-lg font-semibold text-gray-900">{note.title}</h3>
                                        <button
                                            onClick={() => openDeleteDialog(note.id)}
                                            className="text-gray-400 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:text-red-600"
                                            aria-label="Delete note"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <p className="mb-5 line-clamp-3 min-h-[3rem] text-sm text-gray-600">
                                        {note.content ? note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '') : 'Empty note'}
                                    </p>

                                    {note.tags && note.tags.length > 0 && (
                                        <div className="mb-4 flex flex-wrap gap-1.5">
                                            {note.tags.slice(0, 3).map((tag: string, index: number) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                                >
                                                    <Tag className="h-3 w-3" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                            <Clock className="h-3 w-3" />
                                            {new Date(note.updated_at).toLocaleDateString()}
                                        </span>
                                        <Link
                                            href={`/notes/${note.id}`}
                                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                            Edit
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredNotes.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border bg-gray-50 py-16 text-center">
                            <div className="mb-4 rounded-full bg-blue-100 p-3">
                                <FilePlus className="h-8 w-8 text-blue-600" />
                            </div>
                            <div className="mb-4 text-lg font-medium text-gray-700">
                                {searchTerm ? 'No notes found matching your search.' : 'No notes yet.'}
                            </div>
                            {!searchTerm && (
                                <Button onClick={handleOpenDialog} variant="outline" className="font-medium text-blue-600 hover:text-blue-800">
                                    Create your first note
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your note and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 text-white hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
