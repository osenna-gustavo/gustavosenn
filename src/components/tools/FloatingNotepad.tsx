import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StickyNote, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

interface FloatingNotepadProps {
  open: boolean;
  onClose: () => void;
}

export function FloatingNotepad({ open, onClose }: FloatingNotepadProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setNotes((data as Note[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) fetchNotes();
  }, [open, fetchNotes]);

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleNew = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    if (selectedNote) {
      await supabase
        .from('user_notes')
        .update({ title, content })
        .eq('id', selectedNote.id);
    } else {
      const { data } = await supabase
        .from('user_notes')
        .insert({ user_id: user.id, title: title || 'Sem título', content })
        .select()
        .single();
      if (data) setSelectedNote(data as Note);
    }

    toast.success('Nota salva');
    setSaving(false);
    fetchNotes();
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    await supabase.from('user_notes').delete().eq('id', selectedNote.id);
    handleNew();
    toast.success('Nota excluída');
    fetchNotes();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[440px] flex flex-col p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Bloco de Notas
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Notes list */}
          <div className="border-b border-border px-4 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={handleNew} className="gap-1">
                <Plus className="h-3 w-3" /> Nova
              </Button>
            </div>
            <ScrollArea className="h-28">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota ainda</p>
              ) : (
                <div className="space-y-1">
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => selectNote(note)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedNote?.id === note.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <p className="font-medium truncate">{note.title || 'Sem título'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(note.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
            <Input
              placeholder="Título da nota"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Escreva suas anotações aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 min-h-[200px] resize-none"
            />
            <div className="flex gap-2 justify-end">
              {selectedNote && (
                <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
                  <Trash2 className="h-3 w-3" /> Excluir
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
