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
import { CurrencyInput } from '@/components/ui/currency-input';
import { parseBRLToNumber, formatNumberToBRL } from '@/lib/currencyInput';
import type { ProjectSupplierOption } from '@/types/finance';
import { useDraft } from '@/hooks/useDraft';

interface ProjectOptionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<ProjectSupplierOption, 'id'>) => void;
  option?: ProjectSupplierOption | null;
  draftScope?: string;
}

export function ProjectOptionFormModal({ open, onClose, onSave, option, draftScope }: ProjectOptionFormModalProps) {
  const [supplierName, setSupplierName] = useState('');
  const [price, setPrice] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');

  const draftKey = option
    ? `draft:project-option:${option.id}`
    : `draft:project-option:new:${draftScope || 'global'}`;
  const { load: loadDraft, clear: clearDraft } = useDraft(
    draftKey,
    { supplierName, price, deliveryTime, link, notes },
    open,
  );

  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      if (draft && (draft.supplierName || draft.price || draft.deliveryTime || draft.link || draft.notes)) {
        setSupplierName(draft.supplierName || option?.supplierName || '');
        setPrice(draft.price || (option ? formatNumberToBRL(option.price) : ''));
        setDeliveryTime(draft.deliveryTime || option?.deliveryTime || '');
        setLink(draft.link || option?.link || '');
        setNotes(draft.notes || option?.notes || '');
      } else {
        setSupplierName(option?.supplierName || '');
        setPrice(option ? formatNumberToBRL(option.price) : '');
        setDeliveryTime(option?.deliveryTime || '');
        setLink(option?.link || '');
        setNotes(option?.notes || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, option]);

  const handleSave = () => {
    if (!supplierName.trim()) return;
    onSave({
      supplierName: supplierName.trim(),
      price: parseBRLToNumber(price),
      deliveryTime: deliveryTime.trim() || undefined,
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    clearDraft();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{option ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Ex: Loja XPTO"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <CurrencyInput value={price} onChange={setPrice} />
            </div>
            <div className="space-y-2">
              <Label>Prazo de entrega</Label>
              <Input
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                placeholder="Ex: 15 dias, 30/07"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Link / contato (opcional)</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link do produto, telefone, etc"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes da cotação"
              rows={3}
            />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!supplierName.trim()}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
