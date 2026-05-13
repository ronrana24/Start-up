package com.startup.rider.notifications;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.startup.rider.MainActivity;
import com.startup.rider.R;
import com.startup.rider.data.Dtos;

import java.util.Map;

public final class OrderAlertNotifier {
    public static final String ACTION_ORDER_AVAILABLE = "com.startup.rider.ORDER_AVAILABLE";
    public static final String EXTRA_ORDER_ID = "orderId";
    public static final String EXTRA_DELIVERY_ADDRESS = "deliveryAddress";
    public static final String EXTRA_ORDER_TOTAL = "orderTotal";
    public static final String EXTRA_ESTIMATED_PAYOUT = "estimatedPayout";
    public static final String EXTRA_DELIVERY_DISTANCE = "deliveryDistance";
    public static final String EXTRA_DELIVERY_LAT = "deliveryLat";
    public static final String EXTRA_DELIVERY_LNG = "deliveryLng";
    public static final String EXTRA_DELIVERY_ACCURACY_METERS = "deliveryAccuracyMeters";
    public static final String EXTRA_ORDER_CREATED_AT = "orderCreatedAt";

    private static final String TAG = "OrderAlertNotifier";

    private OrderAlertNotifier() {
    }

    public static void show(Context context, Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        show(
                context,
                order.id,
                Dtos.deliveryAddress(order),
                order.totalAmount == null || order.totalAmount.trim().isEmpty() ? Dtos.payout(order) : Dtos.total(order),
                Dtos.timeSinceCreated(order)
        );
    }

    public static void show(Context context, Map<String, String> data) {
        show(
                context,
                data == null ? null : data.get(EXTRA_ORDER_ID),
                valueOrFallback(data == null ? null : data.get(EXTRA_DELIVERY_ADDRESS), "Delivery address"),
                orderValue(data),
                valueOrFallback(data == null ? null : data.get(EXTRA_DELIVERY_DISTANCE), "Distance pending")
        );
    }

    public static String dedupeKey(Dtos.OrderDto order) {
        if (order == null) {
            return null;
        }
        return dedupeKey(order.id, order.createdAt);
    }

    public static String dedupeKey(Map<String, String> data) {
        if (data == null) {
            return null;
        }
        return dedupeKey(data.get(EXTRA_ORDER_ID), data.get(EXTRA_ORDER_CREATED_AT));
    }

    public static Intent broadcastIntent(Context context, Map<String, String> data) {
        Intent intent = new Intent(ACTION_ORDER_AVAILABLE).setPackage(context.getPackageName());
        if (data == null) {
            return intent;
        }
        put(intent, EXTRA_ORDER_ID, data.get(EXTRA_ORDER_ID));
        put(intent, EXTRA_DELIVERY_ADDRESS, data.get(EXTRA_DELIVERY_ADDRESS));
        put(intent, EXTRA_ORDER_TOTAL, data.get(EXTRA_ORDER_TOTAL));
        put(intent, EXTRA_ESTIMATED_PAYOUT, data.get(EXTRA_ESTIMATED_PAYOUT));
        put(intent, EXTRA_DELIVERY_DISTANCE, data.get(EXTRA_DELIVERY_DISTANCE));
        put(intent, EXTRA_DELIVERY_LAT, data.get(EXTRA_DELIVERY_LAT));
        put(intent, EXTRA_DELIVERY_LNG, data.get(EXTRA_DELIVERY_LNG));
        put(intent, EXTRA_DELIVERY_ACCURACY_METERS, data.get(EXTRA_DELIVERY_ACCURACY_METERS));
        put(intent, EXTRA_ORDER_CREATED_AT, data.get(EXTRA_ORDER_CREATED_AT));
        return intent;
    }

    public static String dedupeKey(Intent intent) {
        if (intent == null) {
            return null;
        }
        return dedupeKey(intent.getStringExtra(EXTRA_ORDER_ID), intent.getStringExtra(EXTRA_ORDER_CREATED_AT));
    }

    public static String deliveryAddress(Intent intent) {
        return valueOrFallback(intent == null ? null : intent.getStringExtra(EXTRA_DELIVERY_ADDRESS), "Delivery address");
    }

    public static String payout(Intent intent) {
        return valueOrFallback(intent == null ? null : intent.getStringExtra(EXTRA_ESTIMATED_PAYOUT), "Payout available");
    }

    public static String orderTotal(Intent intent) {
        return valueOrFallback(intent == null ? null : intent.getStringExtra(EXTRA_ORDER_TOTAL), payout(intent));
    }

    public static String distance(Intent intent) {
        return valueOrFallback(intent == null ? null : intent.getStringExtra(EXTRA_DELIVERY_DISTANCE), "Distance pending");
    }

    public static Double deliveryLat(Intent intent) {
        return doubleExtra(intent, EXTRA_DELIVERY_LAT);
    }

    public static Double deliveryLng(Intent intent) {
        return doubleExtra(intent, EXTRA_DELIVERY_LNG);
    }

    private static void show(Context context, String orderId, String deliveryAddress, String payout, String distance) {
        if (orderId == null || orderId.trim().isEmpty()) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            Log.i(TAG, "Notification permission not granted; dropping order alert notification.");
            return;
        }

        NotificationChannels.ensure(context);
        Intent intent = new Intent(context, MainActivity.class)
                .setAction("OPEN_ORDER")
                .setData(Uri.parse("rider://orders/" + Uri.encode(orderId)))
                .putExtra(MainActivity.EXTRA_ORDER_ID, orderId)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                orderId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, NotificationChannels.ORDERS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("New delivery available")
                .setContentText(deliveryAddress + " - " + payout)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(deliveryAddress + "\n" + payout + " - " + distance))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(context).notify(orderId.hashCode(), notification.build());
    }

    private static String dedupeKey(String orderId, String createdAt) {
        if (orderId == null || orderId.trim().isEmpty()) {
            return null;
        }
        return orderId + ":" + valueOrFallback(createdAt, "");
    }

    private static void put(Intent intent, String key, String value) {
        if (value != null) {
            intent.putExtra(key, value);
        }
    }

    private static String valueOrFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static String orderValue(Map<String, String> data) {
        if (data == null) {
            return "Order value available";
        }
        return valueOrFallback(data.get(EXTRA_ORDER_TOTAL), valueOrFallback(data.get(EXTRA_ESTIMATED_PAYOUT), "Order value available"));
    }

    private static Double doubleExtra(Intent intent, String key) {
        if (intent == null) {
            return null;
        }
        String value = intent.getStringExtra(key);
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
