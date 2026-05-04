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

function patchProfileBody(input: UpdateUserProfileInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    businessName: input.businessName,
    businessType: input.businessType,
  };
  const gst = input.gstNumber?.trim();
  if (gst) {
    body.gstNumber = gst.toUpperCase();
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
    isDefault: input.isDefault ?? true,
  };
}

export function createHttpUserProfileGateway(baseUrl: string): UserProfileGateway {
  return {
    async getProfile(accessToken) {
      return unwrapBody(
        await apiJsonAuthorized<UserProfile | ApiEnvelope<UserProfile>>(
          baseUrl,
          "/api/users/me",
          {
            method: "GET",
            accessToken,
          },
        ),
      );
    },
    async listAddresses(accessToken) {
      return unwrapBody(
        await apiJsonAuthorized<UserAddress[] | ApiEnvelope<UserAddress[]>>(
          baseUrl,
          "/api/users/me/addresses",
          {
            method: "GET",
            accessToken,
          },
        ),
      );
    },
    async updateProfile(accessToken, input) {
      await apiJsonAuthorized<unknown>(baseUrl, "/api/users/me", {
        method: "PATCH",
        accessToken,
        body: patchProfileBody(input),
      });
    },
    async createAddress(accessToken, input) {
      return unwrapBody(
        await apiJsonAuthorized<UserAddress | ApiEnvelope<UserAddress>>(
          baseUrl,
          "/api/users/me/addresses",
          {
            method: "POST",
            accessToken,
            body: addressBody(input),
          },
        ),
      );
    },
  };
}
