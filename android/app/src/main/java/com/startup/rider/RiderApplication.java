package com.startup.rider;

import android.app.Application;
import android.text.TextUtils;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.startup.rider.notifications.NotificationChannels;

public final class RiderApplication extends Application {
    private static final String TAG = "RiderApplication";
    private AppContainer container;

    public static AppContainer container(android.content.Context context) {
        RiderApplication app = (RiderApplication) context.getApplicationContext();
        return app.container;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        container = new AppContainer(this);
        NotificationChannels.ensure(this);
        initializeFirebaseIfConfigured();
    }

    private void initializeFirebaseIfConfigured() {
        if (!FirebaseApp.getApps(this).isEmpty()) {
            return;
        }

        String appId = getString(R.string.firebase_application_id).trim();
        String apiKey = getString(R.string.firebase_api_key).trim();
        String projectId = getString(R.string.firebase_project_id).trim();
        String senderId = getString(R.string.firebase_sender_id).trim();
        if (TextUtils.isEmpty(appId) || TextUtils.isEmpty(apiKey) || TextUtils.isEmpty(projectId) || TextUtils.isEmpty(senderId)) {
            Log.i(TAG, "Firebase client values are not configured; FCM token registration is disabled.");
            return;
        }

        FirebaseOptions options = new FirebaseOptions.Builder()
                .setApplicationId(appId)
                .setApiKey(apiKey)
                .setProjectId(projectId)
                .setGcmSenderId(senderId)
                .build();
        FirebaseApp.initializeApp(this, options);
    }
}
