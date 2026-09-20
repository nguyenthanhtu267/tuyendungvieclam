import { IsString, MaxLength, MinLength } from 'class-validator';

export class PingDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  sessionId: string;
}
