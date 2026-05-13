package com.startup.rider.data;

import androidx.annotation.NonNull;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Response;

public final class RiderRepository {
    private final RiderApi api;
    private final SecureSessionStore sessionStore;

    public RiderRepository(RiderApi api, SecureSessionStore sessionStore) {
        this.api = api;
        this.sessionStore = sessionStore;
    }

    public void sendOtp(String phone, Result<Dtos.OtpResponse> result) {
        enqueue(api.sendOtp(new Dtos.SendOtpRequest(phone)), result);
    }

    public void verifyOtp(String phone, String otp, Result<Dtos.AuthPayload> result) {
        enqueue(api.verifyRiderOtp(new Dtos.VerifyOtpRequest(phone, otp)), new Result<Dtos.AuthPayload>() {
            @Override
            public void onSuccess(Dtos.AuthPayload value) {
                sessionStore.saveSession(value);
                result.onSuccess(value);
            }

            @Override
            public void onError(ApiFailure failure) {
                result.onError(failure);
            }
        });
    }

    public void loginWithGoogle(String idToken, Result<Dtos.GoogleAuthResponse> result) {
        enqueue(api.riderGoogleLogin(new Dtos.GoogleLoginRequest(idToken)), new Result<Dtos.GoogleAuthResponse>() {
            @Override
            public void onSuccess(Dtos.GoogleAuthResponse value) {
                saveGoogleSessionIfAuthenticated(value);
                result.onSuccess(value);
            }

            @Override
            public void onError(ApiFailure failure) {
                result.onError(failure);
            }
        });
    }

    public void sendGoogleOtp(String registrationToken, String phone, Result<Dtos.OtpResponse> result) {
        enqueue(api.riderGoogleSendOtp(new Dtos.GoogleSendOtpRequest(registrationToken, phone)), result);
    }

    public void completeGoogle(String registrationToken, String phone, String otp, Result<Dtos.GoogleAuthResponse> result) {
        enqueue(api.riderGoogleComplete(new Dtos.GoogleCompleteRequest(registrationToken, phone, otp)), new Result<Dtos.GoogleAuthResponse>() {
            @Override
            public void onSuccess(Dtos.GoogleAuthResponse value) {
                saveGoogleSessionIfAuthenticated(value);
                result.onSuccess(value);
            }

            @Override
            public void onError(ApiFailure failure) {
                result.onError(failure);
            }
        });
    }

    public void bootstrap(Result<Dtos.RiderDto> result) {
        enqueue(api.me(), new Result<Dtos.RiderDto>() {
            @Override
            public void onSuccess(Dtos.RiderDto value) {
                sessionStore.updateRider(value);
                result.onSuccess(value);
            }

            @Override
            public void onError(ApiFailure failure) {
                result.onError(failure);
            }
        });
    }

    public void refreshProfile(Result<Dtos.UserDto> result) {
        enqueue(api.profile(), new Result<Dtos.UserDto>() {
            @Override
            public void onSuccess(Dtos.UserDto value) {
                sessionStore.updateUser(value);
                result.onSuccess(value);
            }

            @Override
            public void onError(ApiFailure failure) {
                result.onError(failure);
            }
        });
    }

    public void completeOnboarding(Dtos.CreateAddressRequest address, Result<Dtos.UserDto> result) {
        enqueue(api.createAddress(address), new Result<Dtos.AddressDto>() {
            @Override
            public void onSuccess(Dtos.AddressDto value) {
                enqueue(api.updateProfile(new Dtos.UpdateProfileRequest(true)), new Result<Dtos.UserDto>() {
                    @Override
                    public void onSuccess(Dtos.UserDto user) {
                        sessionStore.updateUser(user);
                        sessionStore.clearOnboardingAddressDraft();
                        result.onSuccess(user);
                    }

                    @Override
                    public void onError(ApiFailure failure) {
                        result.onError(failure);
                    }
                });
            }

            @Override
            public void onError(ApiFailure failure) {
                result.onError(failure);
            }
        });
    }

    public void availableOrders(int page, int pageSize, Result<Dtos.Page<Dtos.OrderDto>> result) {
        enqueue(api.availableOrders(page, pageSize), result);
    }

    public void activeOrder(Result<Dtos.OrderDto> result) {
        enqueue(api.activeOrder(), result);
    }

    public void activeOrders(Result<List<Dtos.OrderDto>> result) {
        enqueue(api.activeOrders(), result);
    }

    public void orderHistory(String period, int page, int pageSize, Result<Dtos.RiderOrderHistoryResponse> result) {
        enqueue(api.orderHistory(period, page, pageSize), result);
    }

    public void orderDetails(String orderId, Result<Dtos.OrderDto> result) {
        enqueue(api.orderDetails(orderId), result);
    }

    public void registerDevice(String token, Result<Object> result) {
        sessionStore.saveDeviceToken(token);
        if (!sessionStore.isLoggedIn()) {
            result.onSuccess(new Object());
            return;
        }
        enqueue(api.registerDevice(new Dtos.RegisterDeviceRequest(token)), result);
    }

    public void claimOrder(String orderId, Result<Dtos.OrderDto> result) {
        enqueue(api.claimOrder(orderId), result);
    }

    public void patchDeliveryStatus(String orderId, String status, Result<Dtos.OrderDto> result) {
        enqueue(api.patchDeliveryStatus(orderId, new Dtos.PatchStatusRequest(status)), result);
    }

