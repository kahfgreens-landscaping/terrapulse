import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function seedAdminAccount() {
  if (localStorage.getItem('adminSeeded_tp') === 'true') {
    return;
  }

  try {
    const adminEmail = 'admin@terrapulse.app';
    const adminPassword = '@TerraPulse*';

    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        email: adminEmail,
        name: 'TerraPulse Admin',
        role: 'admin',
        onboardingComplete: true,
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.code !== 'auth/email-already-in-use') {
        console.error('Error seeding admin account:', error);
      }
    }

    localStorage.setItem('adminSeeded_tp', 'true');
    console.log('Admin account ready.');
  } catch (error) {
    console.error('Error in seedAdminAccount:', error);
  }
}
