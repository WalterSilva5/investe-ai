import { Asset, AssetType, PrismaClient, Role, TransactionType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@wsi.local';
const ADMIN_PASSWORD = 'admin123';
const DEMO_EMAIL = 'demo@wsi.local';
const DEMO_PASSWORD = 'demo123';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log('Seed já aplicado (admin existe). Para recriar, apague dev.db e rode `npx prisma db push`.');
    return;
  }

  // ── Admin (e-mail em ADMIN_EMAILS → acesso a /admin) ─────────────────────
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await argon2.hash(ADMIN_PASSWORD),
      name: 'Admin',
    },
  });
  const adminTenant = await prisma.tenant.create({
    data: { name: 'Workspace Admin', slug: 'admin' },
  });
  await prisma.membership.create({
    data: { userId: admin.id, tenantId: adminTenant.id, role: Role.OWNER },
  });

  // ── Demo (com carteira de exemplo) ───────────────────────────────────────
  const demo = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: await argon2.hash(DEMO_PASSWORD),
      name: 'Investidor Demo',
    },
  });
  const demoTenant = await prisma.tenant.create({
    data: { name: 'Carteira Demo', slug: 'demo' },
  });
  await prisma.membership.create({
    data: { userId: demo.id, tenantId: demoTenant.id, role: Role.OWNER },
  });

  // Ativos
  const assets = await seedAssets();

  // Carteira + conta
  const portfolio = await prisma.portfolio.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Carteira principal',
      currency: 'BRL',
      isDefault: true,
    },
  });
  const account = await prisma.account.create({
    data: {
      portfolioId: portfolio.id,
      name: 'Corretora',
      institution: 'B3',
      type: 'BROKER',
    },
  });

  // Transações + posições (demonstração)
  const positions: Array<{
    symbol: string;
    type: AssetType;
    qty: number;
    price: number;
  }> = [
    { symbol: 'PETR4', type: AssetType.STOCK, qty: 100, price: 38.5 },
    { symbol: 'VALE3', type: AssetType.STOCK, qty: 50, price: 62.3 },
    { symbol: 'ITUB4', type: AssetType.STOCK, qty: 200, price: 33.9 },
    { symbol: 'HGLG11', type: AssetType.FII, qty: 30, price: 162.0 },
    { symbol: 'MXRF11', type: AssetType.FII, qty: 50, price: 10.4 },
    { symbol: 'IVVB11', type: AssetType.ETF, qty: 20, price: 310.0 },
    { symbol: 'BTC', type: AssetType.CRYPTO, qty: 0.01, price: 285000 },
    { symbol: 'ETH', type: AssetType.CRYPTO, qty: 0.3, price: 16000 },
    { symbol: 'TESOURO_SELIC', type: AssetType.FIXED_INCOME, qty: 1, price: 10000 },
  ];

  for (const position of positions) {
    const asset = assets.find(
      (item) => item.symbol === position.symbol && item.type === position.type,
    );
    if (!asset) continue;
    const invested = position.qty * position.price;
    await prisma.transaction.create({
      data: {
        portfolioId: portfolio.id,
        accountId: account.id,
        assetId: asset.id,
        type: TransactionType.BUY,
        quantity: position.qty,
        price: position.price,
        fees: 0,
        date: new Date('2026-10-01T12:00:00Z'),
      },
    });
    await prisma.position.create({
      data: {
        portfolioId: portfolio.id,
        assetId: asset.id,
        quantity: position.qty,
        averagePrice: position.price,
        invested,
      },
    });
  }

  // Política de investimento
  await prisma.investmentPolicy.create({
    data: {
      tenantId: demoTenant.id,
      riskProfile: 'moderado',
      horizon: '5+ anos',
      targetAllocation: {
        STOCK: 30,
        FII: 10,
        ETF: 30,
        FIXED_INCOME: 20,
        CRYPTO: 10,
      },
      bands: { default: 5 },
    },
  });

  // Meta
  await prisma.goal.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Reserva de emergência',
      targetAmount: 20500,
      priority: 1,
    },
  });

  // Alerta
  await prisma.alertRule.create({
    data: {
      tenantId: demoTenant.id,
      type: 'ALLOCATION_MAX',
      condition: { assetType: 'CRYPTO', maxPct: 10 },
      enabled: true,
    },
  });

  // Memória do agente
  await prisma.memory.create({
    data: {
      tenantId: demoTenant.id,
      kind: 'preference',
      content:
        'Perfil moderado; foco em renda passiva e diversificação em moeda forte (meta 50% internacional).',
      importance: 8,
    },
  });

  // Nota (IPS resumida)
  await prisma.document.create({
    data: {
      tenantId: demoTenant.id,
      title: 'IPS — política de investimento',
      body:
        'Reserva de 6 meses em liquidez. Aporte mensal: 50% renda fixa, 40% ETF global, 10% cripto. Rebalancear por banda trimestral. Sem alavancagem, sem day trade.',
      tags: 'ips,regras',
    },
  });

  console.log('Seed concluído.');
  console.log(`- ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}  (admin)`);
  console.log(`- ${DEMO_EMAIL} / ${DEMO_PASSWORD}  (demo — carteira com ${positions.length} ativos)`);
}

async function seedAssets() {
  const defs: Array<{ symbol: string; name: string; type: AssetType }> = [
    { symbol: 'PETR4', name: 'Petrobras PN', type: AssetType.STOCK },
    { symbol: 'VALE3', name: 'Vale ON', type: AssetType.STOCK },
    { symbol: 'ITUB4', name: 'Itaú Unibanco PN', type: AssetType.STOCK },
    { symbol: 'HGLG11', name: 'CSHG Logística FII', type: AssetType.FII },
    { symbol: 'MXRF11', name: 'Maxi Renda FII', type: AssetType.FII },
    { symbol: 'IVVB11', name: 'iShares S&P 500 (BDR)', type: AssetType.ETF },
    { symbol: 'BOVA11', name: 'iShares Ibovespa', type: AssetType.ETF },
    { symbol: 'BTC', name: 'Bitcoin', type: AssetType.CRYPTO },
    { symbol: 'ETH', name: 'Ethereum', type: AssetType.CRYPTO },
    { symbol: 'TESOURO_SELIC', name: 'Tesouro Selic 2027', type: AssetType.FIXED_INCOME },
  ];

  const created: Asset[] = [];
  for (const def of defs) {
    const asset = await prisma.asset.upsert({
      where: { symbol_type: { symbol: def.symbol, type: def.type } },
      create: def,
      update: {},
    });
    created.push(asset);
  }
  return created;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
