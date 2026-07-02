import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

// `tags` is sent as a JSON-encoded string over multipart/form-data (document
// create) but as a real array over JSON (document update). Normalize both to a
// string array so the global ValidationPipe + Prisma receive the right shape.
function toStringArray({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [trimmed];
  } catch {
    // Fallback: treat a bare/comma-separated string as tags.
    return trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  }
}

export class CreateDocumentDto {
  @ApiProperty({ example: 'Safety Procedures Manual' })
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: ['sop', 'policy', 'manual', 'procedure', 'guideline'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, example: ['safety', 'operations'] })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, enum: ['draft', 'published'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateDocCategoryDto {
  @ApiProperty({ example: 'Safety' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'safety' })
  @IsString()
  slug!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UploadVersionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  changeNote?: string;
}
