import type { DragEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, FolderOpen, ListChecks, CheckCircle2, GripVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/finance';
import { PROJECT_STATUS_LABELS } from './ProjectFormModal';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}

const STATUS_CLASSES: Record<Project['status'], string> = {
  planning: 'bg-muted text-muted-foreground border-transparent',
  in_progress: 'bg-primary/10 text-primary border-transparent',
  completed: 'bg-success/10 text-success border-transparent',
  archived: 'bg-secondary text-secondary-foreground border-transparent',
};

export function ProjectCard({
  project,
  onOpen,
  onEdit,
  onDelete,
  draggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ProjectCardProps) {
  const closedItems = project.items.filter(i => i.selectedOptionId);
  const totalClosed = closedItems.reduce((sum, item) => {
    const option = item.options.find(o => o.id === item.selectedOptionId);
    return sum + (option?.price || 0);
  }, 0);

  return (
    <Card
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "hover:border-primary/50 transition-colors flex flex-col",
        isDragging && "opacity-50",
        isDragOver && "border-primary border-dashed"
      )}
    >
      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {draggable && (
              <div className="cursor-grab active:cursor-grabbing pt-1 text-muted-foreground" title="Arraste para reordenar">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
              <Badge className={cn("mt-1", STATUS_CLASSES[project.status])}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
        )}

        <div className="space-y-1.5 mb-4 text-sm text-muted-foreground mt-auto">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span>{project.items.length} item(ns)</span>
          </div>
          {closedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {closedItems.length} fechado(s) • {formatCurrency(totalClosed)}
              </span>
            </div>
          )}
        </div>

        <Button onClick={onOpen} className="w-full gap-2">
          <FolderOpen className="h-4 w-4" />
          Abrir Projeto
        </Button>
      </CardContent>
    </Card>
  );
}
