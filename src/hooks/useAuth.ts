import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as User;
            let name = data.name || 'User';
            if (name.includes('GreenTrack')) {
              name = name.replace(/GreenTrack/g, 'TerraPulse');
              updateDoc(userDocRef, { name }).catch(() => {});
            }
            setUser({ ...data, uid: firebaseUser.uid, name });
          } else {
            // Authenticated in Firebase (e.g. Google sign-in), awaiting onboarding
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'New User',
              avatar: firebaseUser.photoURL || undefined,
              role: 'client',
              onboardingComplete: false,
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'New User',
            avatar: firebaseUser.photoURL || undefined,
            role: 'client',
            onboardingComplete: false,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);
}

export function useAuth() {
  return useAuthStore();
}
