'use client';

import { Navbar } from './navbar';
import { AdminBreadcrumb } from './breadcrumb';

interface PageLayoutProps {
  children: React.ReactNode;
  showBreadcrumb?: boolean;
}

export function PageLayout({ children, showBreadcrumb = true }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {showBreadcrumb && <AdminBreadcrumb />}
        {children}
      </div>
    </div>
  );
}
