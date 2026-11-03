import { BadRequestException } from '@nestjs/common';
import { BankingService } from './banking.service';

describe('BankingService', () => {
  const prisma = {
    bankStatement: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    bankTransaction: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  };

  let service: BankingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BankingService(prisma as never);
    prisma.bankStatement.create.mockResolvedValue({
      id: 'stmt1',
      name: 'x',
      source: 'OFX',
      periodStart: null,
      periodEnd: null,
    });
    prisma.bankTransaction.createMany.mockResolvedValue({ count: 3 });
  });

  it('parseia OFX (SGML) com valores, datas e vírgula decimal', async () => {
    const ofx =
      '<OFX><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005<TRNAMT>5000.00<MEMO>SALARIO</STMTTRN>' +
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261006<TRNAMT>-342,90<MEMO>MERCADO</STMTTRN></OFX>';

    const result = await service.import('tenant1', { name: 'nubank', format: 'OFX', content: ofx });

    expect(result.imported).toBe(2);
    const data = prisma.bankTransaction.createMany.mock.calls[0][0].data;
    expect(data[0]).toMatchObject({ description: 'SALARIO', amount: 5000, type: 'INCOME' });
    expect(data[1]).toMatchObject({ description: 'MERCADO', amount: -342.9, type: 'EXPENSE' });
  });

  it('parseia CSV com cabeçalho', async () => {
    const csv = 'data,descricao,valor\n2026-10-01,Salário,5000\n2026-10-02,Aluguel,-1200.50';

    const result = await service.import('tenant1', { name: 'conta', format: 'CSV', content: csv });

    expect(result.imported).toBe(2);
    const data = prisma.bankTransaction.createMany.mock.calls[0][0].data;
    expect(data[0]).toMatchObject({ description: 'Salário', amount: 5000, type: 'INCOME' });
    expect(data[1]).toMatchObject({ description: 'Aluguel', amount: -1200.5, type: 'EXPENSE' });
  });

  it('rejeita conteúdo sem transações', async () => {
    await expect(
      service.import('tenant1', { name: 'x', format: 'OFX', content: 'sem transacoes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('concilia extrato com transação da carteira por valor e data', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      { id: 't1', type: 'BUY', quantity: 100, price: 38.5, fees: 0, date: new Date('2026-10-01') },
    ]);
    prisma.bankTransaction.findMany.mockResolvedValue([
      { id: 'b1', amount: -3850, date: new Date('2026-10-02') },
    ]);
    prisma.bankTransaction.update.mockResolvedValue({ id: 'b1' });

    const result = await service.reconcile('tenant1');

    expect(result).toEqual({ matched: 1, unmatched: 0, total: 1 });
    expect(prisma.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: expect.objectContaining({ portfolioTransactionId: 't1' }),
    });
  });
});
