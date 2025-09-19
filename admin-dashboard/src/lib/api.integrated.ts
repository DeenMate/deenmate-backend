/**
 * Integrated API Client for Next.js + NestJS Integration
 * 
 * This version uses relative URLs since both frontend and backend
 * are served from the same domain in the integrated setup.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Use relative URLs for integrated setup
const API_BASE_URL = '/api';

// Create axios instance with integrated configuration
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes timeout for long-running sync operations
  withCredentials: true, // Include cookies for session-based auth
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface ModuleData {
  name: string;
  recordCount: number;
  lastSync: string | null;
  syncStatus: 'success' | 'failed' | 'pending' | 'idle';
  isHealthy: boolean;
}

export interface DashboardSummary {
  modules: ModuleData[];
  systemHealth: {
    database: boolean;
    redis: boolean;
    externalApis: boolean;
    lastHealthCheck: string;
  };
}

export interface SyncResult {
  success: boolean;
  message: string;
  jobId?: string;
  resource?: string;
  recordsProcessed?: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  errors?: string[];
  durationMs?: number;
}

// API Client class
export class IntegratedApiClient {
  private static instance: IntegratedApiClient;
  
  public static getInstance(): IntegratedApiClient {
    if (!IntegratedApiClient.instance) {
      IntegratedApiClient.instance = new IntegratedApiClient();
    }
    return IntegratedApiClient.instance;
  }

  // Authentication
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response: AxiosResponse = await api.post('/admin/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    await api.post('/admin/auth/logout');
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response: AxiosResponse = await api.get('/admin/dashboard/summary');
    return response.data;
  }

  // Module sync operations
  async triggerModuleSync(module: string): Promise<SyncResult> {
    console.log(`🔄 Triggering sync for module: ${module}`);
    
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

    // Default sync for other modules
    const response: AxiosResponse = await api.post(`/admin/sync/${module}`);
    return response.data;
  }

  // Health check
  async getHealthStatus(): Promise<any> {
    const response: AxiosResponse = await api.get('/health');
    return response.data;
  }

  // Module-specific operations
  async getModuleData(module: string): Promise<any> {
    const response: AxiosResponse = await api.get(`/admin/modules/${module}`);
    return response.data;
  }

  async updateModuleConfig(module: string, config: any): Promise<any> {
    const response: AxiosResponse = await api.put(`/admin/modules/${module}/config`, config);
    return response.data;
  }

  // User management
  async getUsers(): Promise<any[]> {
    const response: AxiosResponse = await api.get('/admin/users');
    return response.data;
  }

  async createUser(userData: any): Promise<any> {
    const response: AxiosResponse = await api.post('/admin/users', userData);
    return response.data;
  }

  async updateUser(userId: string, userData: any): Promise<any> {
    const response: AxiosResponse = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
  }

  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/admin/users/${userId}`);
  }

  // Security operations
  async getSecuritySettings(): Promise<any> {
    const response: AxiosResponse = await api.get('/admin/security/settings');
    return response.data;
  }

  async updateSecuritySettings(settings: any): Promise<any> {
    const response: AxiosResponse = await api.put('/admin/security/settings', settings);
    return response.data;
  }

  // Monitoring
  async getSystemMetrics(): Promise<any> {
    const response: AxiosResponse = await api.get('/admin/monitoring/metrics');
    return response.data;
  }

  async getAuditLogs(): Promise<any[]> {
    const response: AxiosResponse = await api.get('/admin/monitoring/audit-logs');
    return response.data;
  }
}

// Export singleton instance
export const apiClient = IntegratedApiClient.getInstance();

// Utility functions for token management
export const setAccessToken = (token: string): void => {
  localStorage.setItem('adminToken', token);
};

export const clearAccessToken = (): void => {
  localStorage.removeItem('adminToken');
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem('adminToken');
};

// Export default
export default apiClient;
