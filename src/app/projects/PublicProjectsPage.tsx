import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Globe, Leaf } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Project } from '@/types';
import { Card } from '@/components/ui/card';

export function PublicProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublic = async () => {
      try {
        const q = query(collection(db, 'projects'), where('status', 'in', ['in_progress', 'completed']));
        const snapshot = await getDocs(q);
        const projs: Project[] = [];
        snapshot.forEach(doc => {
          projs.push({ id: doc.id, ...doc.data() } as Project);
        });
        setProjects(projs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublic();
  }, []);

  if (loading) return <div className="p-8">Loading showcase...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Community Showcase</h1>
          <p className="text-muted-foreground mt-1">Explore some of our active and completed landscaping projects.</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No projects to showcase yet</h3>
          <p className="text-muted-foreground">Check back soon for inspiring transformations.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow group">
              <div className="h-48 bg-muted relative overflow-hidden">
                {p.coverPhoto ? (
                  <img src={p.coverPhoto} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary-50">
                    <Leaf className="w-12 h-12 text-primary-200" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {p.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold mb-1 truncate">{p.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {p.address ? p.address.split(',')[0] : 'Local Area'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
