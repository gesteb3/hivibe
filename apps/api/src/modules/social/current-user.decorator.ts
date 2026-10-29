import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Devuelve el id del usuario autenticado (claim `sub` del JWT). Nunca se lee del body. */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const user = ctx.switchToHttp().getRequest().user;
  const id = user?.sub ?? user?.id ?? user?.userId;
  if (!id) throw new UnauthorizedException();
  return String(id);
});
