export type PermissionState = "granted" | "denied" | "unsupported";

export type PermissionResult = {
  geolocation: PermissionState;
  notifications: PermissionState;
};

export type OnboardingDraft = {
  age: string;
  gender: string;
  pet: string;
  car: string;
  householdCount: string;
  careNeeds: string[];
  placeMethod: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
};

export type UpdateOnboardingDraft = <Key extends keyof OnboardingDraft>(
  key: Key,
  value: OnboardingDraft[Key],
) => void;

export const INITIAL_ONBOARDING_DRAFT: OnboardingDraft = {
  age: "",
  gender: "",
  pet: "",
  car: "",
  householdCount: "",
  careNeeds: [],
  placeMethod: "",
  postalCode: "",
  prefecture: "",
  city: "",
  addressLine: "",
};
