import { LEVEL_NAMES } from '@flurry/shared';
import { ELEMENT_NAMES, band } from '@flurry/art';
import { DENY } from '@flurry/shared';

export const LORE_MODEL = '@cf/meta/llama-3.2-3b-instruct';

export type LoreInput = { yetiId: string; elements: number[]; variants: number[]; mutated: boolean; level?: number };
export type GeneratedLore = { name: string; story: string; source: 'ai' | 'fallback' };
type AiContent = string | { name?: unknown; story?: unknown };
type AiOutput = { response?: AiContent; choices?: { message?: { content?: AiContent } }[] };
export type AiLike = { run(model: string, body: unknown): Promise<AiOutput> };

/** Workers AI has returned both `{ response }` and OpenAI-style `{ choices }`; accept either. */
function contentOf(out: AiOutput): AiContent | undefined {
  return out.response ?? out.choices?.[0]?.message?.content;
}

const TRAIT_WORDS = [
  ['shaggy fur', 'curly tufts', 'a long mane', 'frost-tipped fur'],
  ['little nub horns', 'curled ram horns', 'antlers', 'crystal spikes'],
  ['a snowflake mark', 'a scarf', 'a lantern', 'floating orbs'],
];
const BAND_WORD = { common: 'Common', fine: 'Fine', rare: 'Rare', mutant: 'Mutant' } as const;


export const PERSONA =
  'You are Lofi, a gentle yeti frozen in time and woken up by the Sui legends. You are warm, a little sleepy, and kind. ' +
  'You name newborn baby yetis and write one tiny bedtime-story line about each. Family friendly. No emojis.';

export function buildPrompt(input: LoreInput): string {
  const element = input.elements.map((e) => ELEMENT_NAMES[e]).join(' + ');
  const traits = input.variants.slice(0, 3).map((v, i) => `${TRAIT_WORDS[i][v % 4]} (${BAND_WORD[band(v)]})`);
  return (
    ((input.level ?? 1) > 1
      ? `Two yetis merged and grew into a Level ${input.level} ${LEVEL_NAMES[input.level!]}, a ${element} yeti${input.mutated ? ' with a rare mutation' : ''}. It has ${traits.join(', ')}. `
      : `A ${element} yeti just hatched${input.mutated ? ' with a rare mutation' : ''}. It has ${traits.join(', ')}. `) +
    'Give it a cute, easy-to-say name of one or two words, like "Pebble", "Mossy Drift" or "Ember Snowhum" (letters only, max 24 characters). ' +
    'Then write one sentence (max 140 characters) that starts with that exact name and mentions one of its traits. ' +
    'Reply with JSON only: {"name": "...", "story": "..."}'
  );
}

/** Normalises a model-suggested name, or returns null if it breaks the name rules. */
export function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/^["'“”]+|["'“”.!,;:]+$/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 24) return null;
  if (!/^[A-Za-z][A-Za-z' -]*[A-Za-z]$/.test(name)) return null;
  if (name.split(' ').length > 3 || DENY.test(name)) return null;
  return name;
}

function cleanStory(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const story = raw.replace(/\s+/g, ' ').trim();
  if (story.length < 4 || story.length > 160 || DENY.test(story) || /[<>{}]/.test(story)) return null;
  return story;
}

/** JSON text (possibly wrapped in prose) or an object Workers AI already parsed. */
function parse(content: AiContent | undefined): { name?: unknown; story?: unknown } | null {
  if (content && typeof content === 'object') return content;
  const m = content?.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export const FALLBACK_FIRST = ['Pebble', 'Gale', 'Ash', 'Mossy', 'Sleet', 'Flurry', 'Nimbus', 'Tundra', 'Brook', 'Cinder', 'Juniper', 'Willow', 'Puff', 'Drift', 'Kestrel', 'Maple'];
export const FALLBACK_TITLE = ['Snowhum', 'the Brave', 'Lanternfoot', 'Frostwhisker', 'Ridgewalker', 'Cloudnap', 'Iceberry', 'the Sleepy'];
const STORY = [
  (n: string) => `${n} sleeps in snowdrifts and hums whenever the wind changes.`,
  (n: string) => `${n} chases thunderclouds just to hear them giggle.`,
  (n: string) => `${n} paints the night sky green when nobody is watching.`,
  (n: string) => `${n} keeps the cave warm with a heart full of embers.`,
];

/** Safe, deterministic lore used whenever the AI is unavailable or says something unusable. */
export function fallbackLore(yetiId: string, elements: number[]): { name: string; story: string } {
  let h = 0;
  for (const c of yetiId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const name = `${FALLBACK_FIRST[h % FALLBACK_FIRST.length]} ${FALLBACK_TITLE[(h >>> 8) % FALLBACK_TITLE.length]}`;
  return { name, story: STORY[(elements[0] ?? 0) % STORY.length](FALLBACK_FIRST[h % FALLBACK_FIRST.length]) };
}

export async function generateLore(input: LoreInput, ai: AiLike): Promise<GeneratedLore> {
  try {
    const out = await ai.run(LORE_MODEL, {
      messages: [
        { role: 'system', content: PERSONA },
        { role: 'user', content: buildPrompt(input) },
      ],
      max_tokens: 120,
      temperature: 0.9,
    });
    const json = parse(contentOf(out));
    const name = typeof json?.name === 'string' ? cleanName(json.name) : null;
    const story = cleanStory(json?.story);
    if (name && story) return { name, story, source: 'ai' };
  } catch {
    // fall through to the safe fallback
  }
  return { ...fallbackLore(input.yetiId, input.elements), source: 'fallback' };
}
