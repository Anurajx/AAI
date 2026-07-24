import { TokenPayload } from './jwt';

/**
 * Returns a filter object to scope database queries to the user's assigned airport,
 * unless they are a SUPER_ADMIN or AUDITOR (who have global access).
 */
export const getAirportScope = (user: TokenPayload | undefined): { airportId?: string } => {
  if (!user) return { airportId: 'NONE' };
  
  if (user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
    return {}; // No limit, can see all airports
  }
  
  if (!user.airportId) {
    return { airportId: 'NONE' }; // Default fallback to match nothing
  }
  
  return { airportId: user.airportId };
};

/**
 * Checks if the user is authorized to access a resource belonging to a specific airport.
 */
export const checkAirportAccess = (user: TokenPayload | undefined, airportId: string | null): boolean => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
    return true;
  }
  return user.airportId === airportId;
};
