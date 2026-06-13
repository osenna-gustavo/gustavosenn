import { useState, type DragEvent } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Trash2, Plus, CheckCircle2, Circle, ExternalLink, GripVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ProjectItem, ProjectSupplierOption } from '@/types/finance';
import { ProjectItemFormModal } from './ProjectItemFormModal';
import { ProjectOptionFormModal } from './ProjectOptionFormModal';

interface ProjectItemCardProps {
  item: ProjectItem;
  onUpdateItem: (data: { name: string; notes?: string }) => void;
  onDeleteItem: () => void;
  onAddOption: (option: Omit<ProjectSupplierOption, 'id'>) => void;
  onUpdateOption: (optionId: string, option: Omit<ProjectSupplierOption, 'id'>) => void;
  onDeleteOption: (optionId: string) => void;
  onSelectOption: (optionId: string | null) => void;
}

export function ProjectItemCard({
  item,
  onUpdateItem,
  onDeleteItem,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onSelectOption,
}: ProjectItemCardProps) {
  const [showItemForm, setShowItemForm] = useState(false);
  const [showOptionForm, setShowOptionForm] = useState(false);
  const [editingOption, setEditingOption] = useState<ProjectSupplierOption | null>(null);
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);
  const [showDeleteItem, setShowDeleteItem] = useState(false);

  const openOptionForm = (option?: ProjectSupplierOption) => {
    setEditingOption(option || null);
    setShowOptionForm(true);
  };

  const handleSaveOption = (data: Omit<ProjectSupplierOption, 'id'>) => {
    if (editingOption) {
      onUpdateOption(editingOption.id, data);
    } else {
      onAddOption(data);
    }
    setShowOptionForm(false);
    setEditingOption(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <h3 className="font-semibold">{item.name}</h3>
          {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowItemForm(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setShowDeleteItem(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma opção de fornecedor adicionada ainda.</p>
        ) : (
          <div className="space-y-2">
            {item.options.map((option) => {
              const isSelected = item.selectedOptionId === option.id;
              return (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-start justify-between gap-3 p-3 rounded-lg border",
                    isSelected ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectOption(isSelected ? null : option.id)}
                      title={isSelected ? "Desmarcar como fechado" : "Marcar como fechado"}
                      className="mt-0.5 shrink-0"
                    >
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{option.supplierName}</span>
                        {isSelected && <Badge>Fechado</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                        <span className="font-mono">{formatCurrency(option.price)}</span>
                        {option.deliveryTime && <span>Prazo: {option.deliveryTime}</span>}
                        {option.link && (
                          <a
                            href={option.link.startsWith('http') ? option.link : `https://${option.link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Link
                          </a>
                        )}
                      </div>
                      {option.notes && <p className="text-sm text-muted-foreground mt-1">{option.notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openOptionForm(option)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteOptionId(option.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="outline" size="sm" className="gap-2" onClick={() => openOptionForm()}>
          <Plus className="h-4 w-4" />
          Adicionar fornecedor
        </Button>
      </CardContent>

      <ProjectItemFormModal
        open={showItemForm}
        onClose={() => setShowItemForm(false)}
        onSave={(data) => { onUpdateItem(data); setShowItemForm(false); }}
        item={item}
      />

      <ProjectOptionFormModal
        open={showOptionForm}
        onClose={() => { setShowOptionForm(false); setEditingOption(null); }}
        onSave={handleSaveOption}
        option={editingOption}
      />

      <AlertDialog open={showDeleteItem} onOpenChange={setShowDeleteItem}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item e todas as opções de fornecedor serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onDeleteItem(); setShowDeleteItem(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteOptionId} onOpenChange={(o) => !o && setDeleteOptionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteOptionId) onDeleteOption(deleteOptionId); setDeleteOptionId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
