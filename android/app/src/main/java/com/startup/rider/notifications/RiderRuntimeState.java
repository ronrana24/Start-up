package com.startup.rider.notifications;

import android.content.Context;
import android.content.SharedPreferences;

public final class RiderRuntimeState {
    private static final String PREFS = "rider_runtime_state";
    private static final String KEY_FOREGROUND = "foreground";
    private static final String KEY_IDLE = "idle";

    private RiderRuntimeState() {
    }

    public static void set(Context context, boolean foreground, boolean idle) {
        prefs(context).edit()
                .putBoolean(KEY_FOREGROUND, foreground)
                .putBoolean(KEY_IDLE, idle)
                .apply();
    }

    public static void setForeground(Context context, boolean foreground) {
        prefs(context).edit().putBoolean(KEY_FOREGROUND, foreground).apply();
    }

    public static void setIdle(Context context, boolean idle) {
        prefs(context).edit().putBoolean(KEY_IDLE, idle).apply();
    }

    public static boolean isForegroundIdle(Context context) {
        SharedPreferences prefs = prefs(context);
        return prefs.getBoolean(KEY_FOREGROUND, false) && prefs.getBoolean(KEY_IDLE, false);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
