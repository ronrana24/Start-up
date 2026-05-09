package com.startup.rider;

import android.content.Context;

import com.startup.rider.data.ApiClient;
import com.startup.rider.data.RiderRepository;
import com.startup.rider.data.SecureSessionStore;
import com.startup.rider.realtime.DeliverySocketManager;

public final class AppContainer {
    private final SecureSessionStore sessionStore;
    private final ApiClient apiClient;
    private final RiderRepository riderRepository;
    private final DeliverySocketManager deliverySocketManager;

    public AppContainer(Context context) {
        Context appContext = context.getApplicationContext();
        sessionStore = new SecureSessionStore(appContext);
        apiClient = new ApiClient(sessionStore);
        riderRepository = new RiderRepository(apiClient.api(), sessionStore);
        deliverySocketManager = new DeliverySocketManager();
    }

    public SecureSessionStore sessionStore() {
        return sessionStore;
    }

    public RiderRepository riderRepository() {
        return riderRepository;
    }

    public DeliverySocketManager deliverySocketManager() {
        return deliverySocketManager;
    }
}
