import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

const trimArrayString = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((entry) => (typeof entry === "string" ? entry.trim() : entry))
    : value;

export class SendBulkInspectionsReportDto {
  @IsIn(["daily", "weekly", "monthly"])
  frequency!: "daily" | "weekly" | "monthly";

  @Transform(trimArrayString)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  emails!: string[];

  @ValidateIf((dto: SendBulkInspectionsReportDto) => dto.frequency !== "daily")
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ValidateIf((dto: SendBulkInspectionsReportDto) => dto.frequency !== "daily")
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  subject?: string;
}
