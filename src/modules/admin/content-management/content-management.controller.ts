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
import { ContentManagementService, ContentQuery } from './content-management.service';

@ApiTags('Admin - Content Management')
@Controller({ path: 'admin/content', version: '4' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentManagementController {
  constructor(private readonly contentService: ContentManagementService) {}

  @Get(':module')
  @ApiOperation({ summary: 'Get content for a specific module' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'search', required: false, type: 'string' })
  @ApiQuery({ name: 'sortBy', required: false, type: 'string' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Content retrieved successfully' })
  async getContent(
    @Param('module') module: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query() filters?: any,
  ) {
    const query: ContentQuery = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      sortBy,
      sortOrder,
      filters,
    };

    const result = await this.contentService.getContent(module, query);
    
    return {
      success: true,
      data: result.data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  @Get(':module/:id')
  @ApiOperation({ summary: 'Get specific content item by ID' })
  @ApiResponse({ status: 200, description: 'Content item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async getContentById(
    @Param('module') module: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const item = await this.contentService.getContentById(module, id);
    
    return {
      success: true,
      data: item,
    };
  }

  @Post(':module')
  @ApiOperation({ summary: 'Create new content item' })
  @ApiBody({
    schema: {
      type: 'object',
      description: 'Content data based on module type',
    },
  })
  @ApiResponse({ status: 201, description: 'Content item created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data provided' })
  async createContent(
    @Param('module') module: string,
    @Body() data: any,
    @Request() req,
  ) {
    const item = await this.contentService.createContent(module, data);
    
    return {
      success: true,
      data: item,
      message: 'Content item created successfully',
    };
  }

  @Put(':module/:id')
  @ApiOperation({ summary: 'Update content item' })
  @ApiBody({
    schema: {
      type: 'object',
      description: 'Updated content data',
    },
  })
  @ApiResponse({ status: 200, description: 'Content item updated successfully' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  @ApiResponse({ status: 400, description: 'Invalid data provided' })
  async updateContent(
    @Param('module') module: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
    @Request() req,
  ) {
    const item = await this.contentService.updateContent(module, id, data);
    
    return {
      success: true,
      data: item,
      message: 'Content item updated successfully',
    };
  }

  @Delete(':module/:id')
  @ApiOperation({ summary: 'Delete content item' })
  @ApiResponse({ status: 200, description: 'Content item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async deleteContent(
    @Param('module') module: string,
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    await this.contentService.deleteContent(module, id);
    
    return {
      success: true,
      message: 'Content item deleted successfully',
    };
  }

  // Bulk operations
  @Post(':module/bulk')
  @ApiOperation({ summary: 'Bulk create content items' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Bulk creation completed' })
  async bulkCreateContent(
    @Param('module') module: string,
    @Body() body: { items: any[] },
    @Request() req,
  ) {
    const results = [];
    const errors = [];

    for (const item of body.items) {
      try {
        const created = await this.contentService.createContent(module, item);
        results.push(created);
      } catch (error) {
        errors.push({ item, error: error.message });
      }
    }

    return {
      success: true,
      data: {
        created: results.length,
        failed: errors.length,
        results,
        errors,
      },
      message: `Bulk creation completed: ${results.length} created, ${errors.length} failed`,
    };
  }

  @Delete(':module/bulk')
  @ApiOperation({ summary: 'Bulk delete content items' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Bulk deletion completed' })
  async bulkDeleteContent(
    @Param('module') module: string,
    @Body() body: { ids: number[] },
    @Request() req,
  ) {
    const results = [];
    const errors = [];

    for (const id of body.ids) {
      try {
        await this.contentService.deleteContent(module, id);
        results.push(id);
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    return {
      success: true,
      data: {
        deleted: results.length,
        failed: errors.length,
        results,
        errors,
      },
      message: `Bulk deletion completed: ${results.length} deleted, ${errors.length} failed`,
    };
  }

  // Export/Import operations
  @Get(':module/export')
  @ApiOperation({ summary: 'Export content data' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Export completed' })
  async exportContent(
    @Param('module') module: string,
    @Query('format') format: string = 'json',
    @Query() query: ContentQuery,
  ) {
    const result = await this.contentService.getContent(module, { ...query, limit: 10000 });
    
    if (format === 'csv') {
      // Convert to CSV format
      const csv = this.convertToCSV(result.data);
      return {
        success: true,
        data: csv,
        format: 'csv',
        filename: `${module}_export.csv`,
      };
    }

    return {
      success: true,
      data: result.data,
      format: 'json',
      filename: `${module}_export.json`,
    };
  }

  @Post(':module/import')
  @ApiOperation({ summary: 'Import content data' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        format: { type: 'string', enum: ['json', 'csv'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Import completed' })
  async importContent(
    @Param('module') module: string,
    @Body() body: { data: any[]; format: string },
    @Request() req,
  ) {
    const results = [];
    const errors = [];

    for (const item of body.data) {
      try {
        const created = await this.contentService.createContent(module, item);
        results.push(created);
      } catch (error) {
        errors.push({ item, error: error.message });
      }
    }

    return {
      success: true,
      data: {
        imported: results.length,
        failed: errors.length,
        results,
        errors,
      },
      message: `Import completed: ${results.length} imported, ${errors.length} failed`,
    };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}
