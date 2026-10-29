/**
 * ÚNICO archivo que depende del código de Guillermo (auth + Prisma).
 * Si sus rutas/nombres son distintos, ajusta SOLO estas dos líneas.
 */
export { PrismaService } from '../../database/prisma.service';
export { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
