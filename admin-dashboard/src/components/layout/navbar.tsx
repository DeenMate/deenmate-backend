'use client';

import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { authAPI, clearAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear token and redirect regardless of API call success
      clearAccessToken();
      localStorage.removeItem('adminToken');
      router.push('/admin/login');
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-gray-900">DeenMate Admin</h1>
            <div className="hidden md:flex space-x-1">
              <NavButton 
                href="/admin/dashboard"
                isActive={pathname === '/admin/dashboard'}
                onClick={() => router.push('/admin/dashboard')}
              >
                Dashboard
              </NavButton>
              <NavButton 
                href="/admin/modules"
                isActive={pathname === '/admin/modules'}
                onClick={() => router.push('/admin/modules')}
              >
                Modules
              </NavButton>
              <NavButton 
                href="/admin/users"
                isActive={pathname === '/admin/users'}
                onClick={() => router.push('/admin/users')}
              >
                Users
              </NavButton>
              <NavButton 
                href="/admin/monitoring"
                isActive={pathname === '/admin/monitoring'}
                onClick={() => router.push('/admin/monitoring')}
              >
                Monitoring
              </NavButton>
              <NavButton 
                href="/admin/jobs"
                isActive={pathname === '/admin/jobs'}
                onClick={() => router.push('/admin/jobs')}
              >
                Jobs
              </NavButton>
              <NavButton 
                href="/admin/security"
                isActive={pathname === '/admin/security'}
                onClick={() => router.push('/admin/security')}
              >
                Security
              </NavButton>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Admin User</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface NavButtonProps {
  href: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function NavButton({ href, isActive, onClick, children }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive 
          ? "bg-blue-100 text-blue-700 border border-blue-200" 
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  );
}
