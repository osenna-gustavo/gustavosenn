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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project } from '@/types/finance';
import { useDraft } from '@/hooks/useDraft';

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string; status: Project['status'] }) => void;
  project?: Project | null;
}

export const PROJECT_STATUS_LABELS: Record<Project['status'], string> = {
  planning: 'Planejamento',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  archived: 'Arquivado',
};

export function ProjectFormModal({ open, onClose, onSave, project }: ProjectFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('planning');

  const draftKey = project ? `draft:project:${project.id}` : 'draft:project:new';
  const { load: loadDraft, clear: clearDraft } = useDraft(
    draftKey,
    { name, description, status },
    open,
  );

  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      if (draft && (draft.name || draft.description)) {
        setName(draft.name || project?.name || '');
        setDescription(draft.description || project?.description || '');
        setStatus(draft.status || project?.status || 'planning');
      } else {
        setName(project?.name || '');
        setDescription(project?.description || '');
        setStatus(project?.status || 'planning');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() || undefined, status });
    clearDraft();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{project ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Nome do projeto</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reforma do apartamento"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes gerais sobre o projeto"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as Project['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!name.trim()}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
