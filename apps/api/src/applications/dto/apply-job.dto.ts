import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ApplyJobDto {
  @IsUUID()
  cvId: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;
}
