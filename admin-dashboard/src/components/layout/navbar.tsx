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
      router.push('/login');
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
                href="/dashboard"
                isActive={pathname === '/dashboard'}
                onClick={() => router.push('/dashboard')}
              >
                Dashboard
              </NavButton>
              <NavButton 
                href="/modules"
                isActive={pathname === '/modules'}
                onClick={() => router.push('/modules')}
              >
                Modules
              </NavButton>
              <NavButton 
                href="/users"
                isActive={pathname === '/users'}
                onClick={() => router.push('/users')}
              >
                Users
              </NavButton>
              <NavButton 
                href="/monitoring"
                isActive={pathname === '/monitoring'}
                onClick={() => router.push('/monitoring')}
              >
                Monitoring
              </NavButton>
              <NavButton 
                href="/security"
                isActive={pathname === '/security'}
                onClick={() => router.push('/security')}
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
