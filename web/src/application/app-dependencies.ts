import type { AuthGateway } from "@application/ports/auth-gateway";
import type { OrderReader } from "@application/ports/order-reader";
import type { OrderWriter } from "@application/ports/order-writer";
import type { OtpGateway } from "@application/ports/otp-gateway";
import type { ProductReader } from "@application/ports/product-reader";
import type { UserProfileGateway } from "@application/ports/user-profile-gateway";

export type AppDependencies = {
  productReader: ProductReader;
  orderReader: OrderReader;
  orderWriter: OrderWriter;
  otpGateway: OtpGateway;
  authGateway: AuthGateway;
  userProfileGateway: UserProfileGateway;
};
