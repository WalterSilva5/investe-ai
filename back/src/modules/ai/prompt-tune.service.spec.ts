import { shouldPromote, PROMOTE_MARGIN } from './prompt-tune.service';
import { runWithConcurrency, summarizeSwarm, SwarmOutcome } from './swarm';
import { AGENT_PROFILES } from './agent-profiles';

describe('promoção automática de prompt', () => {
  const checkOk = { name: 'usou tool esperada (get_stock_outlook)', weight: 25, ok: true };
  const results = [
    { id: 'ativo-nu', checks: [checkOk, { name: 'não termina em promessa', weight: 5, ok: true }] },
  ];

  it('não promove sem baseline', () => {
    const decision = shouldPromote({ score: 100, results }, null);
    expect(decision.promote).toBe(false);
    expect(decision.reason).toContain('baseline');
  });

  it('não promove sem margem sobre o baseline', () => {
    const decision = shouldPromote({ score: 98, results }, 98);
    expect(decision.promote).toBe(false);
    expect(decision.reason).toContain('margem');
  });

  it('promove com margem e checks críticos ok', () => {
    const decision = shouldPromote({ score: 98 + PROMOTE_MARGIN + 1, results }, 98);
    expect(decision.promote).toBe(true);
  });

  it('check crítico falhado bloqueia a promoção mesmo com nota alta', () => {
    const decision = shouldPromote(
      {
        score: 99,
        results: [
          {
            id: 'ativo-nu',
            checks: [
              { name: 'usou tool esperada (get_stock_outlook)', ok: false },
            ],
          },
        ],
      },
      80,
    );
    expect(decision.promote).toBe(false);
    expect(decision.reason).toContain('crítico');
  });

  it('swarm roda para todos os perfis', async () => {
    const profiles = AGENT_PROFILES.map((profile) => profile.id);
    const outcomes: SwarmOutcome[] = await runWithConcurrency(profiles, 3, async (profileId) => ({
      profile: profileId,
      promoted: profileId === 'geral',
      reason: profileId === 'geral' ? 'margem' : 'sem margem',
      candidateVersion: 9,
      score: profileId === 'geral' ? 100 : 90,
      baseline: 98,
    }));
    const summary = summarizeSwarm(outcomes);
    expect(summary.total).toBe(profiles.length);
    expect(summary.promoted).toBe(1);
    expect(summary.best?.profile).toBe('geral');
  });
});
