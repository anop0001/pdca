'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, Users, History } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'ホーム', href: '/', icon: Home },
  { label: 'Plan作成', href: '/plans/new', icon: PlusCircle },
  { label: 'チーム管理', href: '/team', icon: Users },
  { label: '履歴', href: '/history', icon: History },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200">
      <div className="flex justify-around items-center h-14 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-xs transition-colors ${
                isActive ? 'text-emerald-600 font-bold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
