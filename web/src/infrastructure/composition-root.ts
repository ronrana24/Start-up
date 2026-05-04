import type { AppDependencies } from "@application/app-dependencies";
import { createHttpAuthGateway } from "@infrastructure/http/http-auth-gateway";
import { createHttpOtpGateway } from "@infrastructure/http/http-otp-gateway";
import { createHttpUserProfileGateway } from "@infrastructure/http/http-user-profile-gateway";
import { createMockOrderReader } from "@infrastructure/mock/mock-order-reader";
import { createMockOrderWriter } from "@infrastructure/mock/mock-order-writer";
import { createMockOtpGateway } from "@infrastructure/mock/mock-otp-gateway";
import { createMockProductReader } from "@infrastructure/mock/mock-product-reader";
import { createMockUserProfileGateway } from "@infrastructure/mock/mock-user-profile-gateway";
import { createUnavailableAuthGateway } from "@infrastructure/mock/unavailable-auth-gateway";

export type ApiMode = "mock" | "http";

function readApiMode(): ApiMode {
  const raw = process.env.NEXT_PUBLIC_API_MODE?.toLowerCase();
  return raw === "http" ? "http" : "mock";
}

function readApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
}

function createMockAppDependencies(): AppDependencies {
  return {
    productReader: createMockProductReader(),
    orderReader: createMockOrderReader(),
    orderWriter: createMockOrderWriter(),
    otpGateway: createMockOtpGateway(),
    authGateway: createUnavailableAuthGateway(),
    userProfileGateway: createMockUserProfileGateway(),
  };
}

/**
 * HTTP auth + OTP against Nest `api` prefix; catalog and orders stay mock until
 * HTTP adapters exist. Real JWT `userId` will not match mock order seeds (`demo-user`).
 */
function createHttpAppDependencies(): AppDependencies {
  const baseUrl = readApiBaseUrl();
  return {
    productReader: createMockProductReader(),
    orderReader: createMockOrderReader(),
    orderWriter: createMockOrderWriter(),
    otpGateway: createHttpOtpGateway(baseUrl),
    authGateway: createHttpAuthGateway(baseUrl),
    userProfileGateway: createHttpUserProfileGateway(baseUrl),
  };
}

export function createAppDependencies(): AppDependencies {
  const mode = readApiMode();
  if (mode === "http") {
    return createHttpAppDependencies();
  }
  return createMockAppDependencies();
}