    public void patchLocation(double lat, double lng, Float heading, Result<Dtos.RiderDto> result) {
        enqueue(api.patchLocation(new Dtos.PatchLocationRequest(lat, lng, heading)), result);
    }

    public void logout(Result<Object> result) {
        api.logout().enqueue(new retrofit2.Callback<Dtos.Envelope<Object>>() {
            @Override
            public void onResponse(
                    @NonNull Call<Dtos.Envelope<Object>> call,
                    @NonNull Response<Dtos.Envelope<Object>> response
            ) {
                sessionStore.clear();
                result.onSuccess(new Object());
            }

            @Override
            public void onFailure(@NonNull Call<Dtos.Envelope<Object>> call, @NonNull Throwable t) {
                sessionStore.clear();
                result.onSuccess(new Object());
            }
        });
    }

    private <T> void enqueue(Call<Dtos.Envelope<T>> call, Result<T> result) {
        call.enqueue(new retrofit2.Callback<Dtos.Envelope<T>>() {
            @Override
            public void onResponse(@NonNull Call<Dtos.Envelope<T>> call, @NonNull Response<Dtos.Envelope<T>> response) {
                if (!response.isSuccessful()) {
                    result.onError(ApiFailure.fromResponse(response));
                    return;
                }
                Dtos.Envelope<T> envelope = response.body();
                result.onSuccess(envelope == null ? null : envelope.data);
            }

            @Override
            public void onFailure(@NonNull Call<Dtos.Envelope<T>> call, @NonNull Throwable t) {
                result.onError(ApiFailure.fromThrowable(t));
            }
        });
    }

    private void saveGoogleSessionIfAuthenticated(Dtos.GoogleAuthResponse value) {
        if (value == null || !value.isAuthenticated()) {
            return;
        }
        Dtos.AuthPayload payload = new Dtos.AuthPayload();
        payload.accessToken = value.accessToken;
        payload.user = value.user;
        payload.rider = value.rider;
        sessionStore.saveSession(payload);
    }

    public interface Result<T> {
        void onSuccess(T value);

        void onError(ApiFailure failure);
    }

    public static class EmptyResult<T> implements Result<T> {
        @Override
        public void onSuccess(T value) {
        }

        @Override
        public void onError(ApiFailure failure) {
        }
    }

    public static final class ApiFailure {
        public final String message;
        public final boolean unauthorized;
        public final boolean forbidden;
        public final boolean network;
        public final boolean onboardingRequired;
        public final int statusCode;

        private ApiFailure(String message, int statusCode, boolean network) {
            this.message = message;
            this.statusCode = statusCode;
            this.unauthorized = statusCode == 401;
            this.forbidden = statusCode == 403;
            this.network = network;
            this.onboardingRequired = forbidden && message != null
                    && message.toLowerCase(Locale.US).contains("onboarding");
        }

        public static ApiFailure fromResponse(Response<?> response) {
            String message = response.message();
            try {
                if (response.errorBody() != null) {
                    String raw = response.errorBody().string();
                    if (!raw.trim().isEmpty()) {
                        message = parseErrorMessage(raw);
                    }
                }
            } catch (IOException ignored) {
            }
            if (message == null || message.trim().isEmpty()) {
                if (response.code() == 401) {
                    message = "Your session expired. Please sign in again.";
                } else if (response.code() == 403) {
                    message = "You do not have permission to perform this action.";
                } else {
                    message = "Request failed";
                }
            }
            return new ApiFailure(message, response.code(), false);
        }

        public static ApiFailure fromThrowable(Throwable throwable) {
            return new ApiFailure("No internet connection. Check your network and try again.", 0, true);
        }

        private static String parseErrorMessage(String raw) {
            try {
                String message = messageFromJson(JsonParser.parseString(raw));
                return message == null || message.trim().isEmpty() ? raw : message;
            } catch (RuntimeException ignored) {
            }
            return raw;
        }

        private static String messageFromJson(JsonElement element) {
            if (element == null || element.isJsonNull()) {
                return null;
            }
            if (element.isJsonPrimitive()) {
                return element.getAsString();
            }
            if (element.isJsonArray()) {
                StringBuilder builder = new StringBuilder();
                for (JsonElement item : element.getAsJsonArray()) {
                    String message = messageFromJson(item);
                    if (message == null || message.trim().isEmpty()) {
                        continue;
                    }
                    if (builder.length() > 0) {
                        builder.append("; ");
                    }
                    builder.append(message);
                }
                return builder.length() == 0 ? null : builder.toString();
            }
            if (element.isJsonObject()) {
                JsonObject object = element.getAsJsonObject();
                String message = object.has("message") ? messageFromJson(object.get("message")) : null;
                String details = object.has("details") ? messageFromJson(object.get("details")) : null;
                if (isGenericValidationMessage(message) && details != null && !details.trim().isEmpty()) {
                    return details;
                }
                if (message != null && !message.trim().isEmpty()) {
                    return message;
                }
                String error = object.has("error") ? messageFromJson(object.get("error")) : null;
                if (error != null && !error.trim().isEmpty()) {
                    return error;
                }
                if (details != null && !details.trim().isEmpty()) {
                    return details;
                }
                return object.has("data") ? messageFromJson(object.get("data")) : null;
            }
            return null;
        }

        private static boolean isGenericValidationMessage(String message) {
            return "Please check the highlighted fields and try again.".equals(message)
                    || "Please check your request and try again.".equals(message);
        }
    }
}
