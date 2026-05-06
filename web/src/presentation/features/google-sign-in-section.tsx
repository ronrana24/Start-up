"use client";

import { GoogleLogin } from "@react-oauth/google";

export type GoogleSignInSectionProps = {
  googleBusy: boolean;
  setGoogleBusy: (busy: boolean) => void;
  onCredentialSuccess: (idToken: string) => void;
  onCredentialMissing: () => void;
  onGoogleSdkError: () => void;
};

function GoogleMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.63 37.01 48 31.08 48 24.55z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export function GoogleSignInSection({
  googleBusy,
  setGoogleBusy,
  onCredentialSuccess,
  onCredentialMissing,
  onGoogleSdkError,
}: GoogleSignInSectionProps) {
  if (googleBusy) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-5 py-2">
        <GoogleMarkIcon className="h-14 w-14 shrink-0" />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-lg font-semibold tracking-tight text-heading">Authenticating</p>
          <p className="max-w-sm px-1 text-sm leading-relaxed text-secondary">
            Waiting for Google to confirm your identity securely
          </p>
        </div>
        <div
          className="h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center [&>div]:w-full [&>div]:flex [&>div]:justify-center">
        <GoogleLogin
          text="continue_with"
          shape="pill"
          size="large"
          theme="outline"
          width={320}
          useOneTap={false}
          use_fedcm_for_button={false}
          onSuccess={(cred) => {
            const idToken = cred.credential;
            if (!idToken) {
              onCredentialMissing();
              return;
            }
            onCredentialSuccess(idToken);
          }}
          click_listener={() => {
            setGoogleBusy(true);
          }}
          onError={() => {
            setGoogleBusy(false);
            onGoogleSdkError();
          }}
        />
      </div>
    </div>
  );
}
