## Objetivo

Corrigir dois problemas que quebram a confiança nos números:

1. **Dashboard mostra um valor (ex.: Gás R$ 170,57 / R$ 80,00 — 213%) mas, ao clicar para ver os lançamentos, aparece "Nenhum lançamento encontrado".** Isso significa que o cálculo do dashboard e o filtro do drawer não estão olhando para o mesmo conjunto de lançamentos.

2. **Lançamento em massa (importação de fatura/extrato) deixa a recorrência/parcelamento como "pendente" mesmo depois de o usuário vincular.** O lançamento é criado, mas a aba de Recorrências (e Parcelamentos) continua oferecendo "confirmar pagamento", o que gera risco de duplicidade.

Nada além desses dois problemas será alterado.

---

## Problema 1 — Dashboard ↔ Drill-down inconsistentes

### Causa raiz

Hoje existem três lugares calculando "realizado por categoria/subcategoria" com regras ligeiramente diferentes:

- `AppContext.calculateMonthSummary` → filtra por `t.categoryId === cat.id` (usado no ExpenseChart, KPIs e progresso).
- `CategoryProgress` → repete a soma local: parent por `categoryId`, **subcategoria apenas por `subcategoryId`** (sem checar se o `categoryId` da transação bate com a categoria-mãe).
- `DrillDownDrawer` → exige **`categoryId` E `subcategoryId`** baterem juntos.

Resultado: lançamentos "órfãos" (categoria-mãe trocada/removida ao longo do tempo, ou categorias com `parent_id` no banco vs. subcategoria com mesmo nome, ou transações importadas onde só o `subcategory_id` foi preenchido) inflam a barra do dashboard mas somem no drawer. Foi exatamente o que aconteceu com "Gás": existe uma categoria Gás (filha de Moradia via `parent_id`) **e** uma subcategoria Gás dentro de Moradia — o realizado caiu na subcategoria mas o usuário clicou na categoria-mãe (ou vice-versa), e os filtros divergem.

### Correção

1. **Centralizar o cálculo** em uma única função pura (`computeCategoryRealized` em `src/lib/budget-allocations.ts` ou novo `src/lib/category-summary.ts`) que recebe `transactions`, `categories`, `subcategories` e devolve, para cada (categoryId, subcategoryId|null), o realizado. Essa função normaliza:
   - Se a transação tem `subcategoryId` válido mas o `categoryId` não bate com `subcategory.categoryId`, o cálculo **usa o `categoryId` da subcategoria** como fonte de verdade (corrigindo dados antigos sem perder o lançamento). Esse mesmo "fallback" passa a ser aplicado também na leitura do drilldown.
   - Se a transação tem `categoryId` que aponta para uma categoria com `parentId`, o realizado é creditado no nó-folha (Gás), e o pai (Moradia) é a soma dos filhos — sem dupla contagem.
   - Lançamentos sem categoria conhecida são agrupados em "Sem categoria" (não somem nem inflam outra linha).

2. **Usar essa função em três pontos**: `calculateMonthSummary` (campo `categoryBreakdown`), `CategoryProgress` (linhas e subcategorias) e `DrillDownDrawer` (filtro de transações). Assim, o número que aparece no card é o mesmo número de lançamentos que abre no drawer, sempre.

3. **Drawer**: ao filtrar por `categoryId`/`subcategoryId`, aplicar a mesma normalização (uma transação com `subcategoryId` cuja `subcategory.categoryId` bate com o filtro entra mesmo que o `categoryId` da transação esteja desatualizado).

4. **Sanity check** silencioso: se o total da categoria no card divergir da soma das transações que o drawer mostraria, logar `console.warn` com o `categoryId` problemático (ajuda a achar dados corrompidos sem afetar o usuário).

### Resultado esperado

Clicar em Gás (ou qualquer outra categoria/subcategoria) sempre mostra exatamente os lançamentos que somam o valor do card. "213%" só aparece se houver lançamentos reais que justifiquem.

---

## Problema 2 — Importação em massa não confirma a recorrência/parcelamento

### Causa raiz em `BulkImportModal.handleConfirmAll`

