import { createContext, useContext } from 'react';
import { Restaurant } from '../types';

interface TenantContextType {
  restaurant: Restaurant | null;
  hasModule: (module: string) => boolean;
}

export const TenantContext = createContext<TenantContextType>({
  restaurant: null,
  hasModule: () => true, // Legacy routes: all modules visible
});

export function useTenant() {
  return useContext(TenantContext);
}
