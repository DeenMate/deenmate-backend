import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v4';

export interface ModuleData {
  name: string;
  recordCount: number;
  lastSync: string | null;
  syncStatus: 'success' | 'failed' | 'pending' | 'idle';
  isHealthy: boolean;
  details: Record<string, any>;
}

export interface DashboardSummary {
  modules: ModuleData[];
  systemHealth: {
    isHealthy: boolean;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

export interface AdminLoginDto {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  roleStats: Array<{
    role: string;
    count: number;
  }>;
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes timeout for long-running sync operations
});

// Add request interceptor to automatically add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage if not already set
    if (!config.headers.Authorization) {
      const token = localStorage.getItem('adminToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors properly
api.interceptors.response.use(
  (response) => {
    // Check if response is actually JSON
    const contentType = response.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      console.error('Non-JSON response received:', response.data);
      throw new Error('Server returned non-JSON response');
    }
    return response;
  },
  async (error) => {
    // Handle 401 errors by clearing token and redirecting
    if (error.response?.status === 401) {
      console.log('Authentication expired, clearing token');
      localStorage.removeItem('adminToken');
      clearAccessToken();
      
      // Redirect to login if we're in the browser
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    // Handle network errors and non-JSON responses
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      if (contentType && !contentType.includes('application/json')) {
        console.error('Non-JSON error response received:', error.response.data);
        error.message = 'Server returned non-JSON response';
      }
    } else if (error.request) {
      console.error('Network error:', error.request);
      error.message = 'Network error - please check your connection';
    } else {
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Token management
let accessToken: string | null = null;

export const setAccessToken = (token: string) => {
  accessToken = token;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearAccessToken = () => {
  accessToken = null;
  delete api.defaults.headers.common['Authorization'];
};

export const getAccessToken = () => accessToken;

// Initialize token from localStorage
export const initializeAuth = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setAccessToken(token);
    }
  }
};

// Auth endpoints
export const authAPI = {
  login: async (credentials: AdminLoginDto): Promise<AdminLoginResponse> => {
    const response = await api.post('/admin/auth/login', credentials);
    return response.data.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/admin/auth/logout');
    clearAccessToken();
  },
  getProfile: async (): Promise<any> => {
    const response = await api.get('/admin/auth/profile');
    return response.data.data;
  },
};

// Admin endpoints
export const apiClient = {
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get('/admin/summary');
    return response.data.data;
  },
  triggerModuleSync: async (module: string): Promise<{ success: boolean; message: string }> => {
    // Special-case prayer: call prewarm for today (days=1) to sync all cities, methods, madhabs
    if (module === 'prayer') {
      console.log('🕌 Prayer sync: Making request to /admin/sync/prayer/prewarm with days=1');
      console.log('🔑 Using token:', localStorage.getItem('adminToken')?.substring(0, 20) + '...');
      console.log('🌐 API Base URL:', API_BASE_URL);
      
      try {
        const response = await api.post(`/admin/sync/prayer/prewarm`, {}, { params: { days: 1 } });
        console.log('✅ Prayer sync response:', response.status, response.data);
        return {
          success: response.data.success,
          message: response.data.message
        };
      } catch (error: any) {
        console.error('❌ Prayer sync error:', error.response?.status, error.response?.data || error.message);
        throw error;
      }
    }
    const response = await api.post(`/admin/sync/${module}`);
    return {
      success: response.data.success,
      message: response.data.message
    };
  },
  getSystemHealth: async (): Promise<any> => {
    const response = await api.get('/admin/health');
    return response.data.data;
  },
  getSyncLogs: async (limit: number = 50): Promise<any[]> => {
    const response = await api.get(`/admin/sync-logs?limit=${limit}`);
    return response.data.data.logs;
  },
  clearCache: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/admin/cache/clear');
    return response.data.data;
  },

  // User Management API
  getUsers: async (): Promise<{ success: boolean; data: User[]; count: number }> => {
    const response = await api.get('/admin/users');
    return response.data;
  },

  getUserById: async (id: number): Promise<{ success: boolean; data: User }> => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  createUser: async (userData: CreateUserDto): Promise<{ success: boolean; data: User; message: string }> => {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },

  updateUser: async (id: number, userData: UpdateUserDto): Promise<{ success: boolean; data: User; message: string }> => {
    const response = await api.put(`/admin/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },

  changePassword: async (id: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/admin/users/${id}/change-password`, {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  resetPassword: async (id: number, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/admin/users/${id}/reset-password`, {
      newPassword,
    });
    return response.data;
  },

  updateUserPermissions: async (id: number, permissions: string[]): Promise<{ success: boolean; data: User; message: string }> => {
    const response = await api.put(`/admin/users/${id}/permissions`, { permissions });
    return response.data;
  },

  getUserStats: async (): Promise<{ success: boolean; data: UserStats }> => {
    const response = await api.get('/admin/users/stats');
    return response.data;
  },

  getAuditLogs: async (params?: {
    userId?: number;
    action?: string;
    resource?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data: AuditLog[]; count: number }> => {
    const response = await api.get('/admin/users/audit-logs', { params });
    return response.data;
  },

  checkPermission: async (permission: string): Promise<{ success: boolean; data: { hasPermission: boolean } }> => {
    const response = await api.get('/admin/users/permissions/check', {
      params: { permission },
    });
    return response.data;
  },

  // Content Management API
  getContent: async (module: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    [key: string]: any;
  }): Promise<{ success: boolean; data: any[]; pagination: any }> => {
    const response = await api.get(`/admin/content/${module}`, { params });
    return response.data;
  },

  getContentById: async (module: string, id: number): Promise<{ success: boolean; data: any }> => {
    const response = await api.get(`/admin/content/${module}/${id}`);
    return response.data;
  },

  createContent: async (module: string, data: any): Promise<{ success: boolean; data: any; message: string }> => {
    const response = await api.post(`/admin/content/${module}`, data);
    return response.data;
  },

  updateContent: async (module: string, id: number, data: any): Promise<{ success: boolean; data: any; message: string }> => {
    const response = await api.put(`/admin/content/${module}/${id}`, data);
    return response.data;
  },

  deleteContent: async (module: string, id: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/admin/content/${module}/${id}`);
    return response.data;
  },

  bulkCreateContent: async (module: string, items: any[]): Promise<{ success: boolean; data: any; message: string }> => {
    const response = await api.post(`/admin/content/${module}/bulk`, { items });
    return response.data;
  },

  bulkDeleteContent: async (module: string, ids: number[]): Promise<{ success: boolean; data: any; message: string }> => {
    const response = await api.delete(`/admin/content/${module}/bulk`, { data: { ids } });
    return response.data;
  },

  exportContent: async (module: string, format: 'json' | 'csv' = 'json', params?: any): Promise<{ success: boolean; data: any; format: string; filename: string }> => {
    const response = await api.get(`/admin/content/${module}/export`, { 
      params: { format, ...params } 
    });
    return response.data;
  },

  // Prayer Times specific API methods
  getPrayerMethods: async (): Promise<{ success: boolean; data: any[] }> => {
    const response = await api.get('/admin/prayer-filters/methods');
    return response.data;
  },

  getPrayerMadhabs: async (): Promise<{ success: boolean; data: any[] }> => {
    const response = await api.get('/admin/prayer-filters/madhabs');
    return response.data;
  },

  importContent: async (module: string, data: any[], format: 'json' | 'csv' = 'json'): Promise<{ success: boolean; data: any; message: string }> => {
    const response = await api.post(`/admin/content/${module}/import`, { data, format });
    return response.data;
  },
};
