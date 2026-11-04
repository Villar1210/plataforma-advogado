import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Papel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Papeis, Usuario, UsuarioLogado } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

class EscritorioDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @IsString() oab?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefone?: string;
}

class NovoUsuarioDto {
  @IsString() @IsNotEmpty({ message: 'Informe o nome' }) nome!: string;
  @IsEmail({}, { message: 'E-mail inválido' }) email!: string;
  @IsString() @MinLength(8, { message: 'A senha precisa de pelo menos 8 caracteres' }) senha!: string;
  @IsEnum(Papel) papel!: Papel;
  @IsOptional() @IsString() whatsapp?: string;
}

class EditarUsuarioDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEnum(Papel) papel?: Papel;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() @MinLength(8) senha?: string;
}

const SELECT_USUARIO = { id: true, nome: true, email: true, papel: true, ativo: true, whatsapp: true, ultimoLogin: true };

@Controller('escritorio')
export class EscritorioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  obter(@Usuario() u: UsuarioLogado) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: u.tenantId },
      select: {
        id: true,
        nome: true,
        documento: true,
        oab: true,
        email: true,
        telefone: true,
        assinatura: { select: { status: true, plano: { select: { nome: true } } } },
      },
    });
  }

  @Papeis('ADMIN')
  @Patch()
  atualizar(@Usuario() u: UsuarioLogado, @Body() dto: EscritorioDto) {
    return this.prisma.tenant.update({ where: { id: u.tenantId }, data: dto, select: { id: true, nome: true } });
  }

  @Get('usuarios')
  usuarios(@Usuario() u: UsuarioLogado) {
    return this.prisma.usuario.findMany({ where: { tenantId: u.tenantId }, select: SELECT_USUARIO, orderBy: { nome: 'asc' } });
  }

  @Papeis('ADMIN')
  @Post('usuarios')
  async criarUsuario(@Usuario() u: UsuarioLogado, @Body() dto: NovoUsuarioDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new BadRequestException('Já existe um usuário com este e-mail');
    }
    return this.prisma.usuario.create({
      data: {
        tenantId: u.tenantId,
        nome: dto.nome,
        email,
        papel: dto.papel,
        whatsapp: dto.whatsapp,
        senhaHash: await bcrypt.hash(dto.senha, 10),
      },
      select: SELECT_USUARIO,
    });
  }

  @Papeis('ADMIN')
  @Patch('usuarios/:id')
  async editarUsuario(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: EditarUsuarioDto) {
    const alvo = await this.prisma.usuario.findFirst({ where: { id, tenantId: u.tenantId } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado');
    if (id === u.id && (dto.ativo === false || (dto.papel && dto.papel !== 'ADMIN'))) {
      throw new BadRequestException('Você não pode desativar nem rebaixar a si mesmo');
    }
    const { senha, ...resto } = dto;
    return this.prisma.usuario.update({
      where: { id },
      data: { ...resto, ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}) },
      select: SELECT_USUARIO,
    });
  }
}
