package com.startup.rider.location;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.startup.rider.AppConfig;
import com.startup.rider.MainActivity;
import com.startup.rider.R;
import com.startup.rider.RiderApplication;
import com.startup.rider.data.Dtos;
import com.startup.rider.data.RiderRepository;
import com.startup.rider.notifications.NotificationChannels;

import java.util.List;

public final class RiderLocationService extends Service {
    private static final String TAG = "RiderLocationService";
    private static final int NOTIFICATION_ID = 4201;

    private FusedLocationProviderClient fusedLocation;
    private LocationRetryStore retryStore;
    private RiderRepository repository;
    private LocationCallback locationCallback;

    public static void start(Context context) {
        Intent intent = new Intent(context, RiderLocationService.class);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, RiderLocationService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocation = LocationServices.getFusedLocationProviderClient(this);
        retryStore = new LocationRetryStore(this);
        repository = RiderApplication.container(this).riderRepository();
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                Location location = result.getLastLocation();
                if (location != null) {
                    upload(location);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, trackingNotification());
        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission missing; foreground tracking service stopped.");
            stopSelf();
            return START_NOT_STICKY;
        }
        requestLocationUpdates();
        flushQueue();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        fusedLocation.removeLocationUpdates(locationCallback);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void requestLocationUpdates() {
        LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY,
                AppConfig.LOCATION_INTERVAL_SECONDS * 1000L
        )
                .setMinUpdateDistanceMeters(AppConfig.LOCATION_MIN_DISTANCE_METERS)
                .setWaitForAccurateLocation(false)
                .build();
        try {
            fusedLocation.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
        } catch (SecurityException error) {
            Log.w(TAG, "Location permission revoked while requesting updates.", error);
            stopSelf();
        }
    }

    private void upload(Location location) {
        Float heading = location.hasBearing() ? location.getBearing() : null;
        LocationRetryStore.LocationUpload upload = new LocationRetryStore.LocationUpload(
                location.getLatitude(),
                location.getLongitude(),
                heading,
                System.currentTimeMillis()
        );
        repository.patchLocation(upload.lat, upload.lng, upload.heading, new RiderRepository.Result<Dtos.RiderDto>() {
            @Override
            public void onSuccess(Dtos.RiderDto value) {
                flushQueue();
            }

            @Override
            public void onError(RiderRepository.ApiFailure failure) {
                retryStore.enqueue(upload);
            }
        });
    }

    private void flushQueue() {
        List<LocationRetryStore.LocationUpload> pending = retryStore.drain();
        for (LocationRetryStore.LocationUpload upload : pending) {
            repository.patchLocation(upload.lat, upload.lng, upload.heading, new RiderRepository.Result<Dtos.RiderDto>() {
                @Override
                public void onSuccess(Dtos.RiderDto value) {
                }

                @Override
                public void onError(RiderRepository.ApiFailure failure) {
                    retryStore.enqueue(upload);
                }
            });
        }
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private Notification trackingNotification() {
        Intent intent = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                1,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, NotificationChannels.TRACKING)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(getString(R.string.tracking_notification_title))
                .setContentText(getString(R.string.tracking_notification_body))
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .build();
    }
}
