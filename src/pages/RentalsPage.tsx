import { useEffect, useMemo, useState } from 'react';
import { Home, Plus, Pencil, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { parseBRLToNumber } from '@/lib/currencyInput';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type RentalStatus = 'visitar' | 'visitado' | 'descartado';

interface RentalProperty {
  id: string;
  address: string;
  rent_amount: number;
  condo_amount: number;
  photo_url: string | null;
  listing_url: string | null;
  pros: string | null;
  cons: string | null;
  status: RentalStatus;
}

const STATUS_LABEL: Record<RentalStatus, string> = {
  visitar: 'Visitar',
  visitado: 'Visitado',
  descartado: 'Descartado',
};

const STATUS_CLASS: Record<RentalStatus, string> = {
  visitar: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  visitado: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  descartado: 'bg-muted text-muted-foreground border-border',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isValidUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

export const rentalTotal = (p: { rent_amount: number; condo_amount: number }) =>
  (Number(p.rent_amount) || 0) + (Number(p.condo_amount) || 0);

export function sortRentals<T extends { rent_amount: number; condo_amount: number; status: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const da = a.status === 'descartado' ? 1 : 0;
    const db = b.status === 'descartado' ? 1 : 0;
    if (da !== db) return da - db;
    return rentalTotal(a) - rentalTotal(b);
  });
}

interface FormState {
  address: string;
  rent: string;
  condo: string;
  photo_url: string;
  listing_url: string;
  pros: string;
  cons: string;
  status: RentalStatus;
}

const emptyForm: FormState = {
  address: '', rent: '', condo: '', photo_url: '', listing_url: '', pros: '', cons: '', status: 'visitar',
};

function Photo({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <div className="aspect-video w-full overflow-hidden bg-muted">
      {url && !broken ? (
        <img src={url} alt="Foto do imóvel" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Home className="h-12 w-12" />
        </div>
      )}
    </div>
  );
}

