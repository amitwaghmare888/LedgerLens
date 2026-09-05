"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { getUserInitials } from "@/contexts/auth-context";

interface UserAvatarProps {
  user: User | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-[13px]",
  md: "w-10 h-10 text-[14px]",
  lg: "w-12 h-12 text-[16px]",
};

/**
 * Robust user avatar component with automatic fallback to initials
 * Handles broken images gracefully without showing broken image icon
 */
export function UserAvatar({ user, size = "sm", className = "" }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = getUserInitials(user);
  
  // Always use initials if no photoURL or if image failed to load
  const shouldShowInitials = !user?.photoURL || imageError;

  if (shouldShowInitials) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-on-primary)] font-semibold select-none`}
      >
        {initials}
      </div>
    );
  }

  // Using img instead of next/image for immediate error fallback without layout shift
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.photoURL}
      alt=""
      className={`${sizeClasses[size]} ${className} rounded-full object-cover`}
      onError={() => setImageError(true)}
      loading="lazy"
    />
  );
}
