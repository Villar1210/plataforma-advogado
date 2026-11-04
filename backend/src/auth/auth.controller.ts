import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publico, Usuario, UsuarioLogado } from '../common/auth';
import { CadastroDto, LoginDto, TrocarSenhaDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cadastro')
  cadastro(@Body() dto: CadastroDto) {
    return this.auth.cadastro(dto);
  }

  @Get('me')
  me(@Usuario() u: UsuarioLogado) {
    return this.auth.me(u.id);
  }

  @Post('senha')
  trocarSenha(@Usuario() u: UsuarioLogado, @Body() dto: TrocarSenhaDto) {
    return this.auth.trocarSenha(u.id, dto);
  }
}
