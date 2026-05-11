import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import type { BusinessType } from "@application/ports/user-profile-gateway";
import { cn } from "@presentation/lib/cn";

const BUSINESS_OPTIONS: {
  value: BusinessType;
  title: string;
  description: string;
  spanFull?: boolean;
}[] = [
  {
    value: "FOOD_AND_BEVERAGE",
    title: "Food and Beverage",
    description: "Restaurants, catering, and F&B supply",
  },
  {
    value: "HEALTHCARE_AND_MEDICAL",
    title: "Healthcare and Medical",
    description: "Clinics, pharmacies, and medical supply",
  },
  {
    value: "HOSPITALITY_AND_SERVICES",
    title: "Hospitality and Services",
    description: "Hotels, venues, events, and facilities",
  },
  {
    value: "RETAIL_AND_ECOMMERCE",
    title: "Retail and E-commerce",
    description: "Stores, online sellers, and distributors",
  },
  {
    value: "OTHER",
    title: "Other",
    description: "Any other wholesale or B2B business",
    spanFull: true,
  },
];

export type BusinessFormState = {
  businessName: string;
  businessType: BusinessType;
  gstNumber: string;
};

type OnboardingBusinessStepProps = {
  value: BusinessFormState;
  onChange: (next: BusinessFormState) => void;
  onNext: () => void;
  onBack: () => void;
  fieldErrors?: Partial<Record<"businessName" | "gstNumber", string>>;
};

export function OnboardingBusinessStep({
  value,
  onChange,
  onNext,
  onBack,
  fieldErrors,
}: OnboardingBusinessStepProps) {
  function set<K extends keyof BusinessFormState>(key: K, v: BusinessFormState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-heading">Tell us about your business</h1>
        <p className="mt-1 text-sm text-secondary">
          This helps us verify wholesale eligibility and delivery logistics.
        </p>
      </div>

      <Card className="space-y-5 p-5 shadow-sm">
        <Input
          label="Legal business name *"
          name="businessName"
          value={value.businessName}
          onChange={(e) => set("businessName", e.target.value)}
          placeholder="e.g. Acme Catering Pvt Ltd"
          autoComplete="organization"
          error={fieldErrors?.businessName}
          required
        />

        <fieldset>
          <legend className="mb-3 text-sm font-medium text-heading">
            Primary business type *
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {BUSINESS_OPTIONS.map((opt) => {
              const selected = value.businessType === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(opt.spanFull && "col-span-2", "cursor-pointer")}
                >
                  <input
                    type="radio"
                    name="businessType"
                    value={opt.value}
                    checked={selected}
                    onChange={() => set("businessType", opt.value)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border p-4 transition-colors",
                      selected
                        ? "border-primary bg-primary-light/50 shadow-[inset_0_0_0_1px_rgba(31,122,99,0.15)]"
                        : "border-default bg-input-bg hover:bg-secondary-bg",
                      opt.spanFull ? "min-h-0 flex-row items-center" : "min-h-[100px]",
                    )}
                  >
                    <span className="text-sm font-semibold text-heading">{opt.title}</span>
                    <span className="text-xs text-secondary">{opt.description}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Input
          label="GST number (optional)"
          name="gstNumber"
          value={value.gstNumber}
          onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
          placeholder="15-character GSTIN"
          autoComplete="off"
          maxLength={15}
          error={fieldErrors?.gstNumber}
        />
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button type="button" className="flex-1" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
