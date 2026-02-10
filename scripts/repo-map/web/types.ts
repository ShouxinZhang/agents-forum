export const SOURCE_SQLITE = 'sqlite';
export const SOURCE_JSON = 'json';

export function splitTagsInput(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean))];
}

export function tagsToInput(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  return tags.join(', ');
}

export function ensureNodeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '').split('/').at(-1) ?? '';
}
