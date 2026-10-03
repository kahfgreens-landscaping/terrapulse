// src/app/settings/SettingsPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrencyStore, CURRENCIES } from '@/store/currency.store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { updatePassword, updateEmail, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Save, User, Bell, Shield, Lock, Smartphone, Mail, Globe, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export function SettingsPage() {
  const { user } = useAuth();
  const { currency, setCurrency } = useCurrencyStore();
  const [loading, setLoading] = useState(false);
  
  // App Settings
  const [companyName, setCompanyName] = useState('TerraPulse');
  const [timezone, setTimezone] = useState('Asia/Dubai');
  
  // Account
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  
  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Notification Prefs
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  
  // Admin System Info
  const [sysInfo, setSysInfo] = useState({ users: 0, projects: 0 });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSysInfo();
    }
  }, [user]);

  const fetchSysInfo = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const projSnap = await getDocs(collection(db, 'projects'));
      setSysInfo({
        users: usersSnap.size,
        projects: projSnap.size
      });
    } catch (error) {
      console.error('Error fetching system info:', error);
    }
  };

  const handleSaveAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        phone,
      });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
      alert('Account updated successfully');
    } catch (err: any) {
      alert('Error updating account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!auth.currentUser || !currentPassword || !newPassword) return;
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      alert('Password updated successfully');
    } catch (err: any) {
      alert('Error updating password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          {/* Sidebar-like navigation could go here, for now it's a single scrolling page */}
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0 space-y-1">
              <a href="#account" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium"><User className="w-4 h-4"/> Account</a>
              <a href="#security" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium"><Lock className="w-4 h-4"/> Security</a>
              <a href="#notifications" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium"><Bell className="w-4 h-4"/> Notifications</a>
              <a href="#app" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium"><Globe className="w-4 h-4"/> App Settings</a>
              {user?.role === 'admin' && (
                <a href="#admin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium"><Shield className="w-4 h-4"/> Admin Tools</a>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
          
          <Card id="account" className="border-border">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                />
              </div>
              <Button onClick={handleSaveAccount} disabled={loading} className="w-full">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <Card id="security" className="border-border">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                />
              </div>
              <Button onClick={handleUpdatePassword} disabled={loading || !currentPassword || !newPassword} className="w-full">
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card id="app" className="border-border">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">App Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Currency</label>
                  <select 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                  >
                    {Object.values(CURRENCIES).map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.symbol}</option>
                    ))}
                  </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Timezone</label>
                <select 
                  value={timezone} 
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                >
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </div>
            </CardContent>
          </Card>
          
          <Card id="notifications" className="border-border">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Email Notifications</div>
                  <div className="text-sm text-muted-foreground">Receive updates via email.</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={emailNotifs} 
                  onChange={(e) => setEmailNotifs(e.target.checked)}
                  className="w-5 h-5 rounded border-input"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Push Notifications</div>
                  <div className="text-sm text-muted-foreground">Receive updates on your device.</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={pushNotifs} 
                  onChange={(e) => setPushNotifs(e.target.checked)}
                  className="w-5 h-5 rounded border-input"
                />
              </div>
            </CardContent>
          </Card>

          {user?.role === 'admin' && (
            <Card id="admin" className="border-border border-primary-200 bg-primary-50/10">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary-600"/>
                  Admin Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-background rounded-xl border border-border">
                    <div className="text-sm text-muted-foreground">Total Users</div>
                    <div className="text-2xl font-bold">{sysInfo.users}</div>
                  </div>
                  <div className="p-4 bg-background rounded-xl border border-border">
                    <div className="text-sm text-muted-foreground">Total Projects</div>
                    <div className="text-2xl font-bold">{sysInfo.projects}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
