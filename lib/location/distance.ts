'use client';

import { useState, useEffect } from 'react';

interface Location {
  latitude: number;
  longitude: number;
}

interface TrialSite {
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
}

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useUserLocation(): Location | null {
  const [location, setLocation] = useState<Location | null>(null);

  useEffect(() => {
    // Try to get location from localStorage first (if user previously granted permission)
    const storedLocation = localStorage.getItem('patientmatch_user_location');
    if (storedLocation) {
      try {
        const parsed = JSON.parse(storedLocation);
        setLocation(parsed);
        return;
      } catch {
        // Ignore malformed cache entries and request a fresh location.
      }
    }

    // Request geolocation if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocation(userLocation);
          // Store for future use
          localStorage.setItem('patientmatch_user_location', JSON.stringify(userLocation));
        },
        (error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Geolocation error:', error.message);
          }
          // Don't show error to user, just silently fail
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        }
      );
    }
  }, []);

  return location;
}

export function useTrialDistance(trialSites: TrialSite[] | null): string {
  const userLocation = useUserLocation();
  const [distance, setDistance] = useState<string>('—');

  useEffect(() => {
    if (!userLocation || !trialSites || trialSites.length === 0) {
      setDistance('—');
      return;
    }

    // Find the closest site
    let closestDistance = Infinity;
    
    for (const site of trialSites) {
      if (site.latitude && site.longitude) {
        const dist = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          site.latitude,
          site.longitude
        );
        closestDistance = Math.min(closestDistance, dist);
      }
    }

    if (closestDistance === Infinity) {
      setDistance('—');
    } else {
      // Format distance
      if (closestDistance < 1) {
        setDistance(`${Math.round(closestDistance * 10) / 10} mi`);
      } else {
        setDistance(`${Math.round(closestDistance)} mi`);
      }
    }
  }, [userLocation, trialSites]);

  return distance;
}
