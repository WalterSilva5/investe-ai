# 00 — Visão geral

## Problema

Organizar patrimônio, entender alocação e comparar alternativas de investimento exige planilhas, fontes dispersas e conhecimento técnico. Ao mesmo tempo, ferramentas de IA genéricas alucinam números e não têm os dados da carteira.

O **wsi-invest-ai** resolve isso com um assistente que:

- mantém a carteira organizada;
- calcula números de forma determinística (não deixa o LLM fazer conta);
- explica conceitos e cenários com fonte e data;
- ajuda a acompanhar metas, reserva, runway e renda projetada;
- **não executa ordens** e **não dá recomendação personalizada de compra/venda**.

## Usuários

- **Inicial:** uso pessoal do dono.
- **Curto prazo:** usuários convidados, rodando localmente (LAN ou túnel).
- **Depois:** possível SaaS público, com billing, termos e conformidade.

O modelo de dados já nasce **multi-tenant** para não exigir migração estrutural depois.

## Princípios

1. **Análise, não aconselhamento.** A ferramenta informa, compara, simula e explica. Não diz "compre X".
2. **Números vêm de código, não do modelo.** Tools determinísticas + validação.
3. **Fonte e data em toda resposta.** Rastreabilidade do dado.
4. **Sem execução.** Nenhuma ordem, nenhuma integração de trading no MVP.
5. **Privacidade por padrão.** Dados financeiros sensíveis, chaves criptografadas, isolamento por tenant.
6. **Local-first.** Simples de rodar; sem dependência de cloud no início.

## Escopo do MVP

**Dentro:**
- cadastro/login (e-mail + Google) e multi-tenant;
- carteira manual (ativos, contas, transações);
- dashboard (patrimônio, alocação, evolução, runway);
- renda fixa (Tesouro/CDB/LCI/LCA, IR/IOF/FGC);
- macro (Selic, IPCA, CDI, câmbio) via fontes públicas;
- agente de IA com tools de carteira/macro/renda fixa;
- configuração de provedores (OpenCode primeiro);
- auditoria de análises;
- termos, privacidade e disclaimer.

**Fora do MVP:**
- execução de ordens e integração de trading;
- integração automática com corretoras;
- billing/assinatura;
- app mobile;
- RAG avançado e notícias;
- recomendação personalizada para terceiros.

## Métricas de sucesso

- Usuário consegue cadastrar a carteira e ver alocação/runway em < 10 min.
- Toda resposta do agente cita fonte/data e não inventa número.
- Nenhum vazamento entre tenants nos testes.
- Custo de IA monitorado por usuário.
- O dono usa semanalmente para revisar a carteira.

## Não objetivos

- Ser corretora, gestora ou consultoria de valores mobiliários.
- Prever preço de ativo.
- Substituir contador, advogado ou consultor.
- Operar com dinheiro de terceiros.
