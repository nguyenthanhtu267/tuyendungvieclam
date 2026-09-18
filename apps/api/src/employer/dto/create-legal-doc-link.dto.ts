import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLegalDocLinkDto {
  @IsNotEmpty({ message: 'Vui lòng dán link Google Drive' })
  @IsString()
  externalLinkUrl: string;
}
