package com.startup.rider.notifications;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.startup.rider.R;

public final class NotificationChannels {
    public static final String ORDERS = "orders";
    public static final String TRACKING = "tracking";

    private NotificationChannels() {
    }

    public static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        Uri sound = Settings.System.DEFAULT_NOTIFICATION_URI;
        AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel orders = new NotificationChannel(
                ORDERS,
                context.getString(R.string.notification_channel_orders),
                NotificationManager.IMPORTANCE_HIGH
        );
        orders.setDescription("Instant alerts for newly available delivery orders.");
        orders.enableVibration(true);
        orders.setSound(sound, audio);

        NotificationChannel tracking = new NotificationChannel(
                TRACKING,
                context.getString(R.string.notification_channel_tracking),
                NotificationManager.IMPORTANCE_LOW
        );
        tracking.setDescription("Foreground service notification for active delivery GPS sharing.");

        manager.createNotificationChannel(orders);
        manager.createNotificationChannel(tracking);
    }
}
