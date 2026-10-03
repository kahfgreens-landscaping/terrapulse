import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// ─────────────────────────────────────────────────────────────
// Admin seed — runs once on app load to ensure the admin account
// exists with the correct credentials.
//
// Credentials:
//   Email:    admin@terrapulse.app
//   Password: @KahfGreens25*
//
// If the account already exists with an old password, we sign in
// with the old password and update it to the new one.
// The localStorage flag 'adminSeeded_tp2' gates the whole block
// so it only runs once per browser session after a credential change.
// ─────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'admin@terrapulse.app';
const ADMIN_PASSWORD = '@KahfGreens25*';
// Previous password — used to migrate existing accounts
const OLD_PASSWORD   = '@TerraPulse*';
// Version key — bump this string any time credentials change
const SEED_KEY       = 'adminSeeded_tp2';

export async function seedAdminAccount() {
  // Already done in this browser — skip
  if (localStorage.getItem(SEED_KEY) === 'true') return;

  try {
    // ── Step 1: Try to CREATE the admin account fresh ──────────
    try {
      const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      // Write Firestore user doc for the brand-new account
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: ADMIN_EMAIL,
        name: 'KahfGreens Admin',
        role: 'admin',
        onboardingComplete: true,
        createdAt: new Date().toISOString(),
      });
      console.log('[TerraPulse] Admin account created.');
    } catch (createErr: any) {
      // ── Step 2: Account already exists — update its password ─
      if (createErr.code === 'auth/email-already-in-use') {
        try {
          // Sign in with the NEW password first — maybe it's already updated
          await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
          console.log('[TerraPulse] Admin account already up to date.');
        } catch {
          // New password didn't work — try the OLD password and migrate
          try {
            const oldCred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, OLD_PASSWORD);
            await updatePassword(oldCred.user, ADMIN_PASSWORD);
            // Also make sure the Firestore name is updated
            await setDoc(
              doc(db, 'users', oldCred.user.uid),
              { name: 'KahfGreens Admin' },
              { merge: true }
            );
            console.log('[TerraPulse] Admin password updated to new credentials.');
          } catch (migErr) {
            // Could not update — log for manual fix via Firebase Console
            console.warn('[TerraPulse] Could not auto-update admin password:', migErr);
          }
        }
      } else {
        console.error('[TerraPulse] Unexpected error creating admin:', createErr);
      }
    }

    // Mark as done so this block doesn't run again
    localStorage.setItem(SEED_KEY, 'true');
  } catch (err) {
    console.error('[TerraPulse] seedAdminAccount failed:', err);
  }
}

