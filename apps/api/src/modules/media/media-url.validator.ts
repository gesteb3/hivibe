import {
  isURL,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/** HTTPS remoto o URL del proveedor local configurado (HTTP solo en localhost). */
@ValidatorConstraint({ name: 'mediaUrl', async: false })
export class MediaUrlValidator implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    if (isURL(value, { protocols: ['https'], require_protocol: true }))
      return true;
    if (process.env.MEDIA_PROVIDER !== 'local') return false;
    try {
      const base = new URL(process.env.MEDIA_PUBLIC_URL ?? '');
      const url = new URL(value);
      return (
        base.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) &&
        url.origin === base.origin &&
        !url.username &&
        !url.password &&
        url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/') &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }
  defaultMessage() {
    return 'Debe ser una URL HTTPS válida o una imagen del servidor local configurado';
  }
}
