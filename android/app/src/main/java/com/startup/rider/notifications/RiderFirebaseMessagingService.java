package com.startup.rider.notifications;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.startup.rider.RiderApplication;
import com.startup.rider.data.RiderRepository;

import java.util.Map;

public final class RiderFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        RiderApplication.container(this)
                .riderRepository()
                .registerDevice(token, new RiderRepository.EmptyResult<>());
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        if (!"order_available".equals(data.get("type"))) {
            return;
        }

        if (RiderRuntimeState.isForegroundIdle(this)) {
            sendBroadcast(OrderAlertNotifier.broadcastIntent(this, data));
            return;
        }

        if (new NotificationDeduper(this).shouldShow(OrderAlertNotifier.dedupeKey(data))) {
            OrderAlertNotifier.show(this, data);
        }
    }
}
