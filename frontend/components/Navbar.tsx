'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Calculator', href: '/' },
    { name: 'Analytics', href: '/analytics' },
    { name: 'Price List', href: '/list' },
    { name: 'Configuration', href: '/config' },
  ];

  return (
    <nav className="bg-gray-800 border-b border-gray-700 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
               <span className="text-xl font-bold text-white">Pottery Pricing</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu (simplified) */}
      <div className="md:hidden flex justify-around p-2 bg-gray-900">
           {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium ${
                    isActive ? 'text-white font-bold' : 'text-gray-400'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
      </div>
    </nav>
  );
}
