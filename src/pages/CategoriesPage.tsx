import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Category, Subcategory } from '@/types/finance';
import { cn } from '@/lib/utils';

const EMOJI_OPTIONS = ['📱', '🏠', '🚗', '🍽️', '💊', '🎮', '📚', '🛒', '📄', '📦', '💰', '✈️', '👕', '🎁', '🔧', '💼'];

export function CategoriesPage() {
  const { 
    categories, 
    subcategories, 
    addCategory, 
    updateCategory, 
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory
  } = useApp();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubFormOpen, setIsSubFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'subcategory'; id: string } | null>(null);
  
  const [formData, setFormData] = useState({ name: '', icon: '📦', isFixed: false, type: 'despesa' as 'receita' | 'despesa' });
  const [subFormData, setSubFormData] = useState({ name: '', isFixed: false });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const openCategoryForm = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, icon: category.icon || '📦', isFixed: category.isFixed, type: category.type });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', icon: '📦', isFixed: false, type: 'despesa' });
    }
    setIsFormOpen(true);
  };

  const openSubcategoryForm = (categoryId: string, subcategory?: Subcategory) => {
    setSelectedCategoryId(categoryId);
    if (subcategory) {
      setEditingSubcategory(subcategory);
      setSubFormData({ name: subcategory.name, isFixed: subcategory.isFixed });
    } else {
      setEditingSubcategory(null);
      setSubFormData({ name: '', isFixed: false });
    }
    setIsSubFormOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory({ ...editingCategory, ...formData });
        toast({ title: 'Categoria atualizada!' });
      } else {
        await addCategory(formData);
        toast({ title: 'Categoria criada!' });
      }
      setIsFormOpen(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleSaveSubcategory = async () => {
    if (!subFormData.name.trim() || !selectedCategoryId) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }

    try {
      if (editingSubcategory) {
        await updateSubcategory({ ...editingSubcategory, ...subFormData });
        toast({ title: 'Subcategoria atualizada!' });
      } else {
        await addSubcategory({ ...subFormData, categoryId: selectedCategoryId });
        toast({ title: 'Subcategoria criada!' });
      }
      setIsSubFormOpen(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'category') {
        await deleteCategory(deleteTarget.id);
        toast({ title: 'Categoria excluída!' });
      } else {
        await deleteSubcategory(deleteTarget.id);
        toast({ title: 'Subcategoria excluída!' });
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Categorias</h1>
          <p className="text-muted-foreground">
            Gerencie suas categorias e subcategorias
          </p>
        </div>
        <Button onClick={() => openCategoryForm()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Categories List */}
      <div className="glass-card rounded-xl divide-y divide-border">
        {categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma categoria criada.
          </div>
        ) : (
          categories.map((category) => {
            const subs = subcategories.filter(s => s.categoryId === category.id);
            const isExpanded = expandedCategory === category.id;
            
            return (
              <div key={category.id}>
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{category.name}</span>
                        {category.isFixed && (
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            Fixo
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {subs.length} subcategoria{subs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform ml-auto mr-2",
                      isExpanded && "rotate-90"
                    )} />
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openSubcategoryForm(category.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openCategoryForm(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget({ type: 'category', id: category.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Subcategories */}
                {isExpanded && subs.length > 0 && (
                  <div className="bg-muted/30 divide-y divide-border/50">
                    {subs.map((sub) => (
                      <div 
                        key={sub.id}
                        className="flex items-center justify-between px-4 py-3 pl-16"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{sub.name}</span>
                          {sub.isFixed && (
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              Fixo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openSubcategoryForm(category.id, sub)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget({ type: 'subcategory', id: sub.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Category Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                    className={cn(
                      "h-10 w-10 rounded-lg text-xl flex items-center justify-center transition-all",
                      formData.icon === emoji 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Alimentação"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.type === 'despesa' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData(prev => ({ ...prev, type: 'despesa' }))}
                >
                  Despesa
                </Button>
                <Button
                  type="button"
                  variant={formData.type === 'receita' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData(prev => ({ ...prev, type: 'receita' }))}
                >
                  Receita
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Custo Fixo (Previsto)</Label>
              <Switch
                checked={formData.isFixed}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFixed: checked }))}
              />
            </div>
            <Button onClick={handleSaveCategory} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subcategory Form Dialog */}
      <Dialog open={isSubFormOpen} onOpenChange={setIsSubFormOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={subFormData.name}
                onChange={(e) => setSubFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Restaurante"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Custo Fixo (Previsto)</Label>
              <Switch
                checked={subFormData.isFixed}
                onCheckedChange={(checked) => setSubFormData(prev => ({ ...prev, isFixed: checked }))}
              />
            </div>
            <Button onClick={handleSaveSubcategory} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {deleteTarget?.type === 'category' ? 'categoria' : 'subcategoria'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
