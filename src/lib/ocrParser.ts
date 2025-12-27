import type { SuggestedTransaction, Category, TransactionType } from '@/types/finance';
import { v4 as uuid } from 'uuid';

// Common keywords for category suggestions
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': ['restaurante', 'lanchonete', 'mercado', 'supermercado', 'padaria', 'ifood', 'uber eats', 'rappi', 'açougue', 'hortifruti'],
  'Transporte': ['uber', '99', 'combustível', 'gasolina', 'álcool', 'estacionamento', 'pedágio', 'ônibus', 'metrô', 'táxi', 'posto'],
  'Moradia': ['aluguel', 'condomínio', 'iptu', 'luz', 'energia', 'água', 'gás', 'internet', 'telefone'],
  'Saúde': ['farmácia', 'drogaria', 'médico', 'consulta', 'exame', 'hospital', 'clínica', 'laboratório', 'plano de saúde'],
  'Lazer': ['cinema', 'teatro', 'show', 'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'bar', 'balada'],
  'Educação': ['escola', 'faculdade', 'curso', 'livro', 'material escolar', 'mensalidade'],
  'Compras': ['loja', 'shopping', 'roupa', 'calçado', 'eletrônico', 'eletrodoméstico', 'móvel'],
  'Assinaturas': ['assinatura', 'mensalidade', 'plano', 'netflix', 'spotify', 'amazon', 'disney'],
  'Contas/Taxas': ['taxa', 'tarifa', 'anuidade', 'iof', 'juros', 'multa'],
  'Salário': ['salário', 'salario', 'pagamento', 'remuneração', 'holerite', 'contracheque'],
  'Renda Extra': ['freelance', 'bônus', 'bonus', 'comissão', 'extra', 'dividendo'],
};

// Regex patterns for parsing
const CURRENCY_PATTERNS = [
  /R\$\s*([\d.,]+)/gi,                    // R$ 1.234,56
  /(\d{1,3}(?:\.\d{3})*,\d{2})/g,         // 1.234,56 (BRL format)
  /(\d+,\d{2})/g,                          // 123,45
];

const DATE_PATTERNS = [
  /(\d{2}\/\d{2}\/\d{4})/g,               // 25/12/2024
  /(\d{2}\/\d{2}\/\d{2})/g,               // 25/12/24
  /(\d{2}\/\d{2})/g,                       // 25/12
  /(\d{2}-\d{2}-\d{4})/g,                 // 25-12-2024
];

interface ParsedItem {
  amount: number;
  date?: Date;
  description: string;
  rawLine: string;
}

export function parseOCRText(text: string, categories: Category[]): SuggestedTransaction[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const suggestions: SuggestedTransaction[] = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseLine(line, currentYear, currentMonth);
    
    if (parsed) {
      const { categoryId, type } = suggestCategory(parsed.description, categories);
      
      suggestions.push({
        id: uuid(),
        date: parsed.date,
        amount: parsed.amount,
        type,
        description: parsed.description.slice(0, 100),
        suggestedCategoryId: categoryId,
        confirmed: false,
        needsReview: true,
        rawText: parsed.rawLine,
      });
    }
  }

  // Remove duplicates (same amount and similar description)
  const unique = suggestions.filter((item, index, self) => {
    return index === self.findIndex(t => 
      t.amount === item.amount && 
      t.description?.toLowerCase() === item.description?.toLowerCase()
    );
  });

  return unique;
}

function parseLine(line: string, currentYear: number, currentMonth: number): ParsedItem | null {
  // Try to find currency value
  let amount: number | null = null;
  
  for (const pattern of CURRENCY_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // Get the last match (usually the main amount)
      const valueStr = match[match.length - 1]
        .replace('R$', '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      
      const parsed = parseFloat(valueStr);
      if (!isNaN(parsed) && parsed > 0 && parsed < 1000000) {
        amount = parsed;
        break;
      }
    }
  }

  if (!amount) return null;

  // Try to find date
  let date: Date | undefined;
  
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const dateStr = match[0];
      const parts = dateStr.split(/[\/\-]/);
      
      if (parts.length >= 2) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        let year = currentYear;
        
        if (parts.length === 3) {
          year = parseInt(parts[2]);
          if (year < 100) year += 2000;
        }
        
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
          date = new Date(year, month, day);
        }
      }
      break;
    }
  }

  // If no date found, use current date
  if (!date) {
    date = new Date();
  }

  // Extract description (remove amount and date patterns)
  let description = line
    .replace(/R\$\s*[\d.,]+/gi, '')
    .replace(/\d{2}[\/\-]\d{2}[\/\-]?\d{0,4}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean up description
  description = description.slice(0, 80);

  return {
    amount,
    date,
    description: description || 'Item importado',
    rawLine: line,
  };
}

function suggestCategory(
  description: string, 
  categories: Category[]
): { categoryId: string | undefined; type: TransactionType } {
  const lowerDesc = description.toLowerCase();
  
  // Check for income keywords first
  const incomeKeywords = CATEGORY_KEYWORDS['Salário'] || [];
  const extraIncomeKeywords = CATEGORY_KEYWORDS['Renda Extra'] || [];
  
  if ([...incomeKeywords, ...extraIncomeKeywords].some(kw => lowerDesc.includes(kw))) {
    const incomeCategory = categories.find(c => c.type === 'receita');
    return { categoryId: incomeCategory?.id, type: 'receita' };
  }

  // Check expense keywords
  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      const category = categories.find(c => 
        c.name.toLowerCase() === categoryName.toLowerCase() && c.type === 'despesa'
      );
      if (category) {
        return { categoryId: category.id, type: 'despesa' };
      }
    }
  }

  // Default to first expense category or undefined
  const defaultCategory = categories.find(c => c.type === 'despesa');
  return { categoryId: defaultCategory?.id, type: 'despesa' };
}

export function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // This will be handled in the ImportPage component using pdfjs-dist
  return Promise.resolve('');
}
