import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const sanitizeText = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class ListReportInspectionsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(sanitizeText)
  @IsString()
  driverId?: string;

  @IsOptional()
  @Transform(sanitizeText)
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @Transform(sanitizeText)
  @IsString()
  createdBy?: string;

  @IsOptional()
  @Transform(sanitizeText)
  @IsIn(["DRAFT", "FINALIZED", "REPORTED"])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}
