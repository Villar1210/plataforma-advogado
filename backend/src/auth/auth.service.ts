import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioLogado } from '../common/auth';
import { slugify } from '../common/util';
import { CadastroDto, LoginDto, TrocarSenhaDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async sessao(u: { id: string; tenantId: string; papel: any; superAdmin: boolean }) {
    const payload: UsuarioLogado = { id: u.id, tenantId: u.tenantId, papel: u.papel, superAdmin: u.superAdmin };
    return { token: await this.jwt.signAsync(payload), usuario: await this.me(u.id) };
  }

  async login(dto: LoginDto) {
    const u = await this.prisma.usuario.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { tenant: true },
    });
    if (!u || !u.ativo || !(await bcrypt.compare(dto.senha, u.senhaHash))) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    if (u.tenant.status !== 'ATIVO') throw new ForbiddenException('Escritório suspenso. Fale com o suporte.');
    await this.prisma.usuario.update({ where: { id: u.id }, data: { ultimoLogin: new Date() } });
    return this.sessao(u);
  }

  /** Fase 3: cadastro aberto de escritórios. Desligado por padrão (CADASTRO_ABERTO=true liga). */
  async cadastro(dto: CadastroDto) {
    if (process.env.CADASTRO_ABERTO !== 'true') {
      throw new ForbiddenException('Cadastro de novos escritórios ainda não está aberto');
    }
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new BadRequestException('Já existe uma conta com este e-mail');
    }
    const plano = await this.prisma.plano.findFirst({ where: { nome: 'Essencial' } });
    const tenant = await this.prisma.tenant.create({
      data: {
        nome: dto.escritorio,
        slug: `${slugify(dto.escritorio)}-${Date.now().toString(36)}`,
        oab: dto.oab,
        telefone: dto.telefone,
        email,
        usuarios: {
          create: { nome: dto.nome, email, senhaHash: await bcrypt.hash(dto.senha, 10), papel: 'ADMIN' },
        },
        ...(plano
          ? {
              assinatura: {
                create: {
                  planoId: plano.id,
                  status: 'TRIAL',
                  proximaCobranca: new Date(Date.now() + 14 * 864e5),
                },
              },
            }
          : {}),
      },
      include: { usuarios: true },
    });
    return this.sessao(tenant.usuarios[0]);
  }

  async me(id: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        superAdmin: true,
        whatsapp: true,
        tenant: { select: { id: true, nome: true, slug: true, oab: true } },
      },
    });
    return u;
  }

  async trocarSenha(id: string, dto: TrocarSenhaDto) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id } });
    if (!(await bcrypt.compare(dto.senhaAtual, u.senhaHash))) throw new BadRequestException('Senha atual incorreta');
    await this.prisma.usuario.update({ where: { id }, data: { senhaHash: await bcrypt.hash(dto.novaSenha, 10) } });
    return { ok: true };
  }
}
