package com.startup.rider.data;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.google.gson.Gson;

public final class SecureSessionStore {
    private static final String TAG = "SecureSessionStore";
    private static final String PREFS = "rider_secure_session";
    private static final String FALLBACK_PREFS = "rider_session";
    private static final String ACCESS_TOKEN = "access_token";
    private static final String RIDER = "rider";
    private static final String USER = "user";
    private static final String DEVICE_TOKEN = "device_token";
    private static final String ONBOARDING_ADDRESS_DRAFT = "onboarding_address_draft";

    private final SharedPreferences prefs;
    private final Gson gson = new Gson();

    public SecureSessionStore(Context context) {
        prefs = createPreferences(context.getApplicationContext());
    }

    public void saveSession(Dtos.AuthPayload payload) {
        SharedPreferences.Editor editor = prefs.edit()
                .putString(ACCESS_TOKEN, payload.accessToken)
                .putString(USER, gson.toJson(payload.user));
        if (payload.rider != null) {
            editor.putString(RIDER, gson.toJson(payload.rider));
        }
        editor.apply();
    }

    public void updateRider(Dtos.RiderDto rider) {
        if (rider != null) {
            prefs.edit().putString(RIDER, gson.toJson(rider)).apply();
        }
    }

    public void updateUser(Dtos.UserDto user) {
        if (user != null) {
            prefs.edit().putString(USER, gson.toJson(user)).apply();
        }
    }

    public String accessToken() {
        return prefs.getString(ACCESS_TOKEN, null);
    }

    public Dtos.RiderDto rider() {
        String raw = prefs.getString(RIDER, null);
        if (raw == null) {
            return null;
        }
        try {
            return gson.fromJson(raw, Dtos.RiderDto.class);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    public Dtos.UserDto user() {
        String raw = prefs.getString(USER, null);
        if (raw == null) {
            return null;
        }
        try {
            return gson.fromJson(raw, Dtos.UserDto.class);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    public boolean isOnboardingCompleted() {
        Dtos.UserDto user = user();
        return user != null && user.isOnboardingCompleted;
    }

    public boolean isLoggedIn() {
        String token = accessToken();
        return token != null && !token.trim().isEmpty();
    }

    public void saveDeviceToken(String token) {
        prefs.edit().putString(DEVICE_TOKEN, token).apply();
    }

    public String deviceToken() {
        return prefs.getString(DEVICE_TOKEN, null);
    }

    public void clear() {
        String deviceToken = deviceToken();
        prefs.edit().clear().putString(DEVICE_TOKEN, deviceToken).apply();
    }

    public void saveOnboardingAddressDraft(Dtos.AddressDraft draft) {
        prefs.edit().putString(ONBOARDING_ADDRESS_DRAFT, gson.toJson(draft)).apply();
    }

    public Dtos.AddressDraft onboardingAddressDraft() {
        String raw = prefs.getString(ONBOARDING_ADDRESS_DRAFT, null);
        if (raw == null) {
            return new Dtos.AddressDraft();
        }
        try {
            Dtos.AddressDraft draft = gson.fromJson(raw, Dtos.AddressDraft.class);
            return draft == null ? new Dtos.AddressDraft() : draft;
        } catch (RuntimeException ignored) {
            return new Dtos.AddressDraft();
        }
    }

    public void clearOnboardingAddressDraft() {
        prefs.edit().remove(ONBOARDING_ADDRESS_DRAFT).apply();
    }

    private SharedPreferences createPreferences(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    context,
                    PREFS,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception error) {
            Log.w(TAG, "Encrypted session storage unavailable; falling back to app-private storage.", error);
            return context.getSharedPreferences(FALLBACK_PREFS, Context.MODE_PRIVATE);
        }
    }
}
