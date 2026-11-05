# 13 — Oportunidades de negócio

## Objetivo

Ajudar o profissional a transformar **skills, experiência e formação** em caminhos de negócio viáveis — com foco em **validação barata** e execução em 30/60/90 dias.

> Conteúdo educacional. Não é garantia de resultado, não promete renda e não substitui validação real com clientes.

## Perfil profissional

O consultor usa um perfil por workspace (tenant):

- **Headline** e **resumo**.
- **Skills** (lista).
- **Experiência** (uma por linha).
- **Formação**.
- **Idiomas**.
- **Interesses**.
- **Localização** e **disponibilidade**.
- **Meta de renda** (R$/mês).

O perfil é salvo em `PUT /business/profile` e usado em toda geração de ideias.

## Catálogo de tipos

| Tipo | Foco |
|---|---|
| `freelance` | Consultoria/serviço por projeto |
| `produto` | Produto/micro-SaaS |
| `agencia` | Time de entrega |
| `educacao` | Cursos/mentoria |
| `conteudo` | Newsletter/YouTube/comunidade |
| `opensource` | Projeto open source/DevRel |
| `b2b` | Soluções para empresas |
| `internacional` | Renda em moeda forte |

## Como as ideias são geradas

1. O perfil é carregado.
2. O usuário informa um **foco** (opcional) e tipos preferidos.
3. O provedor de IA gera 3–5 ideias com:
   - tipo, título e resumo;
   - **fit** (0–100) com justificativa;
   - skills necessárias;
   - **primeiros passos**;
   - **experimentos de validação barata**;
   - modelo de preço;
   - riscos;
   - prazo (30/60/90 dias).

## Guardrails

- Não promete renda nem sucesso.
- Foco em **validar antes de investir**.
- Sem esquemas, golpes ou exploração.
- Conteúdo educacional, com disclaimer.

## Como usar

1. Preencha o **perfil profissional** (uma vez).
2. Defina um **foco** (ex.: "renda em dólar", "produto próprio").
3. Clique em **Gerar ideias**.
4. Escolha 1–2 ideias e **valide** com conversas/clientes antes de investir.
5. Revise o perfil quando sua experiência mudar.

## Limitações

- A IA pode errar; valide sempre no mercado.
- Fit alto não garante demanda.
- A execução depende de tempo, energia e consistência.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/business/profile` | Perfil profissional |
| PUT | `/business/profile` | Salva/atualiza o perfil |
| GET | `/business/catalog` | Tipos de negócio |
| GET | `/business/ideas` | Ideias geradas |
| POST | `/business/ideas` | Gera ideias (`{ focus?, kinds? }`) |
