package com.startup.rider.data;

import androidx.annotation.NonNull;

import java.io.IOException;

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

    public void availableOrders(int page, int pageSize, Result<Dtos.Page<Dtos.OrderDto>> result) {
        enqueue(api.availableOrders(page, pageSize), result);
    }

    public void activeOrder(Result<Dtos.OrderDto> result) {
        enqueue(api.activeOrder(), result);
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
        public final boolean network;

        private ApiFailure(String message, boolean unauthorized, boolean network) {
            this.message = message;
            this.unauthorized = unauthorized;
            this.network = network;
        }

        public static ApiFailure fromResponse(Response<?> response) {
            String message = response.message();
            try {
                if (response.errorBody() != null) {
                    String raw = response.errorBody().string();
                    if (!raw.trim().isEmpty()) {
                        message = raw;
                    }
                }
            } catch (IOException ignored) {
            }
            return new ApiFailure(message == null || message.isEmpty() ? "Request failed" : message, response.code() == 401, false);
        }

        public static ApiFailure fromThrowable(Throwable throwable) {
            return new ApiFailure(throwable.getMessage() == null ? "Network request failed" : throwable.getMessage(), false, true);
        }
    }
}
