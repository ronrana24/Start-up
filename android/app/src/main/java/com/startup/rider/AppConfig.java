package com.startup.rider;

public final class AppConfig {
    public static final String API_BASE_URL = normalizeBaseUrl(BuildConfig.API_BASE_URL);
    public static final long LOCATION_INTERVAL_SECONDS = BuildConfig.LOCATION_INTERVAL_SECONDS;
    public static final float LOCATION_MIN_DISTANCE_METERS = BuildConfig.LOCATION_MIN_DISTANCE_METERS;
    public static final int AVAILABLE_ORDERS_PAGE_SIZE = 20;
    public static final long AUTO_REFRESH_MS = 30_000L;

    private AppConfig() {
    }

    public static String deliverySocketUrl() {
        return API_BASE_URL + "/delivery";
    }

    private static String normalizeBaseUrl(String raw) {
        String value = raw == null ? "" : raw.trim();
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }
}
