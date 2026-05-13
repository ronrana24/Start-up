import type {
  CreateUserAddressInput,
  UpdateUserProfileInput,
  UserAddress,
  UserProfile,
  UserProfileGateway,
} from "@application/ports/user-profile-gateway";
import { apiJsonAuthorized } from "@infrastructure/http/http-client";

type ApiEnvelope<T> = { data: T };

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function patchProfileBody(
  input: UpdateUserProfileInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.businessName !== undefined) {
    body.businessName = input.businessName;
  }
  if (input.businessType !== undefined) {
    body.businessType = input.businessType;
  }
  const gst = input.gstNumber?.trim();
  if (gst) {
    body.gstNumber = gst.toUpperCase();
  }
  if (input.isOnboardingCompleted !== undefined) {
    body.isOnboardingCompleted = input.isOnboardingCompleted;
  }
  return body;
}

function addressBody(input: CreateUserAddressInput): Record<string, unknown> {
  return {
    line1: input.line1,
    line2: input.line2,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    ...(input.latitude !== undefined && { latitude: input.latitude }),
    ...(input.longitude !== undefined && { longitude: input.longitude }),
    ...(input.locationAccuracyMeters !== undefined && {
      locationAccuracyMeters: input.locationAccuracyMeters,
    }),
    ...(input.locationSource !== undefined && {
      locationSource: input.locationSource,
    }),
    isDefault: input.isDefault ?? true,
  };
}

export function createHttpUserProfileGateway(
  baseUrl: string,
): UserProfileGateway {
  return {
    async getProfile() {
      return unwrapBody(
        await apiJsonAuthorized<UserProfile | ApiEnvelope<UserProfile>>(
          baseUrl,
          "/api/users/me",
          {
            method: "GET",
          },
        ),
      );
    },
    async listAddresses() {
      return unwrapBody(
        await apiJsonAuthorized<UserAddress[] | ApiEnvelope<UserAddress[]>>(
          baseUrl,
          "/api/users/me/addresses",
          {
            method: "GET",
          },
        ),
      );
    },
    async updateProfile(accessToken, input) {
      void accessToken;
      await apiJsonAuthorized<unknown>(baseUrl, "/api/users/me", {
        method: "PATCH",
        body: patchProfileBody(input),
      });
    },
    async createAddress(accessToken, input) {
      void accessToken;
      return unwrapBody(
        await apiJsonAuthorized<UserAddress | ApiEnvelope<UserAddress>>(
          baseUrl,
          "/api/users/me/addresses",
          {
            method: "POST",
            body: addressBody(input),
          },
        ),
      );
    },
  };
}
