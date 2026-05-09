package com.startup.rider.data;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class Dtos {
    private static final NumberFormat INR = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMM, h:mm a").withZone(ZoneId.systemDefault());

    private Dtos() {
    }

    public static final class Envelope<T> {
        public T data;
    }

    public static final class Page<T> {
        public List<T> items = new ArrayList<>();
        public int total;
        public int page;
        public int pageSize;
    }

    public static final class SendOtpRequest {
        public final String phone;

        public SendOtpRequest(String phone) {
            this.phone = phone;
        }
    }

    public static final class VerifyOtpRequest {
        public final String phone;
        public final String code;

        public VerifyOtpRequest(String phone, String code) {
            this.phone = phone;
            this.code = code;
        }
    }

    public static final class RegisterDeviceRequest {
        public final String pushToken;
        public final String platform = "android";

        public RegisterDeviceRequest(String pushToken) {
            this.pushToken = pushToken;
        }
    }

    public static final class PatchStatusRequest {
        public final String status;

        public PatchStatusRequest(String status) {
            this.status = status;
        }
    }

    public static final class PatchLocationRequest {
        public final double lat;
        public final double lng;
        public final Float heading;

        public PatchLocationRequest(double lat, double lng, Float heading) {
            this.lat = lat;
            this.lng = lng;
            this.heading = heading;
        }
    }

    public static final class OtpResponse {
        public int expiresInSeconds;
    }

    public static final class AuthPayload {
        public String accessToken;
        public UserDto user;
        public RiderDto rider;
    }

    public static final class UserDto {
        public String id;
        public String phone;
        public String email;
        public String name;
        public String businessName;
        public String role;
        public boolean isOnboardingCompleted;
    }

    public static final class RiderDto {
        public String id;
        public String name;
        public String phone;
        public String status;
        public JsonElement currentLocation;
    }

    public static final class ProductDto {
        public String id;
        public String name;
        public String category;
        public String unit;
    }

    public static final class OrderItemDto {
        public String productId;
        public int quantity;
        public String priceApplied;
        public ProductDto product;
    }

    public static final class OrderDto {
        public String id;
        public String userId;
        public String status;
        public String deliveryType;
        public String deliveryFee;
        public String subtotalAmount;
        public String totalAmount;
        public JsonElement addressSnapshot;
        public RiderDto rider;
        public String createdAt;
        public String updatedAt;
        public List<OrderItemDto> items = new ArrayList<>();
    }

    public static final class Coordinates {
        public final double lat;
        public final double lng;

        public Coordinates(double lat, double lng) {
            this.lat = lat;
            this.lng = lng;
        }
    }

    public static String shortOrderId(OrderDto order) {
        if (order == null || order.id == null) {
            return "";
        }
        return order.id.length() <= 8 ? order.id : order.id.substring(0, 8);
    }

    public static String deliveryAddress(OrderDto order) {
        return addressLabel(order == null ? null : order.addressSnapshot);
    }

    public static String addressLabel(JsonElement value) {
        JsonObject object = object(value);
        if (object == null) {
            return "Delivery address";
        }
        List<String> parts = new ArrayList<>();
        addIfPresent(parts, object, "line1");
        addIfPresent(parts, object, "line2");
        String city = string(object, "city");
        String state = string(object, "state");
        String pincode = string(object, "pincode");
        String tail = joinNonEmpty(", ", city, state, pincode);
        if (!tail.isEmpty()) {
            parts.add(tail);
        }
        return parts.isEmpty() ? "Delivery address" : joinNonEmpty(" - ", parts.toArray(new String[0]));
    }

    public static Coordinates coordinates(JsonElement value) {
        JsonObject object = object(value);
        if (object == null) {
            return null;
        }
        JsonObject nested = object(object.get("coordinates"));
        JsonObject source = nested == null ? object : nested;
        Double lat = number(source, "lat", "latitude");
        Double lng = number(source, "lng", "longitude");
        if (lat == null || lng == null) {
            return null;
        }
        return new Coordinates(lat, lng);
    }

    public static String payout(OrderDto order) {
        return money(order == null ? null : order.deliveryFee);
    }

    public static String total(OrderDto order) {
        return money(order == null ? null : order.totalAmount);
    }

    public static String createdAtLabel(OrderDto order) {
        if (order == null || order.createdAt == null) {
            return "";
        }
        try {
            return TIME_FORMATTER.format(Instant.parse(order.createdAt));
        } catch (RuntimeException ignored) {
            return order.createdAt;
        }
    }

    public static String timeSinceCreated(OrderDto order) {
        if (order == null || order.createdAt == null) {
            return "";
        }
        try {
            long seconds = Math.max(0, Instant.now().getEpochSecond() - Instant.parse(order.createdAt).getEpochSecond());
            long minutes = seconds / 60;
            if (minutes < 1) {
                return "Just now";
            }
            if (minutes < 60) {
                return minutes + " min ago";
            }
            long hours = minutes / 60;
            if (hours < 24) {
                return hours + " hr ago";
            }
            return (hours / 24) + " days ago";
        } catch (RuntimeException ignored) {
            return createdAtLabel(order);
        }
    }

    public static boolean isTerminal(OrderDto order) {
        return order != null && ("DELIVERED".equals(order.status) || "CANCELLED".equals(order.status));
    }

    public static String nextRiderStatus(OrderDto order) {
        if (order == null || order.status == null) {
            return null;
        }
        switch (order.status) {
            case "RIDER_ASSIGNED":
                return "PICKED_UP";
            case "PICKED_UP":
                return "OUT_FOR_DELIVERY";
            case "OUT_FOR_DELIVERY":
                return "DELIVERED";
            default:
                return null;
        }
    }

    public static String statusLabel(String status) {
        if (status == null) {
            return "Unknown";
        }
        return status.replace('_', ' ').toLowerCase(Locale.US);
    }

    private static String money(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "₹0";
        }
        try {
            return INR.format(Double.parseDouble(value));
        } catch (NumberFormatException ignored) {
            return value;
        }
    }

    private static void addIfPresent(List<String> parts, JsonObject object, String key) {
        String value = string(object, key);
        if (!value.isEmpty()) {
            parts.add(value);
        }
    }

    private static String string(JsonObject object, String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return "";
        }
        try {
            return object.get(key).getAsString().trim();
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    private static Double number(JsonObject object, String primary, String fallback) {
        Double value = number(object, primary);
        return value == null ? number(object, fallback) : value;
    }

    private static Double number(JsonObject object, String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return null;
        }
        try {
            return object.get(key).getAsDouble();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static JsonObject object(JsonElement value) {
        if (value == null || value.isJsonNull() || !value.isJsonObject()) {
            return null;
        }
        return value.getAsJsonObject();
    }

    private static String joinNonEmpty(String separator, String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                parts.add(value.trim());
            }
        }
        return String.join(separator, parts);
    }
}
