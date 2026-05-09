package com.startup.rider.notifications;

import android.content.Context;
import android.content.SharedPreferences;

public final class NotificationDeduper {
    private static final String PREFS = "notification_dedupe";
    private static final long TTL_MS = 15 * 60 * 1000L;

    private final SharedPreferences prefs;

    public NotificationDeduper(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean shouldShow(String key) {
        if (key == null || key.trim().isEmpty()) {
            return true;
        }
        long now = System.currentTimeMillis();
        long previous = prefs.getLong(key, 0L);
        if (previous > 0L && now - previous < TTL_MS) {
            return false;
        }
        prefs.edit().putLong(key, now).apply();
        return true;
    }
}
