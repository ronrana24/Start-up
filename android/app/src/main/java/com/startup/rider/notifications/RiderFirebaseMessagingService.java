package com.startup.rider.notifications;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.startup.rider.MainActivity;
import com.startup.rider.R;
import com.startup.rider.RiderApplication;
import com.startup.rider.data.RiderRepository;

import java.util.Map;

public final class RiderFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "RiderFcmService";

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

        String orderId = data.get("orderId");
        String createdAt = data.get("orderCreatedAt");
        if (!new NotificationDeduper(this).shouldShow(orderId + ":" + createdAt)) {
            return;
        }
        showOrderNotification(data);
    }

    private void showOrderNotification(Map<String, String> data) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            Log.i(TAG, "Notification permission not granted; dropping foreground order alert.");
            return;
        }

        String orderId = data.get("orderId");
        String deliveryAddress = valueOrFallback(data.get("deliveryAddress"), "Delivery address");
        String payout = valueOrFallback(data.get("estimatedPayout"), "Payout available");
        String distance = valueOrFallback(data.get("deliveryDistance"), "Distance pending");

        Intent intent = new Intent(this, MainActivity.class)
                .setAction("OPEN_ORDER")
                .setData(Uri.parse("rider://orders/" + orderId))
                .putExtra(MainActivity.EXTRA_ORDER_ID, orderId)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                orderId == null ? 0 : orderId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, NotificationChannels.ORDERS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("New delivery available")
                .setContentText(deliveryAddress + " - " + payout)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(deliveryAddress + "\n" + payout + " - " + distance))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(this).notify(orderId == null ? 10 : orderId.hashCode(), notification.build());
    }

    private static String valueOrFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
