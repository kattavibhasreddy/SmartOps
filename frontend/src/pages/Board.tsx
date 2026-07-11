import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api';
import { useAuthStore } from '../store/auth';
import { Link } from 'react-router-dom';

const statuses = ['open', 'acknowledged', 'in_progress', 'resolved', 'closed'];

const validTransitions: Record<string, string[]> = {
  'open': ['acknowledged', 'in_progress'],
  'acknowledged': ['in_progress', 'resolved'],
  'in_progress': ['resolved'],
  'resolved': ['closed', 'in_progress'],
  'closed': []
};

const severityColors: Record<string, string> = {
  P1: 'bg-red-100 text-red-800',
  P2: 'bg-orange-100 text-orange-800',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-gray-100 text-gray-800'
};

export const Board = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const { user } = useAuthStore();

  const fetchIncidents = async () => {
    try {
      const { data } = await api.get('/incidents');
      setIncidents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const sourceStatus = source.droppableId;
    const targetStatus = destination.droppableId;

    if (!validTransitions[sourceStatus]?.includes(targetStatus)) {
      alert(`Invalid transition from ${sourceStatus} to ${targetStatus}`);
      return;
    }

    const incident = incidents.find(i => i.id === draggableId);
    const canChange = user?.role === 'admin' || user?.role === 'manager' || (user?.role === 'responder' && incident?.assignee_id === user?.id);

    if (!canChange) {
      alert('You do not have permission to change this incident status');
      return;
    }

    // Optimistic update
    const newIncidents = Array.from(incidents);
    const index = newIncidents.findIndex(i => i.id === draggableId);
    newIncidents[index].status = targetStatus;
    setIncidents(newIncidents);

    try {
      await api.patch(`/incidents/${draggableId}/status`, { status: targetStatus });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
      fetchIncidents(); // Revert on failure
    }
  };

  const columns = statuses.reduce((acc, status) => {
    acc[status] = incidents.filter(i => i.status === status);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Incident Board</h2>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {statuses.map(status => (
            <div key={status} className="flex-shrink-0 w-80 flex flex-col bg-gray-100 rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 capitalize mb-4 flex items-center justify-between">
                {status.replace('_', ' ')}
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{columns[status].length}</span>
              </h3>
              
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-[200px] transition-colors rounded-lg ${snapshot.isDraggingOver ? 'bg-gray-200/50' : ''}`}
                  >
                    {columns[status].map((incident, index) => (
                      <Draggable key={incident.id} draggableId={incident.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`mb-3 p-4 bg-white rounded-lg shadow-sm border ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/20' : 'border-gray-200'} hover:border-blue-300 transition-colors`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${severityColors[incident.severity]}`}>
                                {incident.severity}
                              </span>
                              <Link to={`/incidents/${incident.id}`} className="text-xs text-blue-600 hover:underline">
                                View
                              </Link>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{incident.title}</p>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                              <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                              {incident.assignee_id && (
                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase" title={`Assignee ID: ${incident.assignee_id}`}>
                                  {incident.assignee_id.substring(0,1)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};