export function RentalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<RentalProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | RentalStatus>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rental_properties')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      toast({ title: 'Erro ao carregar imóveis', description: error.message, variant: 'destructive' });
    } else {
      setItems((data ?? []) as RentalProperty[]);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(
    () => sortRentals(filter === 'todos' ? items : items.filter(i => i.status === filter)),
    [items, filter],
  );

  const openNew = () => {
    setEditingId(null); setForm(emptyForm); setErrors({}); setDialogOpen(true);
  };

  const openEdit = (p: RentalProperty) => {
    setEditingId(p.id);
    setForm({
      address: p.address,
      rent: p.rent_amount > 0 ? Number(p.rent_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      condo: p.condo_amount > 0 ? Number(p.condo_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      photo_url: p.photo_url ?? '',
      listing_url: p.listing_url ?? '',
      pros: p.pros ?? '',
      cons: p.cons ?? '',
      status: p.status,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const liveTotal = parseBRLToNumber(form.rent || '0') + parseBRLToNumber(form.condo || '0');

  const save = async () => {
    const e: Record<string, string> = {};
    const address = form.address.trim();
    if (!address) e.address = 'Informe o endereço';
    else if (address.length > 300) e.address = 'Máximo de 300 caracteres';
    if (form.photo_url.trim() && !isValidUrl(form.photo_url)) e.photo_url = 'O link deve começar com http:// ou https://';
    if (form.listing_url.trim() && !isValidUrl(form.listing_url)) e.listing_url = 'O link deve começar com http:// ou https://';
    if (form.pros.length > 2000) e.pros = 'Máximo de 2000 caracteres';
    if (form.cons.length > 2000) e.cons = 'Máximo de 2000 caracteres';
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      address,
      rent_amount: parseBRLToNumber(form.rent || '0'),
      condo_amount: parseBRLToNumber(form.condo || '0'),
      photo_url: form.photo_url.trim() || null,
      listing_url: form.listing_url.trim() || null,
      pros: form.pros.trim() || null,
      cons: form.cons.trim() || null,
      status: form.status,
    };
    setSaving(true);
    const { error } = editingId
      ? await supabase.from('rental_properties').update(payload).eq('id', editingId)
      : await supabase.from('rental_properties').insert({ ...payload, user_id: user!.id });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar imóvel', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'Imóvel atualizado' : 'Imóvel cadastrado' });
    setDialogOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('rental_properties').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) {
      toast({ title: 'Erro ao excluir imóvel', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Imóvel excluído' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aluguel</h1>
          <p className="text-sm text-muted-foreground">Cadastre e compare imóveis para alugar</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="visitar">Visitar</SelectItem>
              <SelectItem value="visitado">Visitado</SelectItem>
              <SelectItem value="descartado">Descartado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo imóvel</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {items.length === 0 ? 'Nenhum imóvel cadastrado ainda.' : 'Nenhum imóvel com essa situação.'}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(p => (
            <Card key={p.id} data-testid="rental-card" className={cn('overflow-hidden flex flex-col', p.status === 'descartado' && 'opacity-50')}>
              <div className="relative">
                <Photo url={p.photo_url} />
                <Badge variant="outline" className={cn('absolute left-3 top-3 backdrop-blur', STATUS_CLASS[p.status])}>
                  {STATUS_LABEL[p.status]}
                </Badge>
              </div>
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <p className="font-semibold text-foreground break-words">{p.address}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Aluguel</span><span>{brl(Number(p.rent_amount))}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Condomínio</span><span>{brl(Number(p.condo_amount))}</span></div>
                  <div className="flex justify-between rounded-md bg-primary/10 px-2 py-1.5 font-semibold text-primary">
                    <span>Total do mês</span><span>{brl(rentalTotal(p))}</span>
                  </div>
                </div>
                {p.pros && (
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Pontos positivos</p>
                    <p className="whitespace-pre-line text-muted-foreground">{p.pros}</p>
                  </div>
                )}
                {p.cons && (
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Pontos negativos</p>
                    <p className="whitespace-pre-line text-muted-foreground">{p.cons}</p>
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  {p.listing_url && (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={p.listing_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />Ver anúncio
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Editar imóvel" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir imóvel" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar imóvel' : 'Novo imóvel'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-address">Endereço</Label>
              <Input id="r-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-rent">Aluguel</Label>
                <CurrencyInput id="r-rent" value={form.rent} onChange={v => setForm(f => ({ ...f, rent: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-condo">Condomínio</Label>
                <CurrencyInput id="r-condo" value={form.condo} onChange={v => setForm(f => ({ ...f, condo: v }))} />
              </div>
            </div>
            <div className="flex justify-between rounded-md bg-primary/10 px-3 py-2 font-semibold text-primary">
              <span>Total do mês</span><span>{brl(liveTotal)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-photo">Link da foto</Label>
              <Input id="r-photo" placeholder="https://..." value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} />
              {errors.photo_url && <p className="text-xs text-destructive">{errors.photo_url}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-listing">Link da imobiliária</Label>
              <Input id="r-listing" placeholder="https://..." value={form.listing_url} onChange={e => setForm(f => ({ ...f, listing_url: e.target.value }))} />
              {errors.listing_url && <p className="text-xs text-destructive">{errors.listing_url}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-pros">Pontos positivos</Label>
              <Textarea id="r-pros" rows={3} value={form.pros} onChange={e => setForm(f => ({ ...f, pros: e.target.value }))} />
              {errors.pros && <p className="text-xs text-destructive">{errors.pros}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-cons">Pontos negativos</Label>
              <Textarea id="r-cons" rows={3} value={form.cons} onChange={e => setForm(f => ({ ...f, cons: e.target.value }))} />
              {errors.cons && <p className="text-xs text-destructive">{errors.cons}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as RentalStatus }))}>
                <SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="visitar">Visitar</SelectItem>
                  <SelectItem value="visitado">Visitado</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este imóvel?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
