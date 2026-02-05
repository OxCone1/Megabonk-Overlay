const getBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.BASE_URL === 'string') {
    return import.meta.env.BASE_URL;
  }
  return '/';
};

export function resolvePublicAssetPath(relativePath) {
  if (!relativePath) return relativePath;
  const baseUrl = getBaseUrl();
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const trimmedPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}${trimmedPath}`;
}
