import { ApiProperty } from '@nestjs/swagger';
export class LoginUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() displayName!: string;
}
export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
  @ApiProperty({ example: 3600 }) expiresIn!: number;
  @ApiProperty({ type: LoginUserDto }) user!: LoginUserDto;
}
