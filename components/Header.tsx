'use client';

import { Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export function Header() {
    return (
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <form className="relative flex flex-1" action="#" method="GET">
                    <label htmlFor="search-field" className="sr-only">
                        Ara
                    </label>
                    <div className="flex w-full md:w-1/2 lg:w-1/3 items-center">
                        <div className="relative w-full">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            </div>
                            <input
                                id="search-field"
                                className="block h-9 w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all"
                                placeholder="Ürünlerde ara..."
                                type="search"
                                name="search"
                            />
                        </div>
                    </div>
                </form>
                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    <NotificationBell />
                </div>
            </div>
        </header>
    );
}
