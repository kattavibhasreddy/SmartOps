import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuthStore } from '../store/auth';
import { ShieldAlert } from 'lucide-react';

export const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const { user } = useAuthStore();
  const [showNew, setShowNew] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await api.patch(`/auth/users/${id}/role`, { role });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update role');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/users', { name: newName, email: newEmail, password: newPassword, role: newRole });
      setShowNew(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-500">You must be an administrator to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <button 
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Add User
        </button>
      </div>

      {showNew && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Create New User</h3>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input required value={newName} onChange={e=>setNewName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" required value={newEmail} onChange={e=>setNewEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" required minLength={6} value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="mt-1 block border border-gray-300 rounded-md shadow-sm p-2 w-full">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="responder">Responder</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={()=>setShowNew(false)} className="px-4 py-2 border rounded-md">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Create</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase mr-3">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{u.name}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select 
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === user.id}
                    className="border-gray-300 rounded-md shadow-sm p-1 text-sm border focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="responder">Responder</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
