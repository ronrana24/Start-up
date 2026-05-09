package com.startup.rider;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.location.Location;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.startup.rider.data.Dtos;
import com.startup.rider.data.RiderRepository;
import com.startup.rider.data.SecureSessionStore;
import com.startup.rider.location.RiderLocationService;
import com.startup.rider.realtime.DeliverySocketManager;
import com.startup.rider.ui.Ui;

import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends AppCompatActivity {
    public static final String EXTRA_ORDER_ID = "orderId";
    private static final int REQ_FINE_LOCATION = 1001;
    private static final int REQ_BACKGROUND_LOCATION = 1002;
    private static final int REQ_NOTIFICATIONS = 1003;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoRefresh = new Runnable() {
        @Override
        public void run() {
            if (resumed && sessionStore != null && sessionStore.isLoggedIn()) {
                refreshData(false);
                handler.postDelayed(this, AppConfig.AUTO_REFRESH_MS);
            }
        }
    };

    private AppContainer container;
    private RiderRepository repository;
    private SecureSessionStore sessionStore;
    private DeliverySocketManager socketManager;
    private FusedLocationProviderClient fusedLocation;
    private LinearLayout content;
    private Dtos.RiderDto rider;
    private Dtos.OrderDto activeOrder;
    private Dtos.Page<Dtos.OrderDto> availableOrders;
    private int availablePage = 1;
    private String socketState = "disconnected";
    private String targetOrderId;
    private String lastError;
    private boolean resumed;
    private boolean locationSnapshotInFlight;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle("Rider Delivery");
        container = RiderApplication.container(this);
        repository = container.riderRepository();
        sessionStore = container.sessionStore();
        socketManager = container.deliverySocketManager();
        fusedLocation = LocationServices.getFusedLocationProviderClient(this);
        targetOrderId = orderIdFromIntent(getIntent());

        if (sessionStore.isLoggedIn()) {
            bootstrapSession();
        } else {
            showLogin();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        targetOrderId = orderIdFromIntent(intent);
        if (sessionStore != null && sessionStore.isLoggedIn()) {
            refreshData(true);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        resumed = true;
        handler.removeCallbacks(autoRefresh);
        handler.postDelayed(autoRefresh, AppConfig.AUTO_REFRESH_MS);
    }

    @Override
    protected void onStop() {
        resumed = false;
        handler.removeCallbacks(autoRefresh);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) {
            socketManager.disconnect();
        }
        super.onDestroy();
    }

    private void showLogin() {
        socketManager.disconnect();
        RiderLocationService.stop(this);

        LinearLayout root = Ui.vertical(this);
        root.setPadding(Ui.dp(this, 20), Ui.dp(this, 24), Ui.dp(this, 20), Ui.dp(this, 24));

        TextView title = Ui.text(this, "Rider sign in", 26, Typeface.BOLD);
        TextView body = Ui.text(this, "Use the phone number registered for your rider profile. OTP auth is shared with the existing backend.", 14, Typeface.NORMAL);
        EditText phone = new EditText(this);
        phone.setHint("+91 mobile number");
        phone.setInputType(InputType.TYPE_CLASS_PHONE);
        phone.setSingleLine(true);
        EditText otp = new EditText(this);
        otp.setHint("6 digit OTP");
        otp.setInputType(InputType.TYPE_CLASS_NUMBER);
        otp.setSingleLine(true);
        MaterialButton send = Ui.button(this, "Send OTP");
        MaterialButton verify = Ui.button(this, "Verify and start");
        TextView status = Ui.text(this, "", 13, Typeface.NORMAL);

        send.setOnClickListener(v -> {
            status.setText("Sending OTP...");
            repository.sendOtp(phone.getText().toString(), new UiResult<Dtos.OtpResponse>() {
                @Override
                public void success(Dtos.OtpResponse value) {
                    int seconds = value == null ? 0 : value.expiresInSeconds;
                    status.setText("OTP sent. Expires in " + seconds + " seconds.");
                }

                @Override
                public void error(RiderRepository.ApiFailure failure) {
                    status.setText(failure.message);
                }
            });
        });

        verify.setOnClickListener(v -> {
            status.setText("Verifying...");
            repository.verifyOtp(
                    phone.getText().toString(),
                    otp.getText().toString(),
                    new UiResult<Dtos.AuthPayload>() {
                        @Override
                        public void success(Dtos.AuthPayload value) {
                            rider = value == null ? null : value.rider;
                            registerPushToken();
                            showMain();
                            publishCurrentLocationSnapshot();
                            refreshData(true);
                        }

                        @Override
                        public void error(RiderRepository.ApiFailure failure) {
                            status.setText(failure.message);
                        }
                    }
            );
        });

        root.addView(title);
        Ui.gap(root, 8);
        root.addView(body);
        Ui.gap(root, 20);
        root.addView(phone);
        root.addView(otp);
        Ui.gap(root, 12);
        root.addView(send);
        root.addView(verify);
        Ui.gap(root, 8);
        root.addView(status);
        setContentView(wrap(root));
    }

    private void bootstrapSession() {
        repository.bootstrap(new UiResult<Dtos.RiderDto>() {
            @Override
            public void success(Dtos.RiderDto value) {
                rider = value;
                registerPushToken();
                showMain();
                publishCurrentLocationSnapshot();
                refreshData(true);
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                if (failure.unauthorized) {
                    sessionStore.clear();
                    showLogin();
                    return;
                }
                lastError = failure.message;
                rider = sessionStore.rider();
                showMain();
                refreshData(true);
            }
        });
    }

    private void showMain() {
        ScrollView scrollView = new ScrollView(this);
        content = Ui.vertical(this);
        content.setPadding(Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 28));
        scrollView.addView(content);
        setContentView(scrollView);
        connectSocket();
        render();
    }

    private void render() {
        if (content == null) {
            return;
        }
        content.removeAllViews();
        content.addView(header());
        Ui.gap(content, 10);
        content.addView(permissionCard());
        Ui.gap(content, 10);
        if (activeOrder != null && !Dtos.isTerminal(activeOrder)) {
            content.addView(activeOrderCard(activeOrder));
            Ui.gap(content, 10);
        }
        content.addView(availableOrdersCard());
        Ui.gap(content, 10);
        content.addView(actionsCard());
    }

    private View header() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        body.addView(Ui.text(this, localRider == null ? "Rider dashboard" : localRider.name, 22, Typeface.BOLD));
        body.addView(Ui.text(this, "API " + AppConfig.API_BASE_URL, 12, Typeface.NORMAL));
        body.addView(Ui.text(this, "Socket " + socketState, 12, Typeface.NORMAL));
        if (localRider != null) {
            Dtos.Coordinates current = Dtos.coordinates(localRider.currentLocation);
            body.addView(Ui.text(
                    this,
                    current == null
                            ? "Location not uploaded yet"
                            : "Location " + current.lat + ", " + current.lng,
                    12,
                    Typeface.NORMAL
            ));
        }
        if (lastError != null) {
            TextView error = Ui.text(this, lastError, 13, Typeface.BOLD);
            body.addView(error);
        }
        card.addView(body);
        return card;
    }

    private View permissionCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Runtime readiness", 17, Typeface.BOLD));
        body.addView(Ui.text(this, permissionSummary(), 13, Typeface.NORMAL));
        Ui.gap(body, 8);

        LinearLayout buttons = Ui.vertical(this);
        if (!hasFineLocationPermission()) {
            MaterialButton button = Ui.button(this, "Allow location");
            button.setOnClickListener(v -> requestFineLocation());
            buttons.addView(button);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
            MaterialButton button = Ui.button(this, "Allow background location");
            button.setOnClickListener(v -> requestBackgroundLocation());
            buttons.addView(button);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission()) {
            MaterialButton button = Ui.button(this, "Allow notifications");
            button.setOnClickListener(v -> requestNotifications());
            buttons.addView(button);
        }
        if (!isIgnoringBatteryOptimizations()) {
            MaterialButton button = Ui.button(this, "Allow battery exemption");
            button.setOnClickListener(v -> requestBatteryExemption());
            buttons.addView(button);
        }
        if (buttons.getChildCount() == 0) {
            body.addView(Ui.text(this, "Location, push, and background tracking are ready.", 13, Typeface.NORMAL));
        } else {
            body.addView(buttons);
        }
        card.addView(body);
        return card;
    }

    private View activeOrderCard(Dtos.OrderDto order) {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Active delivery #" + Dtos.shortOrderId(order), 18, Typeface.BOLD));
        body.addView(Ui.text(this, "Status: " + Dtos.statusLabel(order.status), 13, Typeface.NORMAL));
        body.addView(Ui.text(this, "Drop: " + Dtos.deliveryAddress(order), 14, Typeface.NORMAL));
        body.addView(Ui.text(this, "Payout: " + Dtos.payout(order), 14, Typeface.BOLD));
        Ui.gap(body, 8);

        MaterialButton dropNav = Ui.button(this, "Navigate to drop");
        dropNav.setOnClickListener(v -> openNavigation(Dtos.deliveryAddress(order)));
        body.addView(dropNav);

        MaterialButton preview = Ui.button(this, "Preview route");
        preview.setOnClickListener(v -> openRoutePreview(order));
        body.addView(preview);

        String next = Dtos.nextRiderStatus(order);
        if (next != null) {
            MaterialButton transition = Ui.button(this, "Mark " + Dtos.statusLabel(next));
            transition.setOnClickListener(v -> patchStatus(order, next));
            body.addView(transition);
        }
        card.addView(body);
        return card;
    }

    private View availableOrdersCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        int total = availableOrders == null ? 0 : availableOrders.total;
        body.addView(Ui.text(this, "Available orders (" + total + ")", 18, Typeface.BOLD));

        List<Dtos.OrderDto> items = availableOrders == null || availableOrders.items == null
                ? new ArrayList<>()
                : availableOrders.items;
        if (items.isEmpty()) {
            body.addView(Ui.text(this, "No unassigned orders right now. The list refreshes from sockets, FCM, and periodic fallback refresh.", 13, Typeface.NORMAL));
        } else {
            for (Dtos.OrderDto order : items) {
                Ui.gap(body, 8);
                body.addView(availableOrderRow(order));
            }
        }

        Ui.gap(body, 10);
        LinearLayout pager = Ui.horizontal(this);
        pager.setGravity(Gravity.CENTER_VERTICAL);
        MaterialButton previous = Ui.button(this, "Previous");
        previous.setEnabled(availablePage > 1);
        previous.setOnClickListener(v -> {
            availablePage = Math.max(1, availablePage - 1);
            refreshAvailableOrders(true);
        });
        MaterialButton next = Ui.button(this, "Next");
        boolean hasNext = availableOrders != null && availableOrders.page * availableOrders.pageSize < availableOrders.total;
        next.setEnabled(hasNext);
        next.setOnClickListener(v -> {
            availablePage += 1;
            refreshAvailableOrders(true);
        });
        pager.addView(previous);
        pager.addView(next);
        body.addView(pager);
        card.addView(body);
        return card;
    }

    private View availableOrderRow(Dtos.OrderDto order) {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "#" + Dtos.shortOrderId(order) + " - " + Dtos.statusLabel(order.deliveryType), 15, Typeface.BOLD));
        body.addView(Ui.text(this, Dtos.deliveryAddress(order), 13, Typeface.NORMAL));
        body.addView(Ui.text(this, Dtos.payout(order) + " - " + Dtos.timeSinceCreated(order), 13, Typeface.BOLD));
        MaterialButton accept = Ui.button(this, "Accept order");
        accept.setOnClickListener(v -> claimOrder(order));
        body.addView(accept);
        card.addView(body);
        return card;
    }

    private View actionsCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        MaterialButton refresh = Ui.button(this, "Refresh");
        refresh.setOnClickListener(v -> refreshData(true));
        MaterialButton updateLocation = Ui.button(this, "Update my location");
        updateLocation.setOnClickListener(v -> publishCurrentLocationSnapshot());
        MaterialButton logout = Ui.button(this, "Logout");
        logout.setOnClickListener(v -> repository.logout(new UiResult<Object>() {
            @Override
            public void success(Object value) {
                showLogin();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                showLogin();
            }
        }));
        body.addView(refresh);
        body.addView(updateLocation);
        body.addView(logout);
        card.addView(body);
        return card;
    }

    private void refreshData(boolean visible) {
        if (visible) {
            lastError = "Refreshing...";
            render();
        }
        refreshActiveOrder();
        refreshAvailableOrders(false);
    }

    private void refreshActiveOrder() {
        repository.activeOrder(new UiResult<Dtos.OrderDto>() {
            @Override
            public void success(Dtos.OrderDto value) {
                activeOrder = value;
                lastError = null;
                if (activeOrder != null && !Dtos.isTerminal(activeOrder)) {
                    socketManager.subscribeOrder(activeOrder.id);
                    maybeStartTracking();
                } else {
                    RiderLocationService.stop(MainActivity.this);
                }
                render();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                lastError = failure.message;
                if (failure.unauthorized) showLogin();
                else render();
            }
        });
    }

    private void refreshAvailableOrders(boolean visible) {
        if (visible) {
            lastError = "Loading available orders...";
            render();
        }
        repository.availableOrders(availablePage, AppConfig.AVAILABLE_ORDERS_PAGE_SIZE, new UiResult<Dtos.Page<Dtos.OrderDto>>() {
            @Override
            public void success(Dtos.Page<Dtos.OrderDto> value) {
                availableOrders = value;
                lastError = null;
                render();
                focusTargetOrderIfNeeded();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                lastError = failure.message;
                if (failure.unauthorized) showLogin();
                else render();
            }
        });
    }

    private void claimOrder(Dtos.OrderDto order) {
        if (availableOrders != null && availableOrders.items != null) {
            availableOrders.items.remove(order);
            availableOrders.total = Math.max(0, availableOrders.total - 1);
            render();
        }
        repository.claimOrder(order.id, new UiResult<Dtos.OrderDto>() {
            @Override
            public void success(Dtos.OrderDto value) {
                activeOrder = value;
                Toast.makeText(MainActivity.this, "Order assigned", Toast.LENGTH_SHORT).show();
                socketManager.subscribeOrder(value.id);
                maybeStartTracking();
                refreshData(false);
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                Toast.makeText(MainActivity.this, failure.message, Toast.LENGTH_LONG).show();
                refreshData(true);
            }
        });
    }

    private void patchStatus(Dtos.OrderDto order, String nextStatus) {
        repository.patchDeliveryStatus(order.id, nextStatus, new UiResult<Dtos.OrderDto>() {
            @Override
            public void success(Dtos.OrderDto value) {
                activeOrder = value;
                if (Dtos.isTerminal(value)) {
                    RiderLocationService.stop(MainActivity.this);
                }
                refreshData(false);
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                Toast.makeText(MainActivity.this, failure.message, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void connectSocket() {
        socketManager.setEvents(new DeliverySocketManager.Events() {
            @Override
            public void onAvailableOrdersChanged() {
                runOnUiThread(() -> {
                    availablePage = 1;
                    refreshAvailableOrders(false);
                });
            }

            @Override
            public void onOrderChanged() {
                runOnUiThread(MainActivity.this::refreshActiveOrder);
            }

            @Override
            public void onConnectionState(String state) {
                runOnUiThread(() -> {
                    socketState = state;
                    render();
                });
            }
        });
        socketManager.connect(sessionStore.accessToken());
    }

    private void maybeStartTracking() {
        if (activeOrder == null || Dtos.isTerminal(activeOrder)) {
            RiderLocationService.stop(this);
            return;
        }
        if (hasFineLocationPermission()) {
            publishCurrentLocationSnapshot();
            RiderLocationService.start(this);
        }
    }

    private void publishCurrentLocationSnapshot() {
        if (sessionStore == null || !sessionStore.isLoggedIn()) {
            return;
        }
        if (!hasFineLocationPermission()) {
            lastError = "Allow location permission before updating rider location.";
            render();
            return;
        }
        if (locationSnapshotInFlight) {
            return;
        }
        locationSnapshotInFlight = true;

        CurrentLocationRequest request = new CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setDurationMillis(10_000)
                .setMaxUpdateAgeMillis(30_000)
                .build();
        CancellationTokenSource cancellation = new CancellationTokenSource();

        try {
            fusedLocation.getCurrentLocation(request, cancellation.getToken())
                    .addOnSuccessListener(location -> {
                        locationSnapshotInFlight = false;
                        if (location == null) {
                            lastError = "Location unavailable. On emulator, set a location from Extended controls > Location.";
                            render();
                            return;
                        }
                        uploadLocationSnapshot(location);
                    })
                    .addOnFailureListener(error -> {
                        locationSnapshotInFlight = false;
                        lastError = "Location unavailable: " + error.getMessage();
                        render();
                    });
        } catch (SecurityException error) {
            locationSnapshotInFlight = false;
            lastError = "Location permission is required to update rider location.";
            render();
        }
    }

    private void uploadLocationSnapshot(Location location) {
        Float heading = location.hasBearing() ? location.getBearing() : null;
        repository.patchLocation(
                location.getLatitude(),
                location.getLongitude(),
                heading,
                new UiResult<Dtos.RiderDto>() {
                    @Override
                    public void success(Dtos.RiderDto value) {
                        rider = value;
                        lastError = null;
                        render();
                    }

                    @Override
                    public void error(RiderRepository.ApiFailure failure) {
                        lastError = "Location upload failed: " + failure.message;
                        if (failure.unauthorized) showLogin();
                        else render();
                    }
                }
        );
    }

    private void registerPushToken() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            return;
        }
        FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(token -> repository.registerDevice(token, new RiderRepository.EmptyResult<>()))
                .addOnFailureListener(error -> lastError = "FCM token unavailable: " + error.getMessage());
    }

    private String permissionSummary() {
        List<String> missing = new ArrayList<>();
        if (!hasFineLocationPermission()) missing.add("fine location");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) missing.add("background location");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission()) missing.add("notifications");
        if (!isIgnoringBatteryOptimizations()) missing.add("battery exemption");
        if (missing.isEmpty()) {
            return "Ready for foreground alerts, background GPS tracking, and active-delivery sync.";
        }
        return "Needed for reliable delivery work: " + String.join(", ", missing) + ". The app keeps safe read-only order access when a permission is restricted.";
    }

    private boolean hasFineLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return true;
        }
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true;
        }
        return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isIgnoringBatteryOptimizations() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        return powerManager == null || powerManager.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void requestFineLocation() {
        ActivityCompat.requestPermissions(this, new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        }, REQ_FINE_LOCATION);
    }

    private void requestBackgroundLocation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, REQ_BACKGROUND_LOCATION);
        }
    }

    private void requestNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
        }
    }

    private void requestBatteryExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        render();
        if (requestCode == REQ_FINE_LOCATION && hasFineLocationPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
                requestBackgroundLocation();
            }
            publishCurrentLocationSnapshot();
            maybeStartTracking();
        }
    }

    private void openNavigation(String destination) {
        Uri uri = Uri.parse("google.navigation:q=" + Uri.encode(destination) + "&mode=d");
        Intent intent = new Intent(Intent.ACTION_VIEW, uri).setPackage("com.google.android.apps.maps");
        if (intent.resolveActivity(getPackageManager()) == null) {
            intent.setPackage(null);
        }
        startActivity(intent);
    }

    private void openRoutePreview(Dtos.OrderDto order) {
        Dtos.Coordinates drop = Dtos.coordinates(order.addressSnapshot);
        if (drop == null) {
            openNavigation(Dtos.deliveryAddress(order));
            return;
        }
        Dtos.Coordinates riderLocation = order.rider == null ? null : Dtos.coordinates(order.rider.currentLocation);
        Intent intent = new Intent(this, RoutePreviewActivity.class)
                .putExtra(RoutePreviewActivity.EXTRA_DEST_LAT, drop.lat)
                .putExtra(RoutePreviewActivity.EXTRA_DEST_LNG, drop.lng)
                .putExtra(RoutePreviewActivity.EXTRA_DEST_LABEL, Dtos.deliveryAddress(order));
        if (riderLocation != null) {
            intent.putExtra(RoutePreviewActivity.EXTRA_RIDER_LAT, riderLocation.lat);
            intent.putExtra(RoutePreviewActivity.EXTRA_RIDER_LNG, riderLocation.lng);
        }
        startActivity(intent);
    }

    private void focusTargetOrderIfNeeded() {
        if (targetOrderId == null || targetOrderId.trim().isEmpty()) {
            return;
        }
        if (activeOrder != null && targetOrderId.equals(activeOrder.id)) {
            Toast.makeText(this, "Opened active order " + Dtos.shortOrderId(activeOrder), Toast.LENGTH_SHORT).show();
            targetOrderId = null;
            return;
        }
        if (availableOrders != null && availableOrders.items != null) {
            for (Dtos.OrderDto order : availableOrders.items) {
                if (targetOrderId.equals(order.id)) {
                    Toast.makeText(this, "Order is available to claim", Toast.LENGTH_SHORT).show();
                    targetOrderId = null;
                    return;
                }
            }
        }
    }

    private ScrollView wrap(View view) {
        ScrollView scrollView = new ScrollView(this);
        scrollView.addView(view);
        return scrollView;
    }

    private String orderIdFromIntent(Intent intent) {
        if (intent == null) {
            return null;
        }
        String extra = intent.getStringExtra(EXTRA_ORDER_ID);
        if (extra != null && !extra.trim().isEmpty()) {
            return extra;
        }
        Uri data = intent.getData();
        if (data != null && data.getPathSegments().size() > 0) {
            return data.getPathSegments().get(0);
        }
        return null;
    }

    private abstract class UiResult<T> implements RiderRepository.Result<T> {
        @Override
        public final void onSuccess(T value) {
            runOnUiThread(() -> success(value));
        }

        @Override
        public final void onError(RiderRepository.ApiFailure failure) {
            runOnUiThread(() -> error(failure));
        }

        public abstract void success(T value);

        public abstract void error(RiderRepository.ApiFailure failure);
    }
}
