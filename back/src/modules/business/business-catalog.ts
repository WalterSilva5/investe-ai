export interface BusinessKind {
  slug: string;
  name: string;
  icon: string;
  description: string;
  requiredSkills: string[];
  signals: string[];
}

/** Tipos de negócio que o consultor pode considerar. */
export const BUSINESS_KINDS: BusinessKind[] = [
  {
    slug: 'freelance',
    name: 'Freelance / Consultoria',
    icon: '💼',
    description: 'Prestar serviço especializado por projeto ou hora.',
    requiredSkills: ['comunicação', 'entrega', 'especialização'],
    signals: ['demanda por projeto', 'portfólio', 'indicação'],
  },
  {
    slug: 'produto',
    name: 'Produto / Micro-SaaS',
    icon: '🛠️',
    description: 'Criar software próprio com receita recorrente.',
    requiredSkills: ['programação', 'produto', 'marketing'],
    signals: ['dor recorrente', 'disposição a pagar', 'canal de aquisição'],
  },
  {
    slug: 'agencia',
    name: 'Agência',
    icon: '🏢',
    description: 'Montar time para entregar serviços de forma recorrente.',
    requiredSkills: ['gestão', 'vendas', 'entrega'],
    signals: ['processo repetível', 'margem', 'fluxo de clientes'],
  },
  {
    slug: 'educacao',
    name: 'Educação / Mentoria',
    icon: '🎓',
    description: 'Cursos, mentorias e treinamentos.',
    requiredSkills: ['ensino', 'comunicação', 'especialização'],
    signals: ['público com dor', 'resultado comprovável', 'autoridade'],
  },
  {
    slug: 'conteudo',
    name: 'Conteúdo / Comunidade',
    icon: '📝',
    description: 'Newsletter, YouTube, comunidade e audiência.',
    requiredSkills: ['escrita', 'comunicação', 'consistência'],
    signals: ['nicho', 'retenção', 'patrocínio/produto'],
  },
  {
    slug: 'opensource',
    name: 'Open source / DevRel',
    icon: '🌍',
    description: 'Projeto open source com patrocínio, consultoria ou emprego.',
    requiredSkills: ['programação', 'comunidade', 'comunicação'],
    signals: ['adoção', 'contribuidores', 'empresas usando'],
  },
  {
    slug: 'b2b',
    name: 'Soluções B2B',
    icon: '🤝',
    description: 'Software ou serviço para empresas (contrato recorrente).',
    requiredSkills: ['vendas', 'domínio de negócio', 'entrega'],
    signals: ['orçamento do cliente', 'ciclo de venda', 'retenção'],
  },
  {
    slug: 'internacional',
    name: 'Renda em moeda forte',
    icon: '💵',
    description: 'Trabalho remoto/freelance para o exterior.',
    requiredSkills: ['inglês', 'especialização', 'comunicação'],
    signals: ['demanda global', 'fuso', 'contrato/remessa'],
  },
];

export function findBusinessKind(slug: string): BusinessKind | undefined {
  return BUSINESS_KINDS.find((kind) => kind.slug === slug.toLowerCase());
}
