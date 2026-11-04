import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CorrespondenteDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  nome!: string;

  @IsString()
  @Length(10, 15, { message: 'WhatsApp inválido (use DDD + número)' })
  whatsapp!: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @IsOptional()
  @IsBoolean()
  ehAdvogado?: boolean;

  @IsOptional()
  @IsString()
  oab?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  oabUf?: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsOptional()
  @IsIn(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'])
  pixTipo?: string;

  @IsOptional()
  @IsString()
  pixChave?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsInt({ each: true })
  cidadeIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  servicoIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorReferencia?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  favorito?: boolean;
}
