export interface ScenarioCommitment {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  isFixed: boolean;
}

export interface ScenarioOneTimeCost {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  impactMonth: number;
  impactYear: number;
}

export interface ScenarioCategoryAdjustment {
  categoryId: string;
  originalAmount: number;
  adjustedAmount: number;
}

export interface ScenarioData {
  name: string;
  baselineType: 'planned' | 'realized' | 'average';
  referenceMonth: number;
  referenceYear: number;
  minimumBalance: number;
  commitments: ScenarioCommitment[];
  oneTimeCosts: ScenarioOneTimeCost[];
  categoryAdjustments: ScenarioCategoryAdjustment[];
}

export interface ScenarioResults {
  before: {
    income: number;
    expenses: number;
    fixed: number;
    variable: number;
    balance: number;
  };
  after: {
    income: number;
    expenses: number;
    fixed: number;
    variable: number;
    balance: number;
  };
  exceededCategories: {
    categoryId: string;
    categoryName: string;
    amount: number;
  }[];
  amountToCut: number;
  suggestions: {
    categoryId: string;
    categoryName: string;
    currentAmount: number;
    suggestedCut: number;
  }[];
}
