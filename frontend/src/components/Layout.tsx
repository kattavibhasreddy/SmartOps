import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { NotificationBell } from './NotificationBell';
import { LayoutDashboard, Trello, Users, LogOut } from 'lucide-react';
import { api } from '../api';

export const Layout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch(err) {
      console.error(err);
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">SmartOps</h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          <Link to="/" className="flex items-center px-2 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100">
            <LayoutDashboard className="mr-3 h-5 w-5 text-gray-500" />
            Dashboard
          </Link>
          <Link to="/board" className="flex items-center px-2 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100">
            <Trello className="mr-3 h-5 w-5 text-gray-500" />
            Kanban Board
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin/users" className="flex items-center px-2 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100">
              <Users className="mr-3 h-5 w-5 text-gray-500" />
              Users
            </Link>
          )}
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase mr-3">
              {user?.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <LogOut className="mr-2 w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6 shadow-sm z-10">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto bg-gray-50 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
