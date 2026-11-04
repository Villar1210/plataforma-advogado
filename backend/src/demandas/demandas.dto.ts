import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DemandaStatus, ModoContratacao, TipoCorrespondente } from '@prisma/client';

export class DemandaDto {
  @Type(() => Number)
  @IsInt({ message: 'Escolha a cidade' })
  cidadeId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  servicoId?: number;

  @IsOptional()
  @IsString()
  servicoTexto?: string;

  @IsOptional()
  @IsEnum(TipoCorrespondente)
  tipoCorrespondente?: TipoCorrespondente;

  @IsOptional()
  @IsEnum(ModoContratacao)
  modo?: ModoContratacao;

  @IsOptional() @IsString() processoNumero?: string;
  @IsOptional() @IsString() partes?: string;
  @IsOptional() @IsString() orgao?: string;
  @IsOptional() @IsString() local?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Prazo inválido' })
  prazo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valor?: number;

  @IsString()
  @IsNotEmpty({ message: 'Descreva o serviço' })
  descricao!: string;

  @IsOptional() @IsString() instrucoes?: string;
}

export class EnviarDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Escolha pelo menos um correspondente' })
  @IsString({ each: true })
  correspondenteIds!: string[];
}

export class MotivoDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo' })
  motivo!: string;
}

export class AvaliarDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  nota!: number;

  @IsOptional()
  @IsBoolean()
  noPrazo?: boolean;

  @IsOptional()
  @IsString()
  comentario?: string;
}

export class FiltroDemandasDto {
  @IsOptional() @IsEnum(DemandaStatus) status?: DemandaStatus;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() cidadeId?: number;
  @IsOptional() @IsString() correspondenteId?: string;
  @IsOptional() @IsIn(['true', 'false']) incluirEncerradas?: string;
}

export class AceiteDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorProposto?: number;

  @IsOptional()
  @IsString()
  mensagem?: string;
}

export class EntregaDto {
  @IsOptional()
  @IsString()
  observacao?: string;
}
