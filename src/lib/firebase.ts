import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase (avoid duplicate initialization during hot reloads)
function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be initialized on the client side')
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
}

function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

// Export auth instance
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : ({} as Auth)

// Export auth providers
export const googleProvider = typeof window !== 'undefined' ? new GoogleAuthProvider() : ({} as GoogleAuthProvider)
