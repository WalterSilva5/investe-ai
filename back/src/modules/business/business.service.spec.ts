import { BusinessService } from './business.service';

describe('BusinessService', () => {
  const prisma = {
    businessProfile: { findUnique: jest.fn(), upsert: jest.fn() },
    businessIdea: { findMany: jest.fn(), create: jest.fn() },
  };
  const registry = { resolve: jest.fn() };

  let service: BusinessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessService(prisma as never, registry as never);
  });

  it('rejeita gerar ideias sem perfil', async () => {
    prisma.businessProfile.findUnique.mockResolvedValue(null);

    await expect(service.generateIdeas('t1', {})).rejects.toThrow();
  });

  it('gera e persiste ideias a partir do perfil', async () => {
    prisma.businessProfile.findUnique.mockResolvedValue({
      tenantId: 't1',
      skills: ['TypeScript'],
      experience: [],
      education: [],
    });
    prisma.businessIdea.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'i1', ...data }),
    );
    registry.resolve.mockResolvedValue({
      providerId: 'opencode',
      model: 'm',
      provider: {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify([
            {
              kind: 'freelance',
              title: 'Consultoria',
              summary: 'resumo',
              fitScore: 80,
              requiredSkills: ['TypeScript'],
              firstSteps: ['passo'],
              validation: ['validar'],
              risks: ['risco'],
              pricing: 'por projeto',
              timeline: '30 dias',
              whyFit: 'combina',
              disclaimer: 'educacional',
            },
          ]),
        }),
      },
    });

    const result = await service.generateIdeas('t1', { focus: 'renda' });

    expect(result.generated).toBe(1);
    expect(prisma.businessIdea.create).toHaveBeenCalled();
  });
});
