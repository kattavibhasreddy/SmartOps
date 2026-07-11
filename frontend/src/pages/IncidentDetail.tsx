import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store/auth';

const severityColors: Record<string, string> = {
  P1: 'bg-red-100 text-red-800',
  P2: 'bg-orange-100 text-orange-800',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-gray-100 text-gray-800'
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800'
};

const validTransitions: Record<string, string[]> = {
  'open': ['acknowledged', 'in_progress'],
  'acknowledged': ['in_progress', 'resolved'],
  'in_progress': ['resolved'],
  'resolved': ['closed', 'in_progress'],
  'closed': []
};

export const IncidentDetail = () => {
  const { id } = useParams();
  const [incident, setIncident] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const { user } = useAuthStore();

  const fetchDetail = async () => {
    try {
      const { data } = await api.get(`/incidents/${id}`);
      setIncident(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    if (['admin', 'manager'].includes(user?.role || '')) {
      try {
        const { data } = await api.get('/auth/users');
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchUsers();
  }, [id]);

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`/incidents/${id}/status`, { status });
      fetchDetail();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  const handleAssign = async (assigneeId: string) => {
    try {
      await api.patch(`/incidents/${id}/assign`, { assigneeId });
      fetchDetail();
    } catch (err: any) {
      alert('Failed to assign');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post(`/incidents/${id}/comments`, { body: newComment });
      setNewComment('');
      fetchDetail();
    } catch (err) {
      console.error(err);
    }
  };

  if (!incident) return <div className="p-8 text-center">Loading...</div>;

  const canChangeStatus = user?.role === 'admin' || user?.role === 'manager' || (user?.role === 'responder' && incident.assignee_id === user?.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{incident.title}</h2>
            <div className="flex space-x-2">
              <span className={`px-2.5 py-1 text-sm font-semibold rounded-full ${severityColors[incident.severity]}`}>
                {incident.severity}
              </span>
              <span className={`px-2.5 py-1 text-sm font-semibold rounded-full capitalize ${statusColors[incident.status]}`}>
                {incident.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{incident.description || 'No description provided.'}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Discussion</h3>
          <div className="space-y-4 mb-6">
            {incident.comments?.map((c: any) => (
              <div key={c.id} className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">User {c.author_id.substring(0,8)} • {new Date(c.created_at).toLocaleString()}</p>
                <p className="text-gray-800">{c.body}</p>
              </div>
            ))}
            {incident.comments?.length === 0 && <p className="text-sm text-gray-500 italic">No comments yet.</p>}
          </div>
          
          <form onSubmit={handleAddComment}>
            <textarea 
              className="w-full border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500" 
              rows={3} 
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
            ></textarea>
            <div className="mt-2 flex justify-end">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm">Post Comment</button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Management</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Assignee</p>
              {['admin', 'manager'].includes(user?.role || '') ? (
                <select 
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                  value={incident.assignee_id || ''}
                  onChange={e => handleAssign(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              ) : (
                <p className="font-medium">{incident.assignee_id ? `User ${incident.assignee_id.substring(0,8)}` : 'Unassigned'}</p>
              )}
            </div>

            {canChangeStatus && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 mb-2">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {validTransitions[incident.status]?.map(nextStatus => (
                    <button 
                      key={nextStatus}
                      onClick={() => handleStatusChange(nextStatus)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md capitalize"
                    >
                      Move to {nextStatus.replace('_', ' ')}
                    </button>
                  ))}
                  {validTransitions[incident.status]?.length === 0 && (
                    <p className="text-sm text-gray-500">No further transitions allowed.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Audit History</h3>
           <div className="relative border-l border-gray-200 ml-3 space-y-4">
             {incident.history?.map((h: any) => (
               <div key={h.id} className="pl-4 relative">
                 <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-[4.5px] top-1.5 ring-4 ring-white"></div>
                 <p className="text-xs text-gray-500 mb-0.5">{new Date(h.created_at).toLocaleString()}</p>
                 <p className="text-sm font-medium text-gray-900 capitalize">{h.action.replace('_', ' ')}</p>
                 <p className="text-xs text-gray-600 mt-1">{JSON.stringify(h.details)}</p>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};
