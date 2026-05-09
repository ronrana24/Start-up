package com.startup.rider.location;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

public final class LocationRetryStore {
    private static final String PREFS = "location_retry_queue";
    private static final String QUEUE = "queue";
    private static final int MAX_PENDING = 120;
    private static final Type LIST_TYPE = new TypeToken<List<LocationUpload>>() {
    }.getType();

    private final SharedPreferences prefs;
    private final Gson gson = new Gson();

    public LocationRetryStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized void enqueue(LocationUpload upload) {
        List<LocationUpload> items = snapshot();
        items.add(upload);
        while (items.size() > MAX_PENDING) {
            items.remove(0);
        }
        save(items);
    }

    public synchronized List<LocationUpload> drain() {
        List<LocationUpload> items = snapshot();
        save(new ArrayList<>());
        return items;
    }

    public synchronized List<LocationUpload> snapshot() {
        String raw = prefs.getString(QUEUE, "[]");
        try {
            List<LocationUpload> items = gson.fromJson(raw, LIST_TYPE);
            return items == null ? new ArrayList<>() : new ArrayList<>(items);
        } catch (RuntimeException ignored) {
            return new ArrayList<>();
        }
    }

    private void save(List<LocationUpload> items) {
        prefs.edit().putString(QUEUE, gson.toJson(items)).apply();
    }

    public static final class LocationUpload {
        public final double lat;
        public final double lng;
        public final Float heading;
        public final long capturedAtMillis;

        public LocationUpload(double lat, double lng, Float heading, long capturedAtMillis) {
            this.lat = lat;
            this.lng = lng;
            this.heading = heading;
            this.capturedAtMillis = capturedAtMillis;
        }
    }
}
