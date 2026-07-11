import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';

export const NotificationBell = () => {
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setCount(data.count);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications?pageSize=10');
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    if (!isOpen) fetchNotifications();
    setIsOpen(!isOpen);
  };

  const handleRead = async (notification: any) => {
    if (!notification.read) {
      await api.patch(`/notifications/${notification.id}/read`);
      setCount(prev => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    if (notification.incident_id) {
      navigate(`/incidents/${notification.incident_id}`);
    }
  };

  const handleReadAll = async () => {
    await api.patch('/notifications/read-all');
    setCount(0);
    fetchNotifications();
  };

  return (
    <div className="relative">
      <button 
        onClick={handleToggle}
        className="p-2 text-gray-500 hover:text-gray-700 relative"
      >
        <Bell className="w-6 h-6" />
        {count > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
          <div className="px-4 py-2 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {count > 0 && (
              <button onClick={handleReadAll} className="text-xs text-blue-600 hover:text-blue-800">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No notifications</div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => handleRead(n)}
                  className={`px-4 py-3 text-sm border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                >
                  <p className={`text-gray-900 ${!n.read ? 'font-semibold' : ''}`}>{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
