import type { AppDependencies } from "@application/app-dependencies";
import { createHttpAuthGateway } from "@infrastructure/http/http-auth-gateway";
import { createHttpOrderReader, createHttpOrderWriter } from "@infrastructure/http/http-order-adapters";
import { createHttpOtpGateway } from "@infrastructure/http/http-otp-gateway";
import { createHttpProductReader } from "@infrastructure/http/http-product-reader";
import { createHttpUserProfileGateway } from "@infrastructure/http/http-user-profile-gateway";

function readApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
}

/**
 * Uses Nest-backed auth, catalog, orders, and user profile flows.
 */
function createHttpAppDependencies(): AppDependencies {
  const baseUrl = readApiBaseUrl();
  return {
    productReader: createHttpProductReader(baseUrl),
    orderReader: createHttpOrderReader(baseUrl),
    orderWriter: createHttpOrderWriter(baseUrl),
    otpGateway: createHttpOtpGateway(baseUrl),
    authGateway: createHttpAuthGateway(baseUrl),
    userProfileGateway: createHttpUserProfileGateway(baseUrl),
  };
}

export function createAppDependencies(): AppDependencies {
  return createHttpAppDependencies();
}
