// src/components/projects/ManagePhasesModal.tsx
import { useState } from 'react';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project, ProjectPhase } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ManagePhasesModalProps {
  project: Project;
  onClose: () => void;
}

export function ManagePhasesModal({ project, onClose }: ManagePhasesModalProps) {
  const [phases, setPhases] = useState<ProjectPhase[]>(
    project.phases.sort((a, b) => (a.order || 0) - (b.order || 0))
  );
  const [saving, setSaving] = useState(false);

  const handleAddPhase = () => {
    const order = phases.length > 0 ? Math.max(...phases.map(p => p.order || 0)) + 1 : 1;
    setPhases([...phases, { id: uuidv4(), name: '', description: '', status: 'pending', estimatedDays: 7, order }]);
  };

  const handleUpdate = (id: string, field: keyof ProjectPhase, value: any) => {
    setPhases(phases.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleDelete = (id: string) => {
    setPhases(phases.filter(p => p.id !== id));
  };

  const movePhase = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === phases.length - 1) return;

    const newPhases = [...phases];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newPhases[index];
    newPhases[index] = newPhases[swapIndex];
    newPhases[swapIndex] = temp;

    // Update order numbers
    newPhases.forEach((p, i) => p.order = i + 1);
    setPhases(newPhases);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        phases
      });

      if (project.pmId) {
        await addDoc(collection(db, 'notifications'), {
          userId: project.pmId,
          title: 'Phases Updated',
          body: `Project phases have been updated for ${project.title}`,
          type: 'milestone',
          projectId: project.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
      
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-xl font-bold">Manage Project Phases</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1">
          {phases.map((phase, index) => (
            <div key={phase.id} className="p-4 border border-border rounded-xl bg-muted/20 flex gap-4 items-start">
              <div className="flex flex-col gap-1 mt-1">
                <button onClick={() => movePhase(index, 'up')} disabled={index === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ArrowUp className="w-4 h-4"/></button>
                <button onClick={() => movePhase(index, 'down')} disabled={index === phases.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ArrowDown className="w-4 h-4"/></button>
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Phase Name</label>
                    <input type="text" value={phase.name} onChange={e => handleUpdate(phase.id, 'name', e.target.value)} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm" />
                  </div>
                  <div className="w-24">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Est. Days</label>
                    <input type="number" value={phase.estimatedDays || 0} onChange={e => handleUpdate(phase.id, 'estimatedDays', Number(e.target.value))} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Description (Optional)</label>
                  <input type="text" value={phase.description || ''} onChange={e => handleUpdate(phase.id, 'description', e.target.value)} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
              </div>

              <button onClick={() => handleDelete(phase.id)} className="p-2 text-red-500 hover:bg-red-50 rounded mt-5">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          <Button variant="outline" onClick={handleAddPhase} className="w-full border-dashed">
            <Plus className="w-4 h-4 mr-2"/> Add Phase
          </Button>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary-600 text-white hover:bg-primary-700">Save Phases</Button>
        </div>
      </div>
    </div>
  );
}