- A vinculação só acontece se `item.matchedInstance` existir. `matchedInstance` é buscado por `status === 'pending'` para o mês selecionado. Se não existe instância pendente (recorrência ainda não materializou o mês, ou o usuário escolheu manualmente uma recorrência sem instância), o `if (item.matchedInstance)` é pulado e a recorrência fica pendente para sempre.
- Quando há `matchedInstance`, o código atualiza a instância para `confirmed`, **mas não grava `recurrence_id`/`recurrence_instance_id` na transação criada**. O vínculo fica torto: a aba Recorrências confirma, mas a transação não "sabe" da recorrência (afeta exclusão/recálculo).
- **Não existe vinculação a parcelamentos** (`installment_id`) na tela de importação em massa, embora o usuário diga que vincula "parcelamentos e/ou recorrências". Hoje só dá pra vincular recorrência.

### Correção

1. **Refatorar `handleConfirmAll`** para usar `linkTransactionsToRecurrence` (já existente em `supabase-database.ts`, exposto pelo contexto), que:
   - Reaproveita a instância pendente do mês se existir, ou cria uma nova `confirmed` se não existir.
   - Atualiza a transação com `recurrence_id` + `recurrence_instance_id`.
   
   Fluxo novo: para cada item importado com `matchedRecurrence`, criar a transação primeiro, depois chamar `linkTransactionsToRecurrence([newTx.id], rec.id)`. Remover o `if (item.matchedInstance)` antigo.

2. **Adicionar suporte a parcelamentos** no mesmo painel:
   - Novo campo "Vincular Parcelamento" no editor do item, com lista dos `installments` ativos (carregados via contexto). Aceita só uma das duas vinculações por item (recorrência **OU** parcelamento, não os dois).
   - Ao confirmar, se `matchedInstallment` estiver definido, gravar `installment_id` na transação criada (já existe a coluna). Reaproveitar a lógica de "marcar parcela como paga" que já existe na `InstallmentsPage` — extrair em helper `markInstallmentPayment(installmentId, transactionId, installmentNumber)` em `supabase-database.ts` e usar nos dois lugares.
   - O matching automático por descrição também deve sugerir parcelamento (mesma heurística de palavras-chave usada para recorrência).

3. **UX**: depois da importação, o toast mostra "X recorrência(s) e Y parcela(s) confirmada(s)" e a aba de Recorrências/Parcelamentos não oferece mais "confirmar" para esses itens (porque a instância já está `confirmed` e a parcela já está marcada como paga).

4. **Evitar duplicidade futura**: ao tentar criar transação na importação, se já existe transação com mesma `recurrence_instance_id` ou mesma `installment_id`+número da parcela, marcar como duplicado (UI atual já tem esse alerta — só plugar nessa nova checagem).

### Resultado esperado

Após importar a fatura/boleto e vincular, abrir Recorrências ou Parcelamentos mostra a parcela/mês como **paga**, sem botão de "confirmar de novo".

---

## Detalhes técnicos

Arquivos afetados:

- `src/lib/category-summary.ts` (novo) — função pura `computeCategoryRealized` com normalização de `categoryId` via subcategoria.
- `src/contexts/AppContext.tsx` — `calculateMonthSummary` passa a delegar para o helper acima.
- `src/components/dashboard/CategoryProgress.tsx` — usa o mesmo helper para parent + subcategoria.
- `src/components/dashboard/DrillDownDrawer.tsx` — filtro de transações usa a mesma normalização (uma transação entra no filtro se a tupla normalizada `(categoryId, subcategoryId)` bater).
- `src/lib/supabase-database.ts` — extrair `markInstallmentPayment(installmentId, transactionId, installmentNumber)` a partir do código atual da `InstallmentsPage`; manter `linkTransactionsToRecurrence` como está.
- `src/components/transactions/BulkImportModal.tsx`:
  - novo estado `matchedInstallment` por item;
  - `handleConfirmAll` refatorado para usar `linkTransactionsToRecurrence` e `markInstallmentPayment`;
  - novo Select "Vincular Parcelamento" no editor;
  - matching automático por descrição estende para parcelamentos.
- `src/pages/InstallmentsPage.tsx` — só substitui o trecho de "marcar pago" pela chamada ao helper extraído (sem mudança visual).

Sem migração de banco — todas as colunas necessárias (`installment_id`, `recurrence_id`, `recurrence_instance_id`) já existem.

Nenhuma outra tela, regra de negócio ou estilo é alterada.