// ...existing code...

interface LayoutProps {
  activeTab: 'list' | 'inventory' | 'chat' | 'store' | 'reports' | 'participants' | 'settings';
  onTabChange: (tab: 'list' | 'inventory' | 'chat' | 'store' | 'reports' | 'participants' | 'settings') => void;
  backgroundSkin: string;
  children: React.ReactNode;
}

export function Layout({
  activeTab,
  onTabChange,
  backgroundSkin,
  children,
}: LayoutProps) {
  return (
    <div className={`app-shell min-h-screen pb-4 lg:pb-0 ${backgroundSkin}`}>
      <header className="app-header sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">SmartHome Groceries</h1>
        </div>
      </header>
      <main className="app-main mx-auto max-w-7xl p-4 lg:p-5">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around bg-white border-t border-slate-200 p-2 shadow-lg lg:hidden">
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('list')}
        >
          <span>List</span>
        </button>
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'inventory' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('inventory')}
        >
          <span>Inventory</span>
        </button>
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'chat' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('chat')}
        >
          <span>Chat</span>
        </button>
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'store' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('store')}
        >
          <span>Store</span>
        </button>
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'reports' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('reports')}
        >
          <span>Reports</span>
        </button>
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'participants' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('participants')}
        >
          <span>Participants</span>
        </button>
        <button
          className={`flex flex-col items-center px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          onClick={() => onTabChange('settings')}
        >
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
