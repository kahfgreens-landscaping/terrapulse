// src/hooks/useFirestore.ts
import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Real-time single document listener */
export function useDocument<T = DocumentData>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) return;
    const ref = doc(db, path);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...snap.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [path]);

  return { data, loading, error };
}

/** Real-time collection listener with optional query constraints */
export function useCollection<T = DocumentData>(
  collectionPath: string,
  ...queryConstraints: QueryConstraint[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!collectionPath) return;
    const ref = collection(db, collectionPath);
    const q = query(ref, ...queryConstraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath]);

  return { data, loading, error };
}
