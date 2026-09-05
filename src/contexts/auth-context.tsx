"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  type User 
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to get display name from user
export function getUserDisplayName(user: User | null): string {
  if (!user) return 'User'
  
  if (user.displayName) return user.displayName
  
  if (user.email) {
    // Extract name from email (e.g., "john.doe@example.com" -> "John Doe")
    const emailName = user.email.split('@')[0]
    return emailName
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }
  
  return 'User'
}

// Helper function to get user initials
export function getUserInitials(user: User | null): string {
  if (!user) return 'U'
  
  const displayName = getUserDisplayName(user)
  const parts = displayName.split(' ')
  
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  
  return displayName.substring(0, 2).toUpperCase()
}
