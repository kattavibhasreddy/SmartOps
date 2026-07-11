import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export const Dashboard = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const { user } = useAuthStore();
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSev, setNewSev] = useState('P3');

  const fetchIncidents = async () => {
    try {
      const { data } = await api.get('/incidents');
      setIncidents(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    if (['admin', 'manager'].includes(user?.role || '')) {
      try {
        const { data } = await api.get('/incidents/stats');
        setStats(data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchStats();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/incidents', { title: newTitle, description: newDesc, severity: newSev });
      setShowNew(false);
      setNewTitle('');
      setNewDesc('');
      setNewSev('P3');
      fetchIncidents();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Incident Dashboard</h2>
        {user?.role !== 'viewer' && (
          <button 
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            New Incident
          </button>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Avg Resolution Time</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{parseFloat(stats.avgResolutionHours).toFixed(1)} <span className="text-xl text-gray-500">hrs</span></p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">By Status</h3>
             <div className="flex flex-wrap gap-2">
                {stats.byStatus?.map((s: any) => (
                   <span key={s.status} className="px-2 py-1 bg-gray-100 rounded text-sm">{s.status}: <span className="font-bold">{s.count}</span></span>
                ))}
             </div>
          </div>
        </div>
      )}

      {showNew && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Create New Incident</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input required value={newTitle} onChange={e=>setNewTitle(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows={3}></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Severity</label>
              <select value={newSev} onChange={e=>setNewSev(e.target.value)} className="mt-1 block border border-gray-300 rounded-md shadow-sm p-2">
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
                <option value="P4">P4 - Low</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 relative"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {incidents.map((inc) => (
              <tr key={inc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inc.title}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityColors[inc.severity]}`}>
                    {inc.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${statusColors[inc.status]}`}>
                    {inc.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(inc.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link to={`/incidents/${inc.id}`} className="text-blue-600 hover:text-blue-900">View</Link>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                  No incidents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
