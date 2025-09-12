import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordValidator } from '../../../common/utils/password-validator.util';
import * as bcrypt from 'bcryptjs';

export interface AdminLoginDto {
  email: string;
  password: string;
}

export interface AdminUserPayload {
  sub: number;
  email: string;
  role: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateAdmin(email: string, password: string): Promise<any> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin || !admin.isActive) {
      this.logger.warn(`Login attempt with invalid email: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Login attempt with invalid password for email: ${email}`);
      return null;
    }

    // Update last login time
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash, ...result } = admin;
    return result;
  }

  async login(loginDto: AdminLoginDto): Promise<AdminLoginResponse> {
    const admin = await this.validateAdmin(loginDto.email, loginDto.password);
    
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AdminUserPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m', // 15 minutes
    });

    // Generate refresh token (long-lived)
    const refreshToken = this.jwtService.sign(
      { sub: admin.id, type: 'refresh' },
      { expiresIn: '7d' } // 7 days
    );

    this.logger.log(`Admin user ${admin.email} logged in successfully`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken);
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get the user to ensure they still exist and are active
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new access token
      const newPayload: AdminUserPayload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '15m', // 15 minutes
      });

      // Generate new refresh token (rotate refresh token for security)
      const newRefreshToken = this.jwtService.sign(
        { sub: admin.id, type: 'refresh' },
        { expiresIn: '7d' } // 7 days
      );

      this.logger.log(`Refresh token used for admin user ${admin.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      this.logger.error(`Refresh token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(payload: AdminUserPayload): Promise<any> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      return null;
    }

    const { passwordHash, ...result } = admin;
    return result;
  }

  async createAdmin(email: string, password: string, role: string = 'admin'): Promise<any> {
    // Validate password strength
    const passwordValidation = PasswordValidator.validate(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: PasswordValidator.getPasswordRequirements()
      });
    }

    // Check if admin with this email already exists
    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin user with this email already exists');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const admin = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role,
        isActive: true,
      },
    });

    this.logger.log(`New admin user created: ${email} with role: ${role}`);

    const { passwordHash: _, ...result } = admin;
    return result;
  }

  async changePassword(adminId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Get the admin user
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId }
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = PasswordValidator.validate(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: PasswordValidator.getPasswordRequirements()
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash: newPasswordHash }
    });

    this.logger.log(`Password changed for admin user: ${admin.email}`);

    return {
      success: true,
      message: 'Password changed successfully'
    };
  }

  async getAdminById(id: number): Promise<any> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      return null;
    }

    const { passwordHash, ...result } = admin;
    return result;
  }
}
