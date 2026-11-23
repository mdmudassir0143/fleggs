import { describe, expect, test, vi } from 'vitest';
import { cleanName, fallbackLore, generateLore, LORE_MODEL } from './generate';

const input = { yetiId: '0x' + 'ab'.repeat(32), elements: [3], variants: [9, 2, 13], mutated: true };
const aiReturning = (response: string) => ({ run: vi.fn(async () => ({ response })) });

describe('generateLore', () => {
  test('uses the model name and story when valid', async () => {
    const ai = aiReturning('{"name":"Pebble Drift","story":"Pebble hums to the snow until it falls asleep."}');
    const lore = await generateLore(input, ai);
    expect(lore).toEqual({ name: 'Pebble Drift', story: 'Pebble hums to the snow until it falls asleep.', source: 'ai' });
    expect(ai.run).toHaveBeenCalledWith(LORE_MODEL, expect.objectContaining({ max_tokens: 120 }));
  });

  test('reads the OpenAI-style chat completion shape Workers AI now returns', async () => {
    const ai = { run: vi.fn(async () => ({ choices: [{ message: { content: '{"name":"Kaelin Frost","story":"Kaelin naps under the snow."}' } }] })) };
    expect(await generateLore(input, ai as never)).toMatchObject({ name: 'Kaelin Frost', source: 'ai' });
  });

  test('accepts JSON that Workers AI already parsed into an object', async () => {
    const viaResponse = { run: vi.fn(async () => ({ response: { name: 'Auric Mane', story: 'Auric Mane guides the herd home.' } })) };
    const viaChoices = { run: vi.fn(async () => ({ choices: [{ message: { content: { name: 'FroShy', story: 'FroShy sparkles.' } } }] })) };
    expect(await generateLore(input, viaResponse as never)).toMatchObject({ name: 'Auric Mane', source: 'ai' });
    expect(await generateLore(input, viaChoices as never)).toMatchObject({ name: 'FroShy', source: 'ai' });
  });

  test('extracts JSON wrapped in prose or code fences', async () => {
    const ai = aiReturning('Sure! Here it is:\n```json\n{"name": "Ash", "story": "Ash keeps a lantern lit."}\n```');
    expect((await generateLore(input, ai)).name).toBe('Ash');
  });

  test('falls back when the model output is unusable', async () => {
    for (const bad of [
      '',
      'not json',
      '{"name":"A name that is way too long for any card","story":"ok."}',
      '{"name":"R2D2","story":"ok."}',
      `{"name":"Ash","story":"${'x'.repeat(300)}"}`,
      '{"name":"Ash"}',
    ]) {
      const lore = await generateLore(input, aiReturning(bad));
      expect(lore.source).toBe('fallback');
      expect(lore).toMatchObject(fallbackLore(input.yetiId, input.elements));
    }
  });

  test('falls back when the AI call throws', async () => {
    const ai = { run: vi.fn(async () => { throw new Error('quota'); }) };
    expect((await generateLore(input, ai)).source).toBe('fallback');
  });

  test('blocks a word on the deny list and falls back', async () => {
    const lore = await generateLore(input, aiReturning('{"name":"Ash","story":"Ash is a damn good yeti."}'));
    expect(lore.source).toBe('fallback');
  });

  test('prompt mentions the element and every trait word', async () => {
    const ai = aiReturning('{"name":"Ash","story":"Warm."}');
    await generateLore(input, ai);
    const prompt = JSON.stringify((ai.run.mock.calls[0] as unknown[])[1]);
    for (const word of ['Ember', 'curly tufts', 'antlers', 'scarf', 'Rare', 'Common', 'Mutant']) expect(prompt).toContain(word);
  });
});

describe('fallback and names', () => {
  test('fallback is deterministic per yeti and fits the name rules', () => {
    for (let i = 0; i < 50; i++) {
      const id = '0x' + i.toString(16).padStart(64, '0');
      const a = fallbackLore(id, [i % 4]);
      expect(fallbackLore(id, [i % 4])).toEqual(a);
      expect(cleanName(a.name)).toBe(a.name);
      expect(a.story.length).toBeLessThanOrEqual(160);
    }
  });

  test('cleanName trims quotes and punctuation but rejects digits and long names', () => {
    expect(cleanName('  "Gale  the   Swift." ')).toBe('Gale the Swift');
    expect(cleanName("Old O'Malley")).toBe("Old O'Malley");
    expect(cleanName('Yeti 9000')).toBeNull();
    expect(cleanName('One Two Three Four')).toBeNull();
    expect(cleanName('X')).toBeNull();
  });
});

test('every fallback name/title combination passes the name rules', async () => {
  const { FALLBACK_FIRST, FALLBACK_TITLE } = await import('./generate');
  for (const f of FALLBACK_FIRST) for (const t of FALLBACK_TITLE) expect(cleanName(`${f} ${t}`)).toBe(`${f} ${t}`);
});

import { buildPrompt as bp2 } from './generate';
test('a merged yeti prompt names its level and says it grew up', () => {
  const p = bp2({ yetiId: '0x1', elements: [0], variants: [1, 2, 3, 4], mutated: false, level: 3 });
  expect(p).toContain('Ridge Runner');
  expect(p).not.toContain('just hatched');
});

