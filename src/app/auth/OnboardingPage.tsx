import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Home, Building2, TreePine, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyStore, CURRENCIES } from '@/store/currency.store';
import { DirhamSymbol } from '@/components/ui/DirhamSymbol';
import { useAuthStore } from '@/store/auth.store';

type PropertyType = 'residential' | 'commercial' | 'hoa';

interface OnboardingData {
  name: string;
  phone: string;
  propertyAddress: string;
  propertyType: PropertyType | '';
  goals: string[];
  projectTitle: string;
  serviceType: string;
  description: string;
  budgetRange: string;
  urgency: string;
}

const goalOptions = [
  'Beautiful lawn & garden',
  'Irrigation system',
  'Outdoor living space',
  'Tree & shrub care',
  'Seasonal planting',
  'Snow removal',
  'Pool landscaping',
  'Commercial grounds',
];

const propertyTypes = [
  { id: 'residential', label: 'Residential', icon: Home, desc: 'Single family home or condo' },
  { id: 'commercial', label: 'Commercial', icon: Building2, desc: 'Office, retail, or industrial' },
  { id: 'hoa', label: 'HOA / Community', icon: TreePine, desc: 'Homeowners association or complex' },
];

const SERVICE_TYPES = [
  'New Landscape Design',
  'Lawn Maintenance',
  'Hardscaping (Patios, Walls)',
  'Irrigation System',
  'Tree & Shrub Care',
  'Outdoor Lighting',
  'Snow Removal',
];

const BUDGET_RANGES = ['Under $5,000', '$5,000 – $15,000', '$15,000 – $30,000', '$30,000+'];
const URGENCY_OPTIONS = ['Not Urgent (3+ months)', 'Within 1 Month', 'ASAP (2 weeks or less)'];

