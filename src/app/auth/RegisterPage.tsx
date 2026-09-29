import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Leaf } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        phone,
        role: 'client',
        onboardingComplete: false,
        createdAt: new Date().toISOString()
      });

      navigate('/onboarding');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-primary-100 p-0.5">
                <img src="/logo.png" alt="TerraPulse" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-semibold tracking-tight">TerraPulse</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
            <p className="text-muted-foreground">Sign up to get started with your landscaping project.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email address</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="text-center text-sm">
            <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:block bg-muted relative overflow-hidden">
        <img
          src="/assets/hero.png"
          alt="Landscaping"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>
    </div>
  );
}
