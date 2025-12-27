import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage, formatMonthYear } from '@/lib/formatters';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = [
  'hsl(152, 76%, 50%)',
  'hsl(190, 95%, 55%)',
  'hsl(38, 92%, 55%)',
  'hsl(0, 72%, 55%)',
  'hsl(270, 70%, 65%)',
  'hsl(200, 80%, 60%)',
  'hsl(160, 60%, 50%)',
  'hsl(45, 85%, 55%)',
];

export function ExpenseChart() {
  const { monthSummary, categories, selectedMonth, selectedYear } = useApp();

  if (!monthSummary) {
    return (
      <div className="glass-card rounded-xl p-4 lg:p-6 h-[300px] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-32 w-32 rounded-full bg-muted" />
        </div>
      </div>
    );
  }

  const chartData = monthSummary.categoryBreakdown
    .filter(c => c.realized > 0)
    .sort((a, b) => b.realized - a.realized)
    .slice(0, 8)
    .map((cat, index) => ({
      name: cat.categoryName,
      value: cat.realized,
      percentage: monthSummary.realizedExpenses > 0 
        ? (cat.realized / monthSummary.realizedExpenses) * 100 
        : 0,
      color: COLORS[index % COLORS.length],
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)} ({formatPercentage(data.percentage, 1)})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card rounded-xl p-4 lg:p-6">
      <h3 className="text-lg font-semibold mb-4">
        Despesas por Categoria
      </h3>

      {chartData.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
          Sem despesas neste mês
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="vertical" 
                align="right"
                verticalAlign="middle"
                formatter={(value: string) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total de Despesas</span>
          <span className="font-mono font-medium">
            {formatCurrency(monthSummary.realizedExpenses)}
          </span>
        </div>
      </div>
    </div>
  );
}
