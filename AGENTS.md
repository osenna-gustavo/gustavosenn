# Regras permanentes do projeto

## Entrega e preview no Lovable

- Toda otimização aprovada pelo usuário deve ser implementada, validada, commitada e enviada para a branch `main` conectada ao Lovable, para aparecer no preview imediatamente.
- Não deixar uma alteração concluída apenas em branch de trabalho, salvo quando o usuário pedir explicitamente um rascunho ou solicitar que ela ainda não seja aplicada.
- Depois do push, usar o MCP do Lovable para confirmar a sincronização, obter o preview atual e inspecionar o estado do projeto.
- Para alterações visuais ou de fluxo, conferir também o preview em navegador e registrar erros de console ou de execução encontrados.
- Se a autenticação impedir a conferência, informar isso claramente ao usuário.
- Atualizar o preview não autoriza publicar a aplicação em produção. Usar a ação **Publish** do Lovable somente com pedido explícito do usuário.

## Backend e Supabase

- Usar o MCP do Lovable para conversar com o agente do projeto e acompanhar alterações full-stack geradas pelo Lovable.
- Usar o MCP oficial do Supabase, restrito ao projeto configurado, para inspecionar banco, migrations, logs e Edge Functions.
- Toda mudança estrutural no banco deve ser criada como migration versionada no repositório antes de ser aplicada ao ambiente remoto.
- Alterações remotas de dados, schema, autenticação, secrets ou Edge Functions exigem revisão explícita da ação antes da escrita.

## Regras financeiras do produto

- O dia de fechamento dos cartões é global e define o ciclo financeiro familiar exibido pela aplicação.
- Uma compra no cartão consome o orçamento da categoria no ciclo da compra; o pagamento posterior da fatura não deve virar uma segunda despesa.
- O saldo disponível do orçamento considera gastos já lançados e compromissos ainda pendentes, incluindo recorrências e parcelas.
