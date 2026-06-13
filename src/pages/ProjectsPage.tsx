import { useState, useEffect, type DragEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FolderKanban, Plus, ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import * as db from '@/lib/supabase-database';
import type { Project, ProjectItem, ProjectSupplierOption } from '@/types/finance';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectFormModal, PROJECT_STATUS_LABELS } from '@/components/projects/ProjectFormModal';
import { ProjectItemFormModal } from '@/components/projects/ProjectItemFormModal';
import { ProjectItemCard } from '@/components/projects/ProjectItemCard';
import { cn } from '@/lib/utils';
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

const STATUS_CLASSES: Record<Project['status'], string> = {
  planning: 'bg-muted text-muted-foreground border-transparent',
  in_progress: 'bg-primary/10 text-primary border-transparent',
  completed: 'bg-success/10 text-success border-transparent',
  archived: 'bg-secondary text-secondary-foreground border-transparent',
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [itemDragIndex, setItemDragIndex] = useState<number | null>(null);
  const [itemDragOverIndex, setItemDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await db.getProjects();
        setProjects(loaded);
      } catch (error) {
        console.error('Error loading projects:', error);
        toast.error('Erro ao carregar projetos');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const persistProject = async (updated: Project) => {
    try {
      await db.updateProject(updated);
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActiveProject(updated);
    } catch (error) {
      toast.error('Erro ao salvar projeto');
    }
  };

  const handleSaveProjectForm = async (data: { name: string; description?: string; status: Project['status'] }) => {
    try {
      if (editingProject) {
        const updated = { ...editingProject, ...data };
        await db.updateProject(updated);
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
        if (activeProject?.id === updated.id) setActiveProject(updated);
        toast.success('Projeto atualizado!');
      } else {
        const position = projects.length > 0 ? Math.min(...projects.map(p => p.position)) - 1 : 0;
        const newProject = await db.addProject({ ...data, items: [], position });
        setProjects(prev => [newProject, ...prev]);
        toast.success('Projeto criado!');
      }
      setShowFormModal(false);
      setEditingProject(null);
    } catch (error) {
      toast.error('Erro ao salvar projeto');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteId) return;
    try {
      await db.deleteProject(deleteId);
      setProjects(prev => prev.filter(p => p.id !== deleteId));
      if (activeProject?.id === deleteId) setActiveProject(null);
      toast.success('Projeto excluído!');
    } catch (error) {
      toast.error('Erro ao excluir projeto');
    } finally {
      setDeleteId(null);
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setShowFormModal(true);
  };

  // ===== Drag-and-drop reordering =====

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const reordered = [...projects];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    const withPositions = reordered.map((p, i) => ({ ...p, position: i }));
    setProjects(withPositions);
    handleDragEnd();

    try {
      await db.reorderProjects(withPositions.map(p => ({ id: p.id, position: p.position })));
    } catch (error) {
      toast.error('Erro ao salvar a nova ordem dos projetos');
    }
  };

  // ===== Item operations =====

  const handleAddItem = (data: { name: string; notes?: string }) => {
    if (!activeProject) return;
    const newItem: ProjectItem = {
      id: uuidv4(),
      name: data.name,
      notes: data.notes,
      options: [],
    };
    persistProject({ ...activeProject, items: [...activeProject.items, newItem] });
    setShowItemForm(false);
  };

  const handleUpdateItem = (itemId: string, data: { name: string; notes?: string }) => {
    if (!activeProject) return;
    persistProject({
      ...activeProject,
      items: activeProject.items.map(item => item.id === itemId ? { ...item, ...data } : item),
    });
  };

  const handleDeleteItem = (itemId: string) => {
    if (!activeProject) return;
    persistProject({
      ...activeProject,
      items: activeProject.items.filter(item => item.id !== itemId),
    });
  };

  const handleAddOption = (itemId: string, option: Omit<ProjectSupplierOption, 'id'>) => {
    if (!activeProject) return;
    const newOption: ProjectSupplierOption = { ...option, id: uuidv4() };
    persistProject({
      ...activeProject,
      items: activeProject.items.map(item =>
        item.id === itemId ? { ...item, options: [...item.options, newOption] } : item
      ),
    });
  };

  const handleUpdateOption = (itemId: string, optionId: string, option: Omit<ProjectSupplierOption, 'id'>) => {
    if (!activeProject) return;
    persistProject({
      ...activeProject,
      items: activeProject.items.map(item =>
        item.id === itemId
          ? { ...item, options: item.options.map(o => o.id === optionId ? { ...option, id: optionId } : o) }
          : item
      ),
    });
  };

  const handleDeleteOption = (itemId: string, optionId: string) => {
    if (!activeProject) return;
    persistProject({
      ...activeProject,
      items: activeProject.items.map(item =>
        item.id === itemId
          ? {
              ...item,
              options: item.options.filter(o => o.id !== optionId),
              selectedOptionId: item.selectedOptionId === optionId ? undefined : item.selectedOptionId,
            }
          : item
      ),
    });
  };

  const handleSelectOption = (itemId: string, optionId: string | null) => {
    if (!activeProject) return;
    persistProject({
      ...activeProject,
      items: activeProject.items.map(item =>
        item.id === itemId ? { ...item, selectedOptionId: optionId || undefined } : item
      ),
    });
  };

  // ===== Item drag-and-drop reordering =====

  const handleItemDragStart = (index: number) => setItemDragIndex(index);
  const handleItemDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (itemDragOverIndex !== index) setItemDragOverIndex(index);
  };
  const handleItemDragEnd = () => {
    setItemDragIndex(null);
    setItemDragOverIndex(null);
  };
  const handleItemDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!activeProject || itemDragIndex === null || itemDragIndex === dropIndex) {
      handleItemDragEnd();
      return;
    }
    const reordered = [...activeProject.items];
    const [moved] = reordered.splice(itemDragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    handleItemDragEnd();
    persistProject({ ...activeProject, items: reordered });
  };

  // ===== Detail view =====

  if (activeProject) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setActiveProject(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-bold truncate">{activeProject.name}</h1>
                <Badge className={cn(STATUS_CLASSES[activeProject.status])}>
                  {PROJECT_STATUS_LABELS[activeProject.status]}
                </Badge>
              </div>
              {activeProject.description && (
                <p className="text-muted-foreground">{activeProject.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => openEditModal(activeProject)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button onClick={() => setShowItemForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Item
            </Button>
          </div>
        </div>

        {activeProject.items.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum item ainda</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Adicione itens para esse projeto (ex: piso, tinta, pedreiro) e compare
              opções de fornecedores para cada um.
            </p>
            <Button onClick={() => setShowItemForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeProject.items.map(item => (
              <ProjectItemCard
                key={item.id}
                item={item}
                onUpdateItem={(data) => handleUpdateItem(item.id, data)}
                onDeleteItem={() => handleDeleteItem(item.id)}
                onAddOption={(option) => handleAddOption(item.id, option)}
                onUpdateOption={(optionId, option) => handleUpdateOption(item.id, optionId, option)}
                onDeleteOption={(optionId) => handleDeleteOption(item.id, optionId)}
                onSelectOption={(optionId) => handleSelectOption(item.id, optionId)}
              />
            ))}
          </div>
        )}

        <ProjectItemFormModal
          open={showItemForm}
          onClose={() => setShowItemForm(false)}
          onSave={handleAddItem}
        />

        <ProjectFormModal
          open={showFormModal}
          onClose={() => { setShowFormModal(false); setEditingProject(null); }}
          onSave={handleSaveProjectForm}
          project={editingProject}
        />
      </div>
    );
  }

  // ===== List view =====

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Projetos</h1>
          <p className="text-muted-foreground">Pesquise e compare fornecedores para seus projetos</p>
        </div>
        <Button onClick={() => setShowFormModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Crie um projeto para organizar a pesquisa de orçamento de algo específico,
            como uma reforma, e compare preços e prazos de diferentes fornecedores.
          </p>
          <Button onClick={() => setShowFormModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Primeiro Projeto
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => setActiveProject(project)}
              onEdit={() => openEditModal(project)}
              onDelete={() => setDeleteId(project.id)}
              draggable
              isDragging={dragIndex === index}
              isDragOver={dragOverIndex === index && dragIndex !== null && dragIndex !== index}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            />
          ))}
          <Card
            className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setShowFormModal(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Novo Projeto</p>
            </CardContent>
          </Card>
        </div>
      )}

      <ProjectFormModal
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingProject(null); }}
        onSave={handleSaveProjectForm}
        project={editingProject}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O projeto e todos os seus itens serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
