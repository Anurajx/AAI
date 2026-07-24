"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAirportAccess = exports.getAirportScope = void 0;
/**
 * Returns a filter object to scope database queries to the user's assigned airport,
 * unless they are a SUPER_ADMIN or AUDITOR (who have global access).
 */
const getAirportScope = (user) => {
    if (!user)
        return { airportId: 'NONE' };
    if (user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
        return {}; // No limit, can see all airports
    }
    if (!user.airportId) {
        return { airportId: 'NONE' }; // Default fallback to match nothing
    }
    return { airportId: user.airportId };
};
exports.getAirportScope = getAirportScope;
/**
 * Checks if the user is authorized to access a resource belonging to a specific airport.
 */
const checkAirportAccess = (user, airportId) => {
    if (!user)
        return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
        return true;
    }
    return user.airportId === airportId;
};
exports.checkAirportAccess = checkAirportAccess;
