export const BUSINESS_TYPES = [
  "FOOD_AND_BEVERAGE",
  "HEALTHCARE_AND_MEDICAL",
  "HOSPITALITY_AND_SERVICES",
  "RETAIL_AND_ECOMMERCE",
  "OTHER",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export type UpdateUserProfileInput = {
  businessName?: string;
  businessType?: BusinessType;
  /** Omit or leave empty to skip updating GST */
  gstNumber?: string | null;
  isOnboardingCompleted?: boolean;
};

export type CreateUserAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number | null;
  locationSource?: string;
  isDefault?: boolean;
};

export type UserAddress = {
  id: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  locationSource?: string | null;
  isDefault: boolean;
};

export type UserProfile = {
  id: string;
  phone: string | null;
  email?: string | null;
  name?: string | null;
  businessName: string;
  businessType: BusinessType;
  gstNumber?: string | null;
  isOnboardingCompleted: boolean;
  roles: Array<"BUYER" | "ADMIN" | "RIDER">;
  addresses: UserAddress[];
};

export type UserProfileGateway = {
  getProfile(accessToken: string | null): Promise<UserProfile>;
  listAddresses(accessToken: string | null): Promise<UserAddress[]>;
  updateProfile(
    accessToken: string | null,
    input: UpdateUserProfileInput,
  ): Promise<void>;
  createAddress(
    accessToken: string | null,
    input: CreateUserAddressInput,
  ): Promise<UserAddress>;
};
