'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createProfileToken, ProfileCookie, readProfileCookie } from '@/shared/profileCookie';
import { NextRequest } from 'next/server';

export async function updateProfileField(key: keyof ProfileCookie, value: any) {
  const cookieStore = await cookies();
  const existingFn = cookieStore.get('pm_profile');
  
  let currentProfile: ProfileCookie = {};
  if (existingFn?.value) {
    const decrypted = await import('@/shared/profileCookie').then(m => m.decryptProfileToken(existingFn.value));
    if (decrypted) {
      currentProfile = decrypted;
    }
  }

  // Update field
  const newProfile = { ...currentProfile, [key]: value };
  
  // Encrypt
  const { token, expires } = await createProfileToken(newProfile);
  
  // Set cookie
  cookieStore.set('pm_profile', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // maxAge needs seconds, but createProfileToken assumes ttlDays=7 default.
    // expires is epoch seconds. maxAge is duration in seconds.
    // Let's assume 7 days (604800) matches default.
    maxAge: 604800, 
    // Or we can use expires option if supported? cookies().set supports 'expires' (Date).
    expires: new Date(expires * 1000),
  });


  revalidatePath('/trials');
}

export async function updateProfileBatch(updates: Partial<ProfileCookie>) {
  const cookieStore = await cookies();
  const existingFn = cookieStore.get('pm_profile');
  
  let currentProfile: ProfileCookie = {};
  if (existingFn?.value) {
    const decrypted = await import('@/shared/profileCookie').then(m => m.decryptProfileToken(existingFn.value));
    if (decrypted) {
      currentProfile = decrypted;
    }
  }

  // Merge updates
  const newProfile = { ...currentProfile, ...updates };
  
  // Encrypt
  const { token, expires } = await createProfileToken(newProfile);
  
  // Set cookie
  cookieStore.set('pm_profile', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 604800,
    expires: new Date(expires * 1000),
  });

  revalidatePath('/trials');
}

export async function clearProfileConditions() {
  const cookieStore = await cookies();
  const existingFn = cookieStore.get('pm_profile');
  
  if (existingFn?.value) {
    const decrypted = await import('@/shared/profileCookie').then(m => m.decryptProfileToken(existingFn.value));
    if (decrypted) {
      const newProfile = { ...decrypted, conditions: [] };
      const { token, expires } = await (await import('@/shared/profileCookie')).createProfileToken(newProfile);
      cookieStore.set('pm_profile', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 604800,
        expires: new Date(expires * 1000),
      });
    }
  }
  revalidatePath('/trials');
}

export async function getConditionSuggestionsAction(query: string) {
  const { getConditionSuggestions } = await import('@/lib/conditions');
  return getConditionSuggestions(query);
}

export async function clearSearchProfile() {
  const cookieStore = await cookies();
  const existingFn = cookieStore.get('pm_profile');
  
  if (existingFn?.value) {
    const decrypted = await import('@/shared/profileCookie').then(m => m.decryptProfileToken(existingFn.value));
    if (decrypted) {
      // Clear search-related fields, keep demographic data (age, sex)
      const newProfile = { 
        ...decrypted, 
        conditions: [],
        zip: undefined,
        radius: undefined,
      };
      const { token, expires } = await createProfileToken(newProfile);
      cookieStore.set('pm_profile', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 604800,
        expires: new Date(expires * 1000),
      });
    }
  }
  revalidatePath('/trials');
}
