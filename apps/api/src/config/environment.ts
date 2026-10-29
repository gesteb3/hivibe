export function validateEnvironment(env: Record<string, unknown>) {
  const secret = env.JWT_SECRET;
  if (
    typeof secret !== 'string' ||
    secret.length < 32 ||
    /CHANGE_|REEMPLAZAR/i.test(secret)
  )
    throw new Error(
      'JWT_SECRET debe ser aleatorio y tener al menos 32 caracteres',
    );
  for (const key of ['DATABASE_URL', 'FRONTEND_URL']) {
    if (typeof env[key] !== 'string' || !env[key])
      throw new Error(`Falta ${key}`);
  }
  const frontend = new URL(String(env.FRONTEND_URL));
  if (
    !['http:', 'https:'].includes(frontend.protocol) ||
    frontend.origin !== env.FRONTEND_URL
  )
    throw new Error(
      'FRONTEND_URL debe ser un origen exacto, sin ruta ni barra final',
    );
  const provider = env.MEDIA_PROVIDER ?? 'cloudinary';
  if (
    typeof provider !== 'string' ||
    !['local', 'cloudinary'].includes(provider)
  )
    throw new Error('MEDIA_PROVIDER inválido');
  if (provider === 'local') {
    if (typeof env.MEDIA_PUBLIC_URL !== 'string')
      throw new Error('Falta MEDIA_PUBLIC_URL');
    const media = new URL(env.MEDIA_PUBLIC_URL);
    if (
      media.username ||
      media.password ||
      media.search ||
      media.hash ||
      media.pathname.replace(/\/$/, '') !== '/media' ||
      (media.protocol !== 'https:' &&
        !(
          media.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(media.hostname)
        ))
    )
      throw new Error(
        'MEDIA_PUBLIC_URL debe terminar en /media y usar HTTPS (HTTP solo localhost)',
      );
  }
  return env;
}
