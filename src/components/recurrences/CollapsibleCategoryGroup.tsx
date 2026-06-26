import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleCategoryGroupProps {
  groupKey: string;
  icon?: string;
  name?: string;
  count: number;
  collapsedGroups: Set<string>;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  variant?: 'sm' | 'md';
}

export function CollapsibleCategoryGroup({
  groupKey,
  icon,
  name,
  count,
  collapsedGroups,
  onToggle,
  children,
  variant = 'sm',
}: CollapsibleCategoryGroupProps) {
  const isCollapsed = collapsedGroups.has(groupKey);

  const sizeClasses =
    variant === 'md'
      ? 'px-4 py-2 text-sm rounded-lg'
      : 'px-3 py-1.5 text-xs rounded-md';

  return (
    <div className="space-y-1">
      <button
        onClick={() => onToggle(groupKey)}
        className={`w-full flex items-center justify-between ${sizeClasses} bg-muted/50 cursor-pointer hover:bg-muted transition-colors`}
      >
        <div className="flex items-center gap-2 font-medium text-muted-foreground">
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span>
            {icon} {name || 'Sem categoria'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {count} item(ns)
        </span>
      </button>
      {!isCollapsed && children}
    </div>
  );
}
