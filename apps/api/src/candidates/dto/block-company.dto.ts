import { IsString, IsUUID, ValidateIf } from 'class-validator';

export class BlockCompanyDto {
  @ValidateIf((o) => !o.companyNameText)
  @IsUUID()
  companyId?: string;

  @ValidateIf((o) => !o.companyId)
  @IsString()
  companyNameText?: string;
}
