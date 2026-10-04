import { describe, it, expect } from 'vitest';
import { createMemoryPlatform } from './memory';

describe('git simulato', () => {
  it('merge con base comune: conflitto solo dove serve', async () => {
    const p = createMemoryPlatform();
    const repo = '/v';
    await p.gitInit(repo);
    await p.writeText('/v/.alexandria/vault.json', '{}');
    await p.gitCommit(repo, 'Vault creato');
    await p.writeText('/v/documents/a.md', 'T\n\nUno.\n\nDue.\n\nTre.\n');
    await p.gitCommit(repo, 'doc');
    await p.gitCreateBranch(repo, 'idea');
    await p.gitCheckout(repo, 'idea');
    await p.writeText('/v/documents/a.md', 'T\n\nUno.\n\nDue idea.\n\nTre.\n\nQuattro.\n');
    await p.gitCommit(repo, 'idea');
    await p.gitCheckout(repo, 'main');
    expect(await p.readText('/v/documents/a.md')).toBe('T\n\nUno.\n\nDue.\n\nTre.\n');
    await p.writeText('/v/documents/a.md', 'T\n\nUno.\n\nDue main.\n\nTre.\n');
    await p.gitCommit(repo, 'main');
    const m = await p.gitMerge(repo, 'idea');
    expect(m.status).toBe('conflicts');
    expect(m.conflicts[0].base).toBe('T\n\nUno.\n\nDue.\n\nTre.\n');
    const log = await p.gitLog(repo);
    expect(log.commits.length).toBe(4);
  });
});
