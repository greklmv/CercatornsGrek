import { describe, it, expect } from 'vitest';
import { getFgcMinutes, formatFgcTime, resolveStationId } from '../utils/incidenciaUtils';

describe('incidenciaUtils', () => {
    describe('getFgcMinutes', () => {
        it('should convert standard time correctly', () => {
            expect(getFgcMinutes('06:00')).toBe(6 * 60);
            expect(getFgcMinutes('14:30')).toBe(14 * 60 + 30);
        });

        it('should handle times after midnight (next day)', () => {
            // Inputs 00:00 to 03:59 are treated as next day
            expect(getFgcMinutes('00:00')).toBe(24 * 60);
            expect(getFgcMinutes('01:30')).toBe(25 * 60 + 30);
            expect(getFgcMinutes('03:59')).toBe(27 * 60 + 59);
        });

        it('should handle times from 04:00 as same day', () => {
            expect(getFgcMinutes('04:00')).toBe(4 * 60);
        });

        it('should return null for invalid inputs', () => {
            expect(getFgcMinutes('')).toBeNull();
            expect(getFgcMinutes(undefined)).toBeNull();
            expect(getFgcMinutes('invalid')).toBeNull();
        });
    });

    describe('formatFgcTime', () => {
        it('should format standard minutes correctly', () => {
            expect(formatFgcTime(6 * 60)).toBe('06:00');
            expect(formatFgcTime(14 * 60 + 30)).toBe('14:30');
        });

        it('should format minutes > 24h correctly (wrap around)', () => {
            expect(formatFgcTime(24 * 60)).toBe('00:00');
            expect(formatFgcTime(25 * 60 + 30)).toBe('01:30');
        });
    });

    describe('resolveStationId', () => {
        it('should resolve known station names to IDs', () => {
            expect(resolveStationId('Pl. Catalunya')).toBe('PC');
            expect(resolveStationId('Sarrià')).toBe('SR');
            expect(resolveStationId('Terrassa Rambla')).toBe('TR');
        });

        it('should handle partial matches', () => {
            expect(resolveStationId('Catalunya')).toBe('PC');
            expect(resolveStationId('Gracia')).toBe('GR');
            expect(resolveStationId('Taller Rubí')).toBe('RB');
        });

        it('should return first 2 chars for unknown long names', () => {
            expect(resolveStationId('UnknownStation')).toBe('UN');
        });

        it('should return original for short names', () => {
            expect(resolveStationId('PC')).toBe('PC');
            expect(resolveStationId('A')).toBe('A');
        });
    });
});
