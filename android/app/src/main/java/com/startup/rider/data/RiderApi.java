package com.startup.rider.data;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.PATCH;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface RiderApi {
    @POST("/api/auth/send-otp")
    Call<Dtos.Envelope<Dtos.OtpResponse>> sendOtp(@Body Dtos.SendOtpRequest request);

    @POST("/api/auth/rider/verify-otp")
    Call<Dtos.Envelope<Dtos.AuthPayload>> verifyRiderOtp(@Body Dtos.VerifyOtpRequest request);

    @POST("/api/auth/rider/google")
    Call<Dtos.Envelope<Dtos.GoogleAuthResponse>> riderGoogleLogin(@Body Dtos.GoogleLoginRequest request);

    @POST("/api/auth/rider/google/send-otp")
    Call<Dtos.Envelope<Dtos.OtpResponse>> riderGoogleSendOtp(@Body Dtos.GoogleSendOtpRequest request);

    @POST("/api/auth/rider/google/complete")
    Call<Dtos.Envelope<Dtos.GoogleAuthResponse>> riderGoogleComplete(@Body Dtos.GoogleCompleteRequest request);

    @POST("/api/auth/logout")
    Call<Dtos.Envelope<Object>> logout();

    @GET("/api/users/me")
    Call<Dtos.Envelope<Dtos.UserDto>> profile();

    @PATCH("/api/users/me")
    Call<Dtos.Envelope<Dtos.UserDto>> updateProfile(@Body Dtos.UpdateProfileRequest request);

    @POST("/api/users/me/addresses")
    Call<Dtos.Envelope<Dtos.AddressDto>> createAddress(@Body Dtos.CreateAddressRequest request);

    @GET("/api/riders/me")
    Call<Dtos.Envelope<Dtos.RiderDto>> me();

    @GET("/api/riders/orders/available")
    Call<Dtos.Envelope<Dtos.Page<Dtos.OrderDto>>> availableOrders(
            @Query("page") int page,
            @Query("pageSize") int pageSize
    );

    @GET("/api/riders/orders/active")
    Call<Dtos.Envelope<Dtos.OrderDto>> activeOrder();

    @POST("/api/riders/devices")
    Call<Dtos.Envelope<Object>> registerDevice(@Body Dtos.RegisterDeviceRequest request);

    @POST("/api/riders/orders/{orderId}/claim")
    Call<Dtos.Envelope<Dtos.OrderDto>> claimOrder(@Path("orderId") String orderId);

    @PATCH("/api/riders/orders/{orderId}/status")
    Call<Dtos.Envelope<Dtos.OrderDto>> patchDeliveryStatus(
            @Path("orderId") String orderId,
            @Body Dtos.PatchStatusRequest request
    );

    @PATCH("/api/riders/me/location")
    Call<Dtos.Envelope<Dtos.RiderDto>> patchLocation(@Body Dtos.PatchLocationRequest request);
}
