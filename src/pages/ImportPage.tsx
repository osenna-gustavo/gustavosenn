import { Upload, FileImage, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ImportPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Importar</h1>
        <p className="text-muted-foreground">Importe lançamentos de imagens ou PDFs</p>
      </div>

      <div className="glass-card rounded-xl p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Arraste arquivos aqui</h3>
          <p className="text-muted-foreground mb-4">ou clique para selecionar</p>
          <div className="flex gap-4">
            <Button variant="outline" className="gap-2">
              <FileImage className="h-4 w-4" />
              Imagem
            </Button>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
        <p>A funcionalidade de importação com OCR será implementada em breve.</p>
        <p className="text-sm mt-2">Por enquanto, use o lançamento manual rápido.</p>
      </div>
    </div>
  );
}
