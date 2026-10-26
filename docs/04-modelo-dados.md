# 04 — Modelo de dados

## Regras gerais

- **Multi-tenant:** toda tabela de domínio tem `tenantId`; toda query é escopada.
- **Dinheiro:** `Decimal(18, 6)`; nunca `float`.
- **Datas:** UTC (`DateTime`), exibição no fuso do usuário.
- **Soft delete:** `deletedAt` em entidades editáveis.
- **Auditoria:** `createdAt`, `updatedAt`, `createdBy`.
- **Proveniência:** dados externos guardam `source` e `fetchedAt`.

## Entidades

### Tenancy e acesso

| Entidade | Campos principais |
|---|---|
| `Tenant` | id, name, slug, plan, createdAt |
| `User` | id, email, passwordHash, name, googleId, emailVerifiedAt, status |
| `Membership` | userId, tenantId, role (OWNER/ADMIN/MEMBER/VIEWER) |
| `RefreshToken` | userId, tokenHash, expiresAt, revokedAt |
| `ProviderCredential` | tenantId, userId, providerId, encryptedKey, baseUrl, model, enabled |
| `AgentProfile` | tenantId, name, providerId, model, temperature, maxTokens |
| `Consent` | userId, type, version, acceptedAt |
| `AuditEvent` | tenantId, userId, action, entity, entityId, metadata, ip, createdAt |

### Carteira

| Entidade | Campos principais |
|---|---|
| `Portfolio` | tenantId, name, currency, isDefault |
| `Account` | portfolioId, name, institution, type |
| `Asset` | symbol, name, type (STOCK/FII/ETF/FIXED_INCOME/CRYPTO/CASH), currency, metadata |
| `Transaction` | portfolioId, accountId, assetId, type (BUY/SELL/DEPOSIT/WITHDRAW/DIVIDEND/INTEREST), quantity, price, fees, date |
| `Position` | derivada: portfolioId, assetId, quantity, averagePrice, invested, currentValue |
| `Price` | assetId, date, close, source, fetchedAt |
| `FxRate` | pair, date, rate, source |
| `MacroSeries` | code (SELIC/IPCA/CDI), date, value, source |
| `FixedIncomeRate` | issuer, product, indexer, rate, maturity, source |

### Análise e IA

| Entidade | Campos principais |
|---|---|
| `InvestmentPolicy` | tenantId, riskProfile, horizon, targetAllocation (JSON), bands (JSON) |
| `Goal` | tenantId, name, targetAmount, targetDate, priority |
| `Conversation` | tenantId, userId, title, providerId, model |
| `Message` | conversationId, role, content, tokens, cost, createdAt |
| `ToolCall` | messageId, tool, input, output, durationMs, status |
| `Document` | tenantId, title, body, type |
| `Embedding` | documentId, vector (pgvector), model |
| `AlertRule` | tenantId, type, condition (JSON), enabled |
| `AlertEvent` | ruleId, firedAt, payload |
| `AiUsage` | tenantId, userId, providerId, model, tokensIn, tokensOut, cost, task, createdAt |
| `ImportJob` | tenantId, status, filename, result |
| `BrokerConnection` | (futuro) tenantId, broker, status, metadata |

### SaaS (futuro)

`Plan`, `Subscription`, `UsageCounter`, `Invoice`, `Invite`, `FeatureFlag`, `DataExportRequest`, `DeletionRequest`.

## Relações principais

```
Tenant 1─N Membership N─1 User
Tenant 1─N Portfolio 1─N Account 1─N Transaction N─1 Asset
Portfolio 1─N Position N─1 Asset
Asset 1─N Price
Tenant 1─N Conversation 1─N Message 1─N ToolCall
Tenant 1─N ProviderCredential
Tenant 1─N InvestmentPolicy
Tenant 1─N AuditEvent
```

## Isolamento

- Extensão Prisma `tenantScope` aplica `tenantId` em `find*`, `update*`, `delete*` e `create`.
- Services nunca aceitam `tenantId` vindo do cliente.
- Teste automatizado: usuário A não lê/escreve dados do tenant B.

## Índices

- `(tenantId, createdAt)` nas tabelas de listagem.
- `(assetId, date)` em `Price`.
- `(tenantId, email)` em `User` (único).
- `(conversationId, createdAt)` em `Message`.
- `(tenantId, providerId)` em `ProviderCredential`.

## Migrações

- Prisma Migrate; migrations versionadas em `back/prisma/migrations`.
- Seed mínimo: tenant demo + admin local (somente dev).
