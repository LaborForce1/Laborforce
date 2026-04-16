import type { User } from "@laborforce/shared";
import zipcodes from "zipcodes";
import { usersRepository } from "../modules/users/repository.js";

export interface ResolvedUsZipLocation {
  zipCode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

const US_ZIP_CODE_REGEX = /^\d{5}(?:-\d{4})?$/;

export function hasCoordinates(latitude?: number | null, longitude?: number | null) {
  return (
    Number.isFinite(latitude ?? Number.NaN) &&
    Number.isFinite(longitude ?? Number.NaN) &&
    ((latitude ?? 0) !== 0 || (longitude ?? 0) !== 0)
  );
}

export function distanceMilesBetweenCoordinates(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const longitudeDelta = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const originLatitude = (origin.latitude * Math.PI) / 180;
  const destinationLatitude = (destination.latitude * Math.PI) / 180;

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function normalizeUsZipCode(value: string) {
  const normalized = value.trim();

  if (!US_ZIP_CODE_REGEX.test(normalized)) {
    return null;
  }

  return normalized.slice(0, 5);
}

export function lookupUsZipCode(value: string): ResolvedUsZipLocation | null {
  const normalizedZipCode = normalizeUsZipCode(value);
  if (!normalizedZipCode) {
    return null;
  }

  const location = zipcodes.lookup(normalizedZipCode);
  if (!location || location.country !== "US") {
    return null;
  }

  return {
    zipCode: location.zip,
    city: location.city,
    state: location.state,
    latitude: location.latitude,
    longitude: location.longitude
  };
}

export function formatUsZipAreaLabel(location: ResolvedUsZipLocation) {
  return `${location.city}, ${location.state}`;
}

export async function ensureUserCoordinates(user: User) {
  if (hasCoordinates(user.latitude, user.longitude)) {
    return user;
  }

  const resolvedLocation = lookupUsZipCode(user.zipCode);
  if (!resolvedLocation) {
    return user;
  }

  const updatedUser = await usersRepository.updateLocation(user.id, {
    zipCode: resolvedLocation.zipCode,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude
  });

  return updatedUser ?? user;
}
