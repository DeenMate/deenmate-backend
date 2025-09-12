import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordValidator } from '../../../common/utils/password-validator.util';
import * as bcrypt from 'bcryptjs';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'super_admin' | 'editor' | 'viewer';
  permissions?: string[];
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'super_admin' | 'editor' | 'viewer';
  permissions?: string[];
  isActive?: boolean;
}

export interface UserResponse {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogDto {
  userId: number;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // User CRUD Operations
  async createUser(createUserDto: CreateUserDto): Promise<UserResponse> {
    const { email, password, firstName, lastName, role, permissions = [] } = createUserDto;

    // Validate password strength
    const passwordValidation = PasswordValidator.validate(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: PasswordValidator.getPasswordRequirements()
      });
    }

    // Check if user already exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        permissions,
      }
    });

    this.logger.log(`User created: ${email} with role: ${role}`);

    return this.mapUserToResponse(user);
  }

  async getAllUsers(): Promise<UserResponse[]> {
    const users = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return users.map(user => this.mapUserToResponse(user));
  }

  async getUserById(id: number): Promise<UserResponse> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUserToResponse(user);
  }

  async getUserByEmail(email: string): Promise<UserResponse> {
    const user = await this.prisma.adminUser.findUnique({
      where: { email }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUserToResponse(user);
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { id }
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.adminUser.findUnique({
        where: { email: updateUserDto.email }
      });

      if (emailExists) {
        throw new ConflictException('Email already taken');
      }
    }

    const updatedUser = await this.prisma.adminUser.update({
      where: { id },
      data: updateUserDto
    });

    this.logger.log(`User updated: ${updatedUser.email}`);

    return this.mapUserToResponse(updatedUser);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deletion of the last super admin
    if (user.role === 'super_admin') {
      const superAdminCount = await this.prisma.adminUser.count({
        where: { role: 'super_admin' }
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last super admin');
      }
    }

    await this.prisma.adminUser.delete({
      where: { id }
    });

    this.logger.log(`User deleted: ${user.email}`);
  }

  async changePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash: newPasswordHash }
    });

    this.logger.log(`Password changed for user: ${user.email}`);
  }

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash: newPasswordHash }
    });

    this.logger.log(`Password reset for user: ${user.email}`);
  }

  // Audit Logging
  async createAuditLog(auditLogDto: AuditLogDto): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: auditLogDto
    });
  }

  async getAuditLogs(
    userId?: number,
    action?: string,
    resource?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;

    const logs = await this.prisma.adminAuditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return logs;
  }

  // Permission Management
  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true }
    });

    if (!user) return false;

    // Super admin has all permissions
    if (user.role === 'super_admin') return true;

    // Check specific permissions
    return user.permissions.includes(permission);
  }

  async updateUserPermissions(userId: number, permissions: string[]): Promise<UserResponse> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { permissions }
    });

    this.logger.log(`Permissions updated for user: ${user.email}`);

    return this.mapUserToResponse(updatedUser);
  }

  // Statistics
  async getUserStats(): Promise<any> {
    const totalUsers = await this.prisma.adminUser.count();
    const activeUsers = await this.prisma.adminUser.count({
      where: { isActive: true }
    });
    const roleStats = await this.prisma.adminUser.groupBy({
      by: ['role'],
      _count: { role: true }
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      roleStats: roleStats.map(stat => ({
        role: stat.role,
        count: stat._count.role
      }))
    };
  }

  // Helper Methods
  private mapUserToResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  // Role-based permissions
  getDefaultPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      viewer: [
        'read:quran',
        'read:hadith',
        'read:prayer',
        'read:finance',
        'read:audio',
        'read:users'
      ],
      editor: [
        'read:quran',
        'read:hadith',
        'read:prayer',
        'read:finance',
        'read:audio',
        'read:users',
        'update:quran',
        'update:hadith',
        'update:prayer',
        'update:finance',
        'update:audio',
        'sync:quran',
        'sync:hadith',
        'sync:prayer',
        'sync:finance',
        'sync:audio'
      ],
      admin: [
        'read:quran',
        'read:hadith',
        'read:prayer',
        'read:finance',
        'read:audio',
        'read:users',
        'create:users',
        'update:quran',
        'update:hadith',
        'update:prayer',
        'update:finance',
        'update:audio',
        'update:users',
        'delete:users',
        'sync:quran',
        'sync:hadith',
        'sync:prayer',
        'sync:finance',
        'sync:audio'
      ],
      super_admin: [
        // Super admin has all permissions
        'all'
      ]
    };

    return permissions[role] || [];
  }
}
