import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectItem } from '@/types/finance';
import { useDraft } from '@/hooks/useDraft';

interface ProjectItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; notes?: string }) => void;
  item?: ProjectItem | null;
  draftScope?: string;
}

export function ProjectItemFormModal({ open, onClose, onSave, item, draftScope }: ProjectItemFormModalProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const draftKey = item ? `draft:project-item:${item.id}` : `draft:project-item:new:${draftScope || 'global'}`;
  const { load: loadDraft, clear: clearDraft } = useDraft(draftKey, { name, notes }, open);

  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      if (draft && (draft.name || draft.notes)) {
        setName(draft.name || item?.name || '');
        setNotes(draft.notes || item?.notes || '');
      } else {
        setName(item?.name || '');
        setNotes(item?.notes || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), notes: notes.trim() || undefined });
    clearDraft();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item' : 'Novo Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Nome do item</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Piso da sala, Pedreiro, Tinta"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes sobre o que precisa ser comprado/contratado"
              rows={3}
            />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!name.trim()}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
