// src/components/projects/ChangePMModal.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User, Project } from '@/types';

interface ChangePMModalProps {
  project: Project;
  onClose: () => void;
}

export function ChangePMModal({ project, onClose }: ChangePMModalProps) {
  const [pms, setPms] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPMs();
  }, []);

  const fetchPMs = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'pm'));
      const snap = await getDocs(q);
      const list: User[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as User));
      setPms(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPM = async (pm: User) => {
    setSaving(true);
    try {
      const oldPmId = project.pmId;
      await updateDoc(doc(db, 'projects', project.id), {
        pmId: pm.uid,
        pmName: pm.name,
        pmEmail: pm.email,
        pmPhone: pm.phone || '',
      });

      if (pm.uid !== oldPmId) {
        await addDoc(collection(db, 'notifications'), {
          userId: pm.uid,
          title: 'Project Assigned',
          body: `You have been assigned to project ${project.title}`,
          type: 'project_assigned',
          projectId: project.id,
          read: false,
          createdAt: new Date().toISOString()
        });

        if (project.clientId) {
          await addDoc(collection(db, 'notifications'), {
            userId: project.clientId,
            title: 'Project Manager Changed',
            body: `Your project manager has been changed to ${pm.name}`,
            type: 'system',
            projectId: project.id,
            read: false,
            createdAt: new Date().toISOString()
          });
        }

        if (oldPmId) {
          await addDoc(collection(db, 'notifications'), {
            userId: oldPmId,
            title: 'Unassigned from Project',
            body: `You have been unassigned from project ${project.title}`,
            type: 'system',
            projectId: project.id,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
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
      <div className="bg-background w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-bold">Change Project Manager</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            pms.map(pm => (
              <button
                key={pm.uid}
                onClick={() => handleSelectPM(pm)}
                disabled={saving}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted text-left"
              >
                <div>
                  <div className="font-medium text-sm">{pm.name}</div>
                  <div className="text-xs text-muted-foreground">{pm.email}</div>
                </div>
                {pm.uid === project.pmId && <Check className="w-4 h-4 text-primary-600" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
