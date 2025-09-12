import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthService, AdminLoginDto, AdminLoginResponse } from './admin-auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Admin Authentication')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                email: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: AdminLoginDto): Promise<{ success: boolean; data: AdminLoginResponse }> {
    const result = await this.adminAuthService.login(loginDto);
    return {
      success: true,
      data: result,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req): Promise<{ success: boolean; data: any }> {
    return {
      success: true,
      data: req.user,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ 
    status: 200, 
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() body: { refreshToken: string }): Promise<{ success: boolean; data: { accessToken: string; refreshToken: string } }> {
    const result = await this.adminAuthService.refreshToken(body.refreshToken);
    return {
      success: true,
      data: result,
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change admin password' })
  @ApiResponse({ 
    status: 200, 
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid password or requirements not met' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Request() req,
    @Body() body: { currentPassword: string; newPassword: string }
  ): Promise<{ success: boolean; message: string }> {
    return await this.adminAuthService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword
    );
  }

  @Get('password-requirements')
  @ApiOperation({ summary: 'Get password requirements' })
  @ApiResponse({ 
    status: 200, 
    description: 'Password requirements retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  })
  async getPasswordRequirements(): Promise<{ success: boolean; data: string[] }> {
    const { PasswordValidator } = await import('../../../common/utils/password-validator.util');
    return {
      success: true,
      data: PasswordValidator.getPasswordRequirements()
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(): Promise<{ success: boolean; message: string }> {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // We could implement token blacklisting here if needed
    return {
      success: true,
      message: 'Logout successful',
    };
  }
}
