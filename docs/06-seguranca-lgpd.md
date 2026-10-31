# 06 — Segurança e LGPD

## Modelo de ameaças (resumo)

| Ameaça | Impacto | Mitigação |
|---|---|---|
| Vazamento entre tenants | Crítico | `tenantId` obrigatório + extensão Prisma + testes |
| Roubo de API key de IA | Alto | criptografia AES-256-GCM, nunca logar, mascarar na UI |
| Acesso indevido à conta | Alto | Argon2, JWT curto, refresh rotativo, rate limit, 2FA futuro |
| Prompt injection | Alto | tool allowlist, sem HTTP do modelo, validação de saída |
| Dados de mercado adulterados | Médio | proveniência, cache, fonte única |
| Exposição local (LAN/túnel) | Médio | túnel com TLS, firewall, auth obrigatória |
| Backup perdido | Alto | backup do SQLite (dev.db) + teste de restore |
| Abuso de IA | Médio | quota, rate limit, custo por usuário |

## Autenticação

- Senha: Argon2id; política mínima; bloqueio progressivo.
- JWT de acesso curto (15 min) + refresh rotativo (7 dias).
- Google OAuth.
- Verificação de e-mail e reset com token de uso único.
- 2FA TOTP pós-MVP.
- Logout invalida refresh.

## Autorização

- Papéis por tenant: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.
- Guards por rota e por recurso.
- Nunca confiar em `tenantId` do cliente.

## Criptografia

- Chaves de provedores: AES-256-GCM com `AI_ENCRYPTION_KEY` (fora do banco).
- TLS no túnel/reverse proxy quando exposto.
- Senhas com hash; nunca reversível.
- Segredos em `.env` (local) ou secret manager (produção).

## Aplicação (OWASP)

- Validação de entrada (DTO/Zod).
- Rate limit global e por rota sensível.
- Helmet, CORS restrito, CSRF quando cookie.
- Upload de CSV: limite de tamanho, validação de schema, sem execução.
- Logs estruturados sem PII/chaves.
- Dependências atualizadas; auditoria periódica.

## LGPD

- Base legal: execução de contrato/consentimento.
- Dados coletados: conta, carteira, transações, conversas.
- Finalidade: operar a ferramenta.
- Direitos: acesso, correção, exportação, exclusão.
- Retenção: enquanto a conta existir; logs por prazo limitado.
- Transferência internacional: provedores de IA podem processar fora do Brasil — informar e permitir provedor local.
- Encarregado/DPO: definir antes de abrir para terceiros.

## Posicionamento regulatório

- Ferramenta **educacional e analítica**; não é consultoria de valores mobiliários.
- Sem recomendação personalizada de compra/venda; sem execução.
- Disclaimer visível em toda análise.
- Revisão jurídica antes de abrir para usuários externos.

## Backup e recuperação

- `pg_dump` diário; retenção de 7–30 dias.
- Teste de restore trimestral.
- Documentar RPO/RTO.

## Exposição local

- Uso pessoal: `localhost`.
- Usuários convidados: túnel com TLS (Cloudflare Tunnel) ou VPN.
- Nunca expor o banco diretamente.
- Firewall e atualização do host.
