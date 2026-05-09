package com.startup.rider.data;

import com.startup.rider.AppConfig;
import com.startup.rider.BuildConfig;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public final class ApiClient {
    private final RiderApi api;

    public ApiClient(SecureSessionStore sessionStore) {
        OkHttpClient.Builder client = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .addInterceptor(new AuthInterceptor(sessionStore));

        if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BASIC);
            client.addInterceptor(logging);
        }

        api = new Retrofit.Builder()
                .baseUrl(AppConfig.API_BASE_URL + "/")
                .client(client.build())
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(RiderApi.class);
    }

    public RiderApi api() {
        return api;
    }

    private static final class AuthInterceptor implements Interceptor {
        private final SecureSessionStore sessionStore;

        private AuthInterceptor(SecureSessionStore sessionStore) {
            this.sessionStore = sessionStore;
        }

        @Override
        public Response intercept(Chain chain) throws IOException {
            Request original = chain.request();
            Request.Builder builder = original.newBuilder()
                    .header("Accept", "application/json");
            String token = sessionStore.accessToken();
            if (token != null && !token.trim().isEmpty()) {
                builder.header("Authorization", "Bearer " + token);
            }
            Response response = chain.proceed(builder.build());
            if (response.code() == 401) {
                sessionStore.clear();
            }
            return response;
        }
    }
}
