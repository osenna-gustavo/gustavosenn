import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionForm } from './TransactionForm';

export function FAB() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsFormOpen(true)}
        className="fab animate-pulse-glow"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
      
      <TransactionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
      />
    </>
  );
}
