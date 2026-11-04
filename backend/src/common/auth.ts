import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Papel } from '@prisma/client';

export interface UsuarioLogado {
  id: string;
  tenantId: string;
  papel: Papel;
  superAdmin: boolean;
}

export const PUBLICO = 'rotaPublica';
/** Rota sem login (ex.: portal do correspondente, que usa token próprio). */
export const Publico = () => SetMetadata(PUBLICO, true);

export const PAPEIS = 'papeis';
/** Restringe a rota a alguns papéis. */
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioLogado => {
  return ctx.switchToHttp().getRequest().usuario;
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar');
    try {
      req.usuario = (await this.jwt.verifyAsync(token)) as UsuarioLogado;
    } catch {
      throw new UnauthorizedException('Sessão expirada, faça login novamente');
    }

    const papeis = this.reflector.getAllAndOverride<Papel[]>(PAPEIS, alvos);
    if (papeis?.length && !papeis.includes(req.usuario.papel)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta ação');
    }
    return true;
  }
}
