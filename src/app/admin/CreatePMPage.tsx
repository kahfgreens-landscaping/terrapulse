import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { UserPlus } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CreatePMPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        phone,
        role: 'pm',
        specialty,
        onboardingComplete: true,
        createdAt: new Date().toISOString()
      });

      setSuccess(true);
      // Reset form (except keep showing success)
      setName(''); setEmail(''); setPhone(''); setPassword(''); setSpecialty('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create PM account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Create Project Manager</h1>
          <p className="text-muted-foreground mt-1">Add a new team member to manage projects.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PM Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-semibold mb-1">PM Account created successfully!</p>
                <p>The PM can now log in with the credentials provided.</p>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pm@terrapulse.app" />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Temporary Password</label>
                <Input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Specialty</label>
              <select
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              >
                <option value="">Select Specialty</option>
                <option value="General Landscaping">General Landscaping</option>
                <option value="Hardscaping">Hardscaping</option>
                <option value="Planting & Irrigation">Planting & Irrigation</option>
                <option value="Design">Design</option>
              </select>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? 'Creating...' : 'Create PM Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