const STEPS = ['Your Info', 'Property', 'Goals', 'Your Project', 'All Set!'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { currency } = useCurrencyStore();
  // Access Zustand auth store to patch user state immediately after onboarding completes
  const { user: storeUser, setUser } = useAuthStore();
  const currConfig = CURRENCIES[currency] || CURRENCIES.AED;
  const budgetOptions = currency === 'AED'
    ? ['Under 25,000', '25,000 – 60,000', '60,000 – 150,000', '150,000+']
    : [`Under ${currConfig.symbol}5,000`, `${currConfig.symbol}5,000 – 15,000`, `${currConfig.symbol}15,000 – 30,000`, `${currConfig.symbol}30,000+`];

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>(() => ({
    name: auth.currentUser?.displayName || '',
    phone: auth.currentUser?.phoneNumber || '',
    propertyAddress: '',
    propertyType: '',
    goals: [],
    projectTitle: '',
    serviceType: '',
    description: '',
    budgetRange: '',
    urgency: '',
  }));

  useEffect(() => {
    if (auth.currentUser && !data.name) {
      setData((prev) => ({
        ...prev,
        name: auth.currentUser?.displayName || prev.name,
        phone: auth.currentUser?.phoneNumber || prev.phone,
      }));
    }
  }, []);

  const toggleGoal = (goal: string) => {
    setData((d) => ({
      ...d,
      goals: d.goals.includes(goal) ? d.goals.filter((g) => g !== goal) : [...d.goals, goal],
    }));
  };

  const handleFinish = async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) return;
    try {
      // 1. Save complete user profile to Firestore with onboardingComplete: true
      const userProfile = {
        uid: user.uid,
        email: user.email,
        name: data.name,
        phone: data.phone,
        propertyAddress: data.propertyAddress,
        propertyType: data.propertyType,
        goals: data.goals,
        role: 'client' as const,
        onboardingComplete: true,
        avatar: user.photoURL || null,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', user.uid), userProfile);

      // 2. CRITICAL — Immediately patch the Zustand store so ProtectedRoute sees
      //    onboardingComplete=true without waiting for onAuthStateChanged to re-fire.
      //    Without this, the store still has onboardingComplete=false and the
      //    ProtectedRoute redirects back to /onboarding in an infinite loop.
      if (storeUser) {
        setUser({ ...storeUser, onboardingComplete: true });
      }

      // 3. Save project request if title is provided
      let projectRequestId: string | null = null;
      if (data.projectTitle.trim()) {
        const reqRef = await addDoc(collection(db, 'projectRequests'), {
          clientId: user.uid,
          clientName: data.name,
          clientEmail: user.email,
          clientPhone: data.phone,
          propertyAddress: data.propertyAddress,
          propertyType: data.propertyType,
          projectTitle: data.projectTitle,
          serviceType: data.serviceType,
          description: data.description,
          budgetRange: data.budgetRange,
          urgency: data.urgency,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        projectRequestId = reqRef.id;

        // 4. Notify all admin users about the new project request
        //    Query for all users with role=admin and create a notification for each
        try {
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          const adminSnap = await getDocs(adminQuery);
          const notifyAdmins = adminSnap.docs.map((adminDoc) =>
            addDoc(collection(db, 'notifications'), {
              userId: adminDoc.id,
              title: '📋 New Project Request',
              body: `${data.name} submitted a new project request: "${data.projectTitle}" (${data.serviceType}, ${data.budgetRange}, ${data.urgency}). Review it in Project Requests.`,
              type: 'system',
              projectId: projectRequestId,
              read: false,
              createdAt: new Date().toISOString(),
            })
          );
          await Promise.all(notifyAdmins);
        } catch (notifyErr) {
          // Non-critical: log but don't block navigation
          console.warn('Failed to notify admins:', notifyErr);
        }
      }

      // 5. Navigate to dashboard — store is already patched, no redirect loop
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-light via-background to-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center overflow-hidden bg-primary-100 p-1 shadow-sm border border-primary-200">
            <img src="/logo.png" alt="TerraPulse" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome to TerraPulse</h1>
          <p className="text-muted-foreground mt-2">Let&apos;s set up your account in a few steps</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  i < step
                    ? 'bg-primary-600 text-white'
                    : i === step
                    ? 'bg-accent text-green-dark ring-4 ring-accent/20'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 rounded-full transition-all duration-300',
                    i < step ? 'bg-primary-600' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-card rounded-2xl border border-border shadow-card-hover p-8 min-h-72">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              {/* Step 0 — Your Info */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Tell us about yourself</h2>
                    <p className="text-sm text-muted-foreground">Your project manager will use this to contact you.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Full Name</label>
                    <Input
                      placeholder="Jane Smith"
                      autoComplete="name"
                      value={data.name}
                      onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Phone Number</label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      autoComplete="tel"
                      value={data.phone}
                      onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Step 1 — Property */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Your property</h2>
                    <p className="text-sm text-muted-foreground">Help us understand your landscape needs.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Property Address</label>
                    <Input
                      placeholder="123 Main St, City, State"
                      autoComplete="street-address"
                      value={data.propertyAddress}
                      onChange={(e) => setData((d) => ({ ...d, propertyAddress: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {propertyTypes.map((pt) => (
                      <button
                        key={pt.id}
                        onClick={() => setData((d) => ({ ...d, propertyType: pt.id as PropertyType }))}
                        className={cn(
                          'p-4 rounded-xl border-2 text-center transition-all duration-150',
                          data.propertyType === pt.id
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-border hover:border-primary-300 bg-background'
                        )}
                      >
                        <pt.icon className={cn('w-6 h-6 mx-auto mb-2', data.propertyType === pt.id ? 'text-primary-600' : 'text-muted-foreground')} />
                        <p className="text-sm font-medium">{pt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2 — Goals */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">What are your goals?</h2>
                    <p className="text-sm text-muted-foreground">Select all that apply — we'll tailor your experience.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {goalOptions.map((goal) => (
                      <button
                        key={goal}
                        onClick={() => toggleGoal(goal)}
                        className={cn(
                          'px-3 py-2 rounded-full text-sm font-medium border-2 transition-all duration-150',
                          data.goals.includes(goal)
                            ? 'border-primary-600 bg-primary-600 text-white'
                            : 'border-border hover:border-primary-300 text-foreground'
                        )}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3 — Project Request */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Tell us about your project</h2>
                    <p className="text-sm text-muted-foreground">Your project manager will review this and reach out to you.</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">Project Title *</label>
                    <Input
                      placeholder="e.g. Backyard Patio & Garden Renovation"
                      autoComplete="off"
                      value={data.projectTitle}
                      onChange={(e) => setData((d) => ({ ...d, projectTitle: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">Service Type</label>
                    <select
                      value={data.serviceType}
                      onChange={(e) => setData((d) => ({ ...d, serviceType: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select a service...</option>
                      {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                      <span>Budget Range ({currency})</span>
                      {currency === 'AED' && <DirhamSymbol className="w-3.5 h-3.5 text-primary-600 inline" />}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {budgetOptions.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setData((d) => ({ ...d, budgetRange: `${currency} ${b}` }))}
                          className={cn(
                            'px-3 py-2.5 rounded-xl text-sm border-2 text-left transition-all flex items-center gap-1.5',
                            data.budgetRange === `${currency} ${b}`
                              ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                              : 'border-border hover:border-primary-300'
                          )}
                        >
                          {currency === 'AED' && <DirhamSymbol className="w-3.5 h-3.5 shrink-0 text-current" />}
                          <span>{b}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">Urgency</label>
                    <div className="space-y-2">
                      {URGENCY_OPTIONS.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setData((d) => ({ ...d, urgency: u }))}
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl text-sm border-2 text-left transition-all',
                            data.urgency === u
                              ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                              : 'border-border hover:border-primary-300'
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">Project Scope & Notes</label>
                    <textarea
                      value={data.description}
                      onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                      rows={3}
                      placeholder="Describe what you'd like done — materials, style preferences, must-haves..."
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 4 — All Set */}
              {step === 4 && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-20 h-20 bg-green-light rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-10 h-10 text-primary-600" />
                  </div>
                  <h2 className="text-2xl font-display font-bold">You're all set!</h2>
                  <p className="text-muted-foreground">
                    Welcome, {data.name}! Your account is ready.
                    {data.projectTitle && <> Your project request "<strong>{data.projectTitle}</strong>" has been submitted and is pending admin review.</>}
                  </p>
                  <div className="bg-muted rounded-xl p-4 text-sm text-left space-y-1">
                    {data.propertyAddress && <p><span className="font-medium">Property:</span> {data.propertyAddress}</p>}
                    {data.propertyType && <p><span className="font-medium">Type:</span> <span className="capitalize">{data.propertyType}</span></p>}
                    {data.projectTitle && <p><span className="font-medium">Project:</span> {data.projectTitle}</p>}
                    {data.budgetRange && <p><span className="font-medium">Budget:</span> {data.budgetRange}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading}>
              {loading ? 'Setting up...' : 'Go to Dashboard'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
