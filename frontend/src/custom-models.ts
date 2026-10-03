import type { Model } from './types';

export const CUSTOM_MODELS_KEY = 'legalthink-custom-models';
export const CUSTOM_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
export const MAX_CUSTOM_MODELS = 20;

export function validModelId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value) && !/^(sk-|https?:)/i.test(value);
}

export function readCustomModels(): Model[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CUSTOM_MODELS_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    return saved.slice(0, MAX_CUSTOM_MODELS).flatMap((item) => {
      if (!item || typeof item.id !== 'string' || !validModelId(item.id) || seen.has(item.id))
        return [];
      seen.add(item.id);
      return [
        {
          id: item.id,
          name: item.id,
          custom: true,
          default_effort: 'auto',
          efforts: [
            'auto',
            ...CUSTOM_EFFORTS.filter(
              (value) => Array.isArray(item.efforts) && item.efforts.includes(value),
            ),
          ],
          supports_web_search: item.supports_web_search === true,
        },
      ];
    });
  } catch {
    return [];
  }
}
