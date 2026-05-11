package com.startup.rider.realtime;

import android.util.Log;

import com.startup.rider.AppConfig;
import com.google.gson.Gson;
import com.startup.rider.data.Dtos;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.UnsupportedEncodingException;
import java.net.URISyntaxException;
import java.net.URLEncoder;

import io.socket.client.Ack;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.engineio.client.transports.WebSocket;

public final class DeliverySocketManager {
    private static final String TAG = "DeliverySocketManager";
    private final Gson gson = new Gson();
    private Socket socket;
    private Events events;

    public void setEvents(Events events) {
        this.events = events;
    }

    public void connect(String accessToken) {
        if (accessToken == null || accessToken.trim().isEmpty()) {
            return;
        }
        if (socket != null && socket.connected()) {
            return;
        }
        disconnect();

        try {
            IO.Options options = new IO.Options();
            options.transports = new String[]{WebSocket.NAME};
            options.reconnection = true;
            options.reconnectionAttempts = Integer.MAX_VALUE;
            options.reconnectionDelay = 1_000;
            options.reconnectionDelayMax = 30_000;
            options.timeout = 20_000;
            options.forceNew = true;
            socket = IO.socket(AppConfig.deliverySocketUrl() + "?token=" + encode(accessToken), options);
            bind(socket);
            socket.connect();
            emitState("connecting");
        } catch (URISyntaxException error) {
            Log.w(TAG, "Invalid delivery socket URL", error);
            emitState("socket_config_error");
        }
    }

    private String encode(String accessToken) {
        try {
            return URLEncoder.encode(accessToken, "UTF-8");
        } catch (UnsupportedEncodingException error) {
            return accessToken;
        }
    }

    public void subscribeOrder(String orderId) {
        if (socket == null || orderId == null || orderId.trim().isEmpty()) {
            return;
        }
        try {
            JSONObject payload = new JSONObject().put("orderId", orderId);
            socket.emit("order:subscribe", payload, (Ack) args -> Log.d(TAG, "Subscribed order " + orderId));
        } catch (JSONException error) {
            Log.w(TAG, "Could not subscribe to order", error);
        }
    }

    public void disconnect() {
        if (socket == null) {
            return;
        }
        socket.off();
        socket.disconnect();
        socket.close();
        socket = null;
        emitState("disconnected");
    }

    private void bind(Socket boundSocket) {
        boundSocket.on(Socket.EVENT_CONNECT, args -> emitState("connected"));
        boundSocket.on(Socket.EVENT_DISCONNECT, args -> emitState("disconnected"));
        boundSocket.on(Socket.EVENT_CONNECT_ERROR, args -> emitState("connection_error"));
        boundSocket.on("available-orders.changed", args -> {
            if (events != null) events.onAvailableOrdersChanged();
        });
        boundSocket.on("order.created", this::emitAvailableOrder);
        boundSocket.on("order.available", this::emitAvailableOrder);
        boundSocket.on("order.assigned", args -> {
            if (events != null) events.onOrderChanged();
        });
        boundSocket.on("order.updated", args -> {
            if (events != null) events.onOrderChanged();
        });
        boundSocket.on("order.status_changed", args -> {
            if (events != null) events.onOrderChanged();
        });
        boundSocket.on("rider.location_updated", args -> {
            if (events != null) events.onOrderChanged();
        });
        boundSocket.on("rider.availability_changed", args -> {
            if (events != null) events.onOrderChanged();
        });
    }

    private void emitState(String state) {
        if (events != null) {
            events.onConnectionState(state);
        }
    }

    private void emitAvailableOrder(Object... args) {
        if (events == null) {
            return;
        }
        events.onAvailableOrdersChanged();
        Dtos.OrderDto order = parseOrder(args);
        if (order != null && order.id != null && !order.id.trim().isEmpty()) {
            events.onNewAvailableOrder(order);
        }
    }

    private Dtos.OrderDto parseOrder(Object[] args) {
        if (args == null || args.length == 0 || args[0] == null) {
            return null;
        }
        try {
            return gson.fromJson(args[0].toString(), Dtos.OrderDto.class);
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not parse available order payload", error);
            return null;
        }
    }

    public interface Events {
        void onAvailableOrdersChanged();

        void onNewAvailableOrder(Dtos.OrderDto order);

        void onOrderChanged();

        void onConnectionState(String state);
    }
}
