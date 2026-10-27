import 'dotenv/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { PortfoliosService } from './portfolios.service';

/**
 * Teste de integração: exige Postgres de pé (docker compose up -d).
 * Cria dois tenants isolados e garante que um não acessa dados do outro.
 */
describe('Isolamento multi-tenant (carteira/transações)', () => {
  const prisma = new PrismaService();
  const portfolios = new PortfoliosService(prisma);
  const transactions = new TransactionsService(prisma);

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let tenantA: { id: string } = { id: '' };
  let tenantB: { id: string } = { id: '' };
  let portfolioA: { id: string } = { id: '' };
  let portfolioB: { id: string } = { id: '' };
  let assetId = '';

  beforeAll(async () => {
    await prisma.$connect();
    tenantA = await prisma.tenant.create({
      data: { name: `Iso A ${suffix}`, slug: `iso-a-${suffix}` },
    });
    tenantB = await prisma.tenant.create({
      data: { name: `Iso B ${suffix}`, slug: `iso-b-${suffix}` },
    });
    portfolioA = await prisma.portfolio.create({
      data: { tenantId: tenantA.id, name: 'Carteira A' },
    });
    portfolioB = await prisma.portfolio.create({
      data: { tenantId: tenantB.id, name: 'Carteira B' },
    });
    const asset = await prisma.asset.create({
      data: { symbol: `ISO${suffix}`, name: 'Ativo de teste', type: 'STOCK' },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    await prisma.asset.deleteMany({ where: { id: assetId } });
    await prisma.$disconnect();
  });

  it('lista apenas as carteiras do próprio tenant', async () => {
    const list = await portfolios.list(tenantA.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(portfolioA.id);
  });

  it('não abre carteira de outro tenant', async () => {
    await expect(portfolios.get(tenantA.id, portfolioB.id)).rejects.toThrow(
      'Carteira não encontrada.',
    );
    const own = await portfolios.get(tenantA.id, portfolioA.id);
    expect(own.id).toBe(portfolioA.id);
  });

  it('não cria transação em carteira de outro tenant', async () => {
    await expect(
      transactions.create(tenantA.id, portfolioB.id, {
        assetId,
        type: 'BUY',
        quantity: 1,
        price: 10,
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow('Carteira não encontrada.');
  });

  it('não calcula resumo de carteira de outro tenant', async () => {
    await expect(portfolios.summary(tenantA.id, portfolioB.id)).rejects.toThrow(
      'Carteira não encontrada.',
    );
  });
});
