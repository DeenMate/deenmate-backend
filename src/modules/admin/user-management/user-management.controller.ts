import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserManagementService, CreateUserDto, UpdateUserDto, AuditLogDto } from './user-management.service';

@ApiTags('Admin - User Management')
@Controller({ path: 'admin/users', version: '4' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new admin user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password', 'role'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'super_admin', 'editor', 'viewer'] },
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createUser(@Body() createUserDto: CreateUserDto, @Request() req) {
    const result = await this.userManagementService.createUser(createUserDto);
    
    // Log the action
    await this.userManagementService.createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      resource: 'user',
      resourceId: result.id.toString(),
      details: { createdUser: result.email, role: result.role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return {
      success: true,
      data: result,
      message: 'User created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all admin users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers() {
    const users = await this.userManagementService.getAllUsers();
    return {
      success: true,
      data: users,
      count: users.length,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getUserStats() {
    const stats = await this.userManagementService.getUserStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({ name: 'userId', required: false, type: 'number' })
  @ApiQuery({ name: 'action', required: false, type: 'string' })
  @ApiQuery({ name: 'resource', required: false, type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'offset', required: false, type: 'number' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const logs = await this.userManagementService.getAuditLogs(
      userId ? parseInt(userId) : undefined,
      action,
      resource,
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      data: logs,
      count: logs.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userManagementService.getUserById(id);
    return {
      success: true,
      data: user,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'super_admin', 'editor', 'viewer'] },
        permissions: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already taken' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const result = await this.userManagementService.updateUser(id, updateUserDto);
    
    // Log the action
    await this.userManagementService.createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id.toString(),
      details: { updatedFields: Object.keys(updateUserDto) },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return {
      success: true,
      data: result,
      message: 'User updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete last super admin' })
  async deleteUser(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const user = await this.userManagementService.getUserById(id);
    await this.userManagementService.deleteUser(id);
    
    // Log the action
    await this.userManagementService.createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      resource: 'user',
      resourceId: id.toString(),
      details: { deletedUser: user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  @Post(':id/change-password')
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: { type: 'string' },
        newPassword: { type: 'string', minLength: 8 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentPassword: string; newPassword: string },
    @Request() req,
  ) {
    await this.userManagementService.changePassword(
      id,
      body.currentPassword,
      body.newPassword,
    );
    
    // Log the action
    await this.userManagementService.createAuditLog({
      userId: req.user.id,
      action: 'CHANGE_PASSWORD',
      resource: 'user',
      resourceId: id.toString(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['newPassword'],
      properties: {
        newPassword: { type: 'string', minLength: 8 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { newPassword: string },
    @Request() req,
  ) {
    await this.userManagementService.resetPassword(id, body.newPassword);
    
    // Log the action
    await this.userManagementService.createAuditLog({
      userId: req.user.id,
      action: 'RESET_PASSWORD',
      resource: 'user',
      resourceId: id.toString(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Update user permissions' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['permissions'],
      properties: {
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { permissions: string[] },
    @Request() req,
  ) {
    const result = await this.userManagementService.updateUserPermissions(
      id,
      body.permissions,
    );
    
    // Log the action
    await this.userManagementService.createAuditLog({
      userId: req.user.id,
      action: 'UPDATE_PERMISSIONS',
      resource: 'user',
      resourceId: id.toString(),
      details: { permissions: body.permissions },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return {
      success: true,
      data: result,
      message: 'Permissions updated successfully',
    };
  }

  @Get('permissions/check')
  @ApiOperation({ summary: 'Check if user has permission' })
  @ApiQuery({ name: 'permission', required: true, type: 'string' })
  @ApiResponse({ status: 200, description: 'Permission check result' })
  async checkPermission(
    @Query('permission') permission: string,
    @Request() req,
  ) {
    const hasPermission = await this.userManagementService.hasPermission(
      req.user.id,
      permission,
    );

    return {
      success: true,
      data: { hasPermission },
    };
  }
}
