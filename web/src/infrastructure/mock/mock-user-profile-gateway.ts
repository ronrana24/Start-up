import type {
  UserAddress,
  UserProfile,
  UserProfileGateway,
} from "@application/ports/user-profile-gateway";
import { DEMO_USER_ID } from "@domain/demo-user";

let mockAddresses: UserAddress[] = [
  {
    id: "addr_demo_1",
    line1: "12 Brigade Road",
    line2: "Near Church Street",
    city: "Bengaluru",
    state: "KA",
    pincode: "560001",
    isDefault: true,
  },
];

let mockProfile: UserProfile = {
  id: DEMO_USER_ID,
  phone: "+919999999999",
  email: null,
  name: null,
  businessName: "Demo Restaurant Outlet",
  businessType: "FOOD_AND_BEVERAGE",
  gstNumber: null,
  isOnboardingCompleted: false,
  role: "BUYER",
  addresses: mockAddresses,
};

/**
 * Mock mode has no real JWT backend for profile/address writes; onboarding submit
 * surfaces this error until HTTP mode is enabled.
 */
export function createMockUserProfileGateway(): UserProfileGateway {
  return {
    async getProfile() {
      return { ...mockProfile, addresses: mockAddresses };
    },
    async listAddresses() {
      return mockAddresses;
    },
    async updateProfile(_accessToken, input) {
      mockProfile = {
        ...mockProfile,
        ...(input.businessName !== undefined && {
          businessName: input.businessName,
        }),
        ...(input.businessType !== undefined && {
          businessType: input.businessType,
        }),
        ...(input.gstNumber !== undefined && { gstNumber: input.gstNumber }),
        ...(input.isOnboardingCompleted !== undefined && {
          isOnboardingCompleted: input.isOnboardingCompleted,
        }),
      };
    },
    async createAddress(_accessToken, input) {
      if (input.isDefault) {
        mockAddresses = mockAddresses.map((address) => ({
          ...address,
          isDefault: false,
        }));
      }
      const address: UserAddress = {
        id: `addr_demo_${mockAddresses.length + 1}`,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        isDefault: input.isDefault ?? true,
      };
      mockAddresses = [address, ...mockAddresses];
      return address;
    },
  };
}
