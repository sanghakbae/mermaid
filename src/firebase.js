import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  GoogleAuthProvider,
  getAuth,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Firebase 설정이 모두 채워졌을 때만 기능을 활성화합니다.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let auth = null;
let db = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Analytics는 지원되는 브라우저 환경에서만 활성화합니다.
  if (firebaseConfig.measurementId) {
    isAnalyticsSupported()
      .then((supported) => {
        if (supported) {
          getAnalytics(app);
        }
      })
      .catch(() => {});
  }
}

const provider = new GoogleAuthProvider();
const DIAGRAMS = 'diagrams';

export function watchAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

// 로그인 상태가 없으면 익명 사용자로 자동 로그인합니다(자동 저장용 신원 확보).
export function ensureSignedIn() {
  if (!auth) {
    return Promise.resolve(null);
  }

  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return signInAnonymously(auth).then((result) => result.user);
}

// 익명 사용자는 같은 uid로 Google 계정에 연결(link)해 저장 데이터를 보존합니다.
export async function loginWithGoogle() {
  if (!auth) {
    throw new Error('firebase-not-configured');
  }

  const current = auth.currentUser;

  if (current && current.isAnonymous) {
    try {
      const result = await linkWithPopup(current, provider);
      return result.user;
    } catch (error) {
      // 이미 다른 곳에서 쓰인 Google 계정이면 연결 대신 해당 계정으로 로그인합니다.
      if (error?.code === 'auth/credential-already-in-use') {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      }
      throw error;
    }
  }

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export function logout() {
  if (!auth) {
    return Promise.resolve();
  }

  return signOut(auth);
}

// 사용자의 다이어그램 목록을 실시간으로 구독합니다.
export function watchDiagrams(uid, callback, onError) {
  if (!db || !uid) {
    callback([]);
    return () => {};
  }

  // 복합 인덱스가 필요 없도록 uid로만 필터링하고 정렬은 클라이언트에서 처리합니다.
  const diagramsQuery = query(collection(db, DIAGRAMS), where('uid', '==', uid));

  return onSnapshot(
    diagramsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
      callback(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );
}

export function saveDiagram(uid, title, code) {
  if (!db || !uid) {
    return Promise.reject(new Error('firebase-not-configured'));
  }

  return addDoc(collection(db, DIAGRAMS), {
    uid,
    title: title || '제목 없음',
    code,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateDiagram(id, title, code) {
  if (!db) {
    return Promise.reject(new Error('firebase-not-configured'));
  }

  return updateDoc(doc(db, DIAGRAMS, id), {
    title: title || '제목 없음',
    code,
    updatedAt: serverTimestamp(),
  });
}

export function deleteDiagram(id) {
  if (!db) {
    return Promise.reject(new Error('firebase-not-configured'));
  }

  return deleteDoc(doc(db, DIAGRAMS, id));
}
