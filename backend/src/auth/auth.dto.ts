import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha' })
  senha!: string;
}

export class CadastroDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do escritório' })
  escritorio!: string;
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  nome!: string;
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;
  @IsString()
  @MinLength(8, { message: 'A senha precisa de pelo menos 8 caracteres' })
  senha!: string;
  @IsOptional()
  @IsString()
  oab?: string;
  @IsOptional()
  @IsString()
  telefone?: string;
}

export class TrocarSenhaDto {
  @IsString()
  senhaAtual!: string;
  @IsString()
  @MinLength(8, { message: 'A nova senha precisa de pelo menos 8 caracteres' })
  novaSenha!: string;
}
