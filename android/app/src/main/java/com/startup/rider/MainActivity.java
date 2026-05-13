package com.startup.rider;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.location.Location;
import android.location.Address;
import android.location.Geocoder;
import android.location.LocationManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.widget.NestedScrollView;

import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.libraries.places.api.Places;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.widget.Autocomplete;
import com.google.android.libraries.places.widget.AutocompleteActivity;
import com.google.android.libraries.places.widget.model.AutocompleteActivityMode;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.gson.JsonObject;
import com.startup.rider.data.Dtos;
import com.startup.rider.data.RiderRepository;
import com.startup.rider.data.SecureSessionStore;
import com.startup.rider.location.RiderLocationService;
import com.startup.rider.notifications.NotificationDeduper;
import com.startup.rider.notifications.OrderAlertNotifier;
import com.startup.rider.notifications.RiderRuntimeState;
import com.startup.rider.realtime.DeliverySocketManager;
import com.startup.rider.ui.Ui;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.security.MessageDigest;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MainActivity extends AppCompatActivity {
    private static final String TAG = "MainActivity";
    public static final String EXTRA_ORDER_ID = "orderId";
    private static final int REQ_FINE_LOCATION = 1001;
    private static final int REQ_BACKGROUND_LOCATION = 1002;
    private static final int REQ_NOTIFICATIONS = 1003;
    private static final long OTP_RESEND_MS = 30_000L;
    private static final long RUNTIME_PROMPT_COOLDOWN_MS = 2_000L;
    private static final Pattern OTP_PATTERN = Pattern.compile("\\b(\\d{6})\\b");

    private enum AuthMode {
        PICK,
        GOOGLE_BUSY,
        GOOGLE_PHONE,
        GOOGLE_OTP,
        ONBOARDING_WELCOME,
        ONBOARDING_ADDRESS,
        ONBOARDING_SUCCESS
    }

    private enum MainTab {
        HOME,
        ORDERS,
        ALERTS,
        ACCOUNT
    }

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
    private final Runnable stopOrderAlertSoundRunnable = this::stopOrderAlertSound;

    private AppContainer container;
    private RiderRepository repository;
    private SecureSessionStore sessionStore;
    private DeliverySocketManager socketManager;
    private FusedLocationProviderClient fusedLocation;
    private GoogleSignInClient googleSignInClient;
    private ActivityResultLauncher<Intent> googleSignInLauncher;
    private ActivityResultLauncher<Intent> placesLauncher;
    private BroadcastReceiver smsReceiver;
    private BroadcastReceiver orderAvailableReceiver;
    private FrameLayout mainRoot;
    private NestedScrollView mainScroll;
    private LinearLayout content;
    private LinearLayout bottomNav;
    private AlertDialog orderAlertDialog;
    private Ringtone orderAlertRingtone;
    private Dtos.RiderDto rider;
    private Dtos.OrderDto activeOrder;
    private Dtos.Page<Dtos.OrderDto> availableOrders;
    private final List<Dtos.OrderDto> pushedOrderOffers = new ArrayList<>();
    private final Set<String> rejectedOfferIds = new HashSet<>();
    private int availablePage = 1;
    private String socketState = "disconnected";
    private String targetOrderId;
    private String lastError;
    private boolean resumed;
    private boolean locationSnapshotInFlight;
    private AuthMode authMode = AuthMode.PICK;
    private MainTab activeMainTab = MainTab.HOME;
    private boolean authBusy;
    private String authError;
    private String authStatus;
    private String googleRegistrationToken;
    private String googleEmail;
    private String googleName;
    private String googlePicture;
    private String phoneNational = "";
    private String phoneE164 = "";
    private String otpCode = "";
    private long resendAvailableAtMs;
    private MaterialButton otpResendButton;
    private Dtos.AddressDraft addressDraft = new Dtos.AddressDraft();
    private boolean onboardingSaving;
    private boolean pendingOnboardingLocationRequest;
    private boolean runtimeAccessPromptActive;
    private long lastRuntimePromptAtMs;

    private final Runnable otpTicker = new Runnable() {
        @Override
        public void run() {
            if (authMode == AuthMode.GOOGLE_OTP) {
                updateOtpResendButton();
                if (remainingResendMs() > 0) {
                    handler.postDelayed(this, 1000L);
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.PRIMARY_DARK);
        getWindow().setNavigationBarColor(Ui.PAGE);
        registerAuthActivityLaunchers();
        container = RiderApplication.container(this);
        repository = container.riderRepository();
        sessionStore = container.sessionStore();
        socketManager = container.deliverySocketManager();
        fusedLocation = LocationServices.getFusedLocationProviderClient(this);
        addressDraft = sessionStore.onboardingAddressDraft();
        configureGoogleSignIn();
        initializePlacesIfConfigured();
        targetOrderId = orderIdFromIntent(getIntent());

        if (sessionStore.isLoggedIn()) {
            resumeLoggedInSession();
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
            if (targetOrderId != null && !targetOrderId.trim().isEmpty()) {
                activeMainTab = MainTab.HOME;
            }
            refreshData(true);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        resumed = true;
        registerOrderAvailableReceiver();
        updateRiderRuntimeState();
        handler.removeCallbacks(autoRefresh);
        handler.postDelayed(autoRefresh, AppConfig.AUTO_REFRESH_MS);
        handler.postDelayed(this::promptRequiredRuntimeAccess, 500L);
    }

    @Override
    protected void onStop() {
        resumed = false;
        RiderRuntimeState.setForeground(this, false);
        unregisterOrderAvailableReceiver();
        stopOrderAlertSound();
        handler.removeCallbacks(autoRefresh);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) {
            socketManager.disconnect();
        }
        unregisterSmsReceiver();
        unregisterOrderAvailableReceiver();
        dismissOrderAlertDialog();
        stopOrderAlertSound();
        handler.removeCallbacks(otpTicker);
        super.onDestroy();
    }

    private void showLogin() {
        socketManager.disconnect();
        RiderLocationService.stop(this);
        RiderRuntimeState.set(this, false, false);
        mainRoot = null;
        mainScroll = null;
        content = null;
        bottomNav = null;
        dismissOrderAlertDialog();
        stopOrderAlertSound();
        unregisterSmsReceiver();
        handler.removeCallbacks(otpTicker);
        authMode = AuthMode.PICK;
        authBusy = false;
        authError = null;
        authStatus = null;
        googleRegistrationToken = null;
        googleEmail = null;
        googleName = null;
        googlePicture = null;
        phoneNational = "";
        phoneE164 = "";
        otpCode = "";
        renderAuthOrOnboarding();
    }

    private void registerAuthActivityLaunchers() {
        googleSignInLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getData() != null) {
                        handleGoogleSignInResult(result.getData());
                        return;
                    }
                    if (result.getResultCode() != RESULT_OK) {
                        authMode = AuthMode.PICK;
                        authBusy = false;
                        authError = "Google sign-in was cancelled.";
                        renderAuthOrOnboarding();
                        return;
                    }
                    authMode = AuthMode.PICK;
                    authBusy = false;
                    authError = "Google sign-in did not return a credential. Try again.";
                    renderAuthOrOnboarding();
                }
        );
        placesLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        Place place = Autocomplete.getPlaceFromIntent(result.getData());
                        applyPlaceToAddressDraft(place);
                        authError = null;
                    } else if (result.getResultCode() == AutocompleteActivity.RESULT_ERROR && result.getData() != null) {
                        authError = Autocomplete.getStatusFromIntent(result.getData()).getStatusMessage();
                    }
                    renderAuthOrOnboarding();
                }
        );
    }

    private void configureGoogleSignIn() {
        String clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID == null ? "" : BuildConfig.GOOGLE_WEB_CLIENT_ID.trim();
        if (clientId.isEmpty()) {
            googleSignInClient = null;
            return;
        }
        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestProfile()
                .requestIdToken(clientId)
                .build();
        googleSignInClient = GoogleSignIn.getClient(this, options);
    }

    private void initializePlacesIfConfigured() {
        String apiKey = BuildConfig.GOOGLE_MAPS_API_KEY == null ? "" : BuildConfig.GOOGLE_MAPS_API_KEY.trim();
        if (!apiKey.isEmpty() && !Places.isInitialized()) {
            Places.initialize(getApplicationContext(), apiKey, Locale.getDefault());
        }
    }

    private void renderAuthOrOnboarding() {
        switch (authMode) {
            case GOOGLE_BUSY:
                setContentView(authSurface(authCard(authChrome(googleBusyView()))));
                break;
            case GOOGLE_PHONE:
                setContentView(authSurface(authCard(authChrome(googlePhoneView()))));
                break;
            case GOOGLE_OTP:
                setContentView(authSurface(authCard(authChrome(googleOtpView()))));
                break;
            case ONBOARDING_WELCOME:
                setContentView(onboardingSurface(onboardingWelcomeView(), 0));
                break;
            case ONBOARDING_ADDRESS:
                setContentView(onboardingSurface(onboardingAddressView(), 1));
                break;
            case ONBOARDING_SUCCESS:
                setContentView(onboardingSurface(onboardingSuccessView(), 2));
                break;
            case PICK:
            default:
                setContentView(authSurface(authCard(authChrome(loginPickView()))));
                break;
        }
    }

    private View authChrome(View flow) {
        LinearLayout root = Ui.vertical(this);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(authHeader());
        Ui.gap(root, 24);
        root.addView(flow);
        Ui.gap(root, 24);
        root.addView(trustFooter());
        root.addView(termsFooter());
        return root;
    }

    private View loginPickView() {
        LinearLayout root = Ui.vertical(this);
        root.setGravity(Gravity.CENTER_HORIZONTAL);

        MaterialButton google = Ui.outlinePillButton(this, "Continue with Google");
        google.setIconResource(com.startup.rider.R.drawable.ic_google_mark);
        google.setIconTint(null);
        google.setIconPadding(Ui.dp(this, 10));
        bindAction(google, this::startGoogleSignIn);
        root.addView(google);

        if (authError != null) {
            Ui.gap(root, 12);
            TextView error = Ui.error(this, authError);
            error.setGravity(Gravity.CENTER);
            root.addView(error);
        }

        return root;
    }

    private View googleBusyView() {
        LinearLayout root = Ui.vertical(this);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        ImageView mark = new ImageView(this);
        mark.setImageResource(com.startup.rider.R.drawable.ic_google_mark);
        mark.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 56), Ui.dp(this, 56)));
        root.addView(mark);
        Ui.gap(root, 18);
        TextView title = Ui.text(this, "Authenticating", 18, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        root.addView(title);
        TextView body = Ui.text(this, "Waiting for Google to confirm your identity securely", 14, Typeface.NORMAL);
        body.setGravity(Gravity.CENTER);
        root.addView(body);
        Ui.gap(root, 22);
        ProgressBar progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        progress.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 36), Ui.dp(this, 36)));
        root.addView(progress);
        if (authError != null) {
            Ui.gap(root, 12);
            root.addView(Ui.error(this, authError));
        }
        return root;
    }

    private View googlePhoneView() {
        LinearLayout root = Ui.vertical(this);
        LinearLayout row = Ui.horizontal(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = Ui.text(this, "Verify your mobile", 14, Typeface.BOLD);
        title.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView cancel = Ui.text(this, "Cancel", 12, Typeface.BOLD);
        cancel.setTextColor(Ui.PRIMARY);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(Ui.dp(this, 8), Ui.dp(this, 8), 0, Ui.dp(this, 8));
        cancel.setOnClickListener(v -> showLogin());
        row.addView(title);
        row.addView(cancel);
        root.addView(row);

        if (googleEmail != null && !googleEmail.trim().isEmpty()) {
            Ui.gap(root, 10);
            root.addView(Ui.text(this, "Signed in as " + googleEmail + ". Add your business mobile to finish setup.", 12, Typeface.NORMAL));
        }

        Ui.gap(root, 16);
        root.addView(phoneInputRow());
        if (authError != null) {
            Ui.gap(root, 8);
            root.addView(Ui.error(this, authError));
        }
        Ui.gap(root, 16);
        MaterialButton send = Ui.button(this, authBusy ? "Sending..." : "Send code");
        send.setEnabled(!authBusy);
        bindAction(send, this::sendGoogleOtp);
        root.addView(send);
        return root;
    }

    private View googleOtpView() {
        LinearLayout root = Ui.vertical(this);
        root.addView(labeledOtpInput());
        if (authStatus != null) {
            Ui.gap(root, 8);
            root.addView(Ui.text(this, authStatus, 12, Typeface.NORMAL));
        }
        Ui.gap(root, 16);
        LinearLayout buttons = Ui.horizontal(this);
        buttons.setGravity(Gravity.CENTER_VERTICAL);
        MaterialButton back = Ui.secondaryButton(this, "Back");
        back.setLayoutParams(weightedButtonParams());
        bindAction(back, () -> {
            authMode = AuthMode.GOOGLE_PHONE;
            otpCode = "";
            authError = null;
            unregisterSmsReceiver();
            handler.removeCallbacks(otpTicker);
            renderAuthOrOnboarding();
        });
        MaterialButton verify = Ui.button(this, authBusy ? "Verifying..." : "Verify");
        verify.setLayoutParams(weightedButtonParams());
        verify.setEnabled(!authBusy);
        bindAction(verify, this::completeGoogleOtp);
        buttons.addView(back);
        Ui.gap(buttons, 8);
        buttons.addView(verify);
        root.addView(buttons);

        Ui.gap(root, 12);
        otpResendButton = Ui.secondaryButton(this, resendLabel());
        bindAction(otpResendButton, this::sendGoogleOtp);
        root.addView(otpResendButton);
        updateOtpResendButton();
        return root;
    }

    private View authHeader() {
        LinearLayout header = Ui.vertical(this);
        header.setGravity(Gravity.CENTER_HORIZONTAL);
        FrameLayout badge = new FrameLayout(this);
        badge.setBackground(Ui.strokedBackground(this, Ui.PRIMARY_LIGHT, Ui.DEFAULT_BORDER, 16));
        badge.setPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8));
        badge.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 56), Ui.dp(this, 56)));
        ImageView mark = new ImageView(this);
        mark.setImageResource(com.startup.rider.R.drawable.ic_grove_mark);
        mark.setLayoutParams(new FrameLayout.LayoutParams(Ui.dp(this, 40), Ui.dp(this, 40), Gravity.CENTER));
        badge.addView(mark);
        header.addView(badge);
        Ui.gap(header, 12);
        TextView title = Ui.text(this, "Grove", 24, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        header.addView(title);
        TextView body = Ui.text(this, "Wholesale disposable goods for teams that need reliable quality on every delivery.", 14, Typeface.NORMAL);
        body.setGravity(Gravity.CENTER);
        body.setPadding(Ui.dp(this, 8), 0, Ui.dp(this, 8), 0);
        header.addView(body);
        return header;
    }

    private View trustFooter() {
        LinearLayout section = Ui.vertical(this);
        section.setGravity(Gravity.CENTER_HORIZONTAL);
        View divider = new View(this);
        divider.setBackgroundColor(Ui.DEFAULT_BORDER);
        divider.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 1)));
        section.addView(divider);
        Ui.gap(section, 24);

        LinearLayout footer = Ui.horizontal(this);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        FrameLayout shield = new FrameLayout(this);
        shield.setBackground(Ui.roundedBackground(this, Ui.PRIMARY_LIGHT, 20));
        shield.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 44)));
        ImageView shieldIcon = new ImageView(this);
        shieldIcon.setImageResource(com.startup.rider.R.drawable.ic_shield_check);
        shieldIcon.setLayoutParams(new FrameLayout.LayoutParams(Ui.dp(this, 32), Ui.dp(this, 32), Gravity.CENTER));
        shield.addView(shieldIcon);
        TextView copy = Ui.text(this, "To protect our B2B relationship, we verify your mobile number before you can place orders with us.", 12, Typeface.NORMAL);
        copy.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        footer.addView(shield);
        Ui.gap(footer, 12);
        footer.addView(copy);
        section.addView(footer);
        return section;
    }

    private View termsFooter() {
        TextView terms = Ui.text(this, "By continuing, you agree to our Terms of Service and Privacy Policy.", 12, Typeface.NORMAL);
        terms.setTextColor(Ui.MUTED);
        terms.setGravity(Gravity.CENTER);
        terms.setPadding(Ui.dp(this, 4), Ui.dp(this, 18), Ui.dp(this, 4), 0);
        return terms;
    }

    private View phoneInputRow() {
        LinearLayout wrapper = Ui.vertical(this);
        wrapper.addView(Ui.label(this, "Phone number"));
        Ui.gap(wrapper, 8);

        LinearLayout field = Ui.horizontal(this);
        field.setGravity(Gravity.CENTER_VERTICAL);
        field.setMinimumHeight(Ui.dp(this, 44));
        field.setBackground(Ui.strokedBackground(this, Ui.CARD, authError == null ? Ui.DEFAULT_BORDER : Ui.ERROR, 8));
        field.setClipToOutline(true);

        LinearLayout country = Ui.horizontal(this);
        country.setGravity(Gravity.CENTER);
        country.setPadding(Ui.dp(this, 8), 0, Ui.dp(this, 8), 0);
        country.setBackgroundColor(Ui.DISABLED_BG);
        country.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(this, 44)));

        TextView flag = Ui.text(this, "🇮🇳", 18, Typeface.NORMAL);
        flag.setIncludeFontPadding(false);
        TextView dial = Ui.text(this, "+91", 12, Typeface.NORMAL);
        dial.setTypeface(Typeface.MONOSPACE, Typeface.NORMAL);
        dial.setTextColor(Ui.MUTED);
        TextView iso = Ui.text(this, "(IN)", 12, Typeface.BOLD);
        iso.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        iso.setTextColor(Ui.MUTED);
        TextView chevron = Ui.text(this, "⌄", 16, Typeface.BOLD);
        chevron.setTextColor(Ui.MUTED);

        country.addView(flag);
        Ui.gap(country, 8);
        country.addView(dial);
        Ui.gap(country, 6);
        country.addView(iso);
        Ui.gap(country, 6);
        country.addView(chevron);

        View separator = new View(this);
        separator.setBackgroundColor(Ui.DEFAULT_BORDER);
        separator.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 1), Ui.dp(this, 44)));

        EditText phone = new EditText(this);
        phone.setText(phoneNational);
        phone.setHint("9876543210");
        phone.setTextSize(16);
        phone.setTypeface(Typeface.MONOSPACE, Typeface.NORMAL);
        phone.setSingleLine(true);
        phone.setInputType(InputType.TYPE_CLASS_PHONE);
        phone.setImeOptions(EditorInfo.IME_ACTION_DONE);
        phone.setTextColor(Ui.HEADING);
        phone.setHintTextColor(Ui.MUTED);
        phone.setPadding(Ui.dp(this, 14), 0, Ui.dp(this, 14), 0);
        phone.setMinHeight(Ui.dp(this, 44));
        phone.setBackgroundColor(Ui.CARD);
        phone.setLayoutParams(new LinearLayout.LayoutParams(0, Ui.dp(this, 44), 1f));
        phone.addTextChangedListener(sanitizingTextWatcher(phone, this::normalizeIndianNationalDigits, value -> phoneNational = value));

        field.addView(country);
        field.addView(separator);
        field.addView(phone);
        wrapper.addView(field);
        return wrapper;
    }

    private View labeledOtpInput() {
        LinearLayout wrapper = Ui.vertical(this);
        wrapper.addView(Ui.label(this, "One-time code"));
        Ui.gap(wrapper, 8);
        EditText otp = Ui.input(this, "000000", InputType.TYPE_CLASS_NUMBER);
        otp.setText(otpCode);
        otp.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        otp.setTextSize(16);
        otp.setImeOptions(EditorInfo.IME_ACTION_DONE);
        Ui.setInputError(otp, authError != null);
        otp.addTextChangedListener(sanitizingTextWatcher(otp, value -> limitDigits(value, 6), value -> otpCode = value));
        wrapper.addView(otp);
        if (authError != null) {
            Ui.gap(wrapper, 6);
            wrapper.addView(Ui.error(this, authError));
        }
        return wrapper;
    }

    private MaterialCardView authCard(View child) {
        MaterialCardView card = Ui.card(this);
        card.setContentPadding(Ui.dp(this, 24), Ui.dp(this, 24), Ui.dp(this, 24), Ui.dp(this, 24));
        card.addView(child);
        return card;
    }

    private View authSurface(View card) {
        NestedScrollView scrollView = new NestedScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setClipToPadding(false);
        scrollView.setBackgroundColor(Ui.PAGE);
        scrollView.setNestedScrollingEnabled(true);
        LinearLayout root = Ui.vertical(this);
        root.setGravity(Gravity.CENTER);
        root.setPadding(Ui.dp(this, 16), Ui.dp(this, 32), Ui.dp(this, 16), Ui.dp(this, 32));
        root.setLayoutParams(new NestedScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        root.addView(card);
        scrollView.addView(root);
        return scrollView;
    }

    private void startGoogleSignIn() {
        if (googleSignInClient == null) {
            authError = "Google Sign-In is not configured. Add GOOGLE_WEB_CLIENT_ID to Gradle properties.";
            renderAuthOrOnboarding();
            return;
        }
        authMode = AuthMode.GOOGLE_BUSY;
        authBusy = true;
        authError = null;
        renderAuthOrOnboarding();
        googleSignInClient.signOut().addOnCompleteListener(task -> googleSignInLauncher.launch(googleSignInClient.getSignInIntent()));
    }

    private void handleGoogleSignInResult(Intent data) {
        try {
            GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException.class);
            String idToken = account.getIdToken();
            if (idToken == null || idToken.trim().isEmpty()) {
                authMode = AuthMode.PICK;
                authBusy = false;
                authError = "Missing Google credential. Try again.";
                renderAuthOrOnboarding();
                return;
            }
            googleEmail = account.getEmail();
            googleName = account.getDisplayName();
            googlePicture = account.getPhotoUrl() == null ? null : account.getPhotoUrl().toString();
            repository.loginWithGoogle(idToken, new UiResult<Dtos.GoogleAuthResponse>() {
                @Override
                public void success(Dtos.GoogleAuthResponse value) {
                    authBusy = false;
                    if (value != null && value.isAuthenticated()) {
                        routeAfterAuthenticated(value.user, value.rider);
                        return;
                    }
                    googleRegistrationToken = value == null ? null : value.registrationToken;
                    if (value != null && value.profile != null) {
                        googleEmail = value.profile.email;
                        googleName = value.profile.name;
                        googlePicture = value.profile.picture;
                    }
                    phoneNational = "";
                    authMode = AuthMode.GOOGLE_PHONE;
                    renderAuthOrOnboarding();
                }

                @Override
                public void error(RiderRepository.ApiFailure failure) {
                    authMode = AuthMode.PICK;
                    authBusy = false;
                    authError = friendlyFailure(failure, "Google sign-in failed");
                    renderAuthOrOnboarding();
                }
            });
        } catch (ApiException error) {
            authMode = AuthMode.PICK;
            authBusy = false;
            logGoogleSignInFailure(error);
            authError = googleSignInFailureMessage(error.getStatusCode());
            renderAuthOrOnboarding();
        }
    }

    private String googleSignInFailureMessage(int statusCode) {
        if (statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED || statusCode == CommonStatusCodes.CANCELED) {
            return "Google sign-in was cancelled.";
        }
        if (statusCode == GoogleSignInStatusCodes.SIGN_IN_CURRENTLY_IN_PROGRESS) {
            return "Google sign-in is already in progress. Please wait a moment.";
        }
        if (statusCode == CommonStatusCodes.NETWORK_ERROR) {
            return "No internet connection. Check your network and try again.";
        }
        if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) {
            return "Google Sign-In configuration mismatch. Add an Android OAuth client for package "
                    + getPackageName()
                    + " with SHA-1 "
                    + signingCertificateDigest("SHA-1")
                    + ", and keep GOOGLE_WEB_CLIENT_ID set to the Web OAuth client ID.";
        }
        if (statusCode == GoogleSignInStatusCodes.SIGN_IN_FAILED || statusCode == CommonStatusCodes.INTERNAL_ERROR) {
            return "Google sign-in failed. Check Google Play Services and try again.";
        }
        return "Google sign-in failed with status " + statusCode + ". Try again.";
    }

    private void logGoogleSignInFailure(ApiException error) {
        Log.w(
                TAG,
                "Google sign-in failed with status "
                        + error.getStatusCode()
                        + ", package="
                        + getPackageName()
                        + ", sha1="
                        + signingCertificateDigest("SHA-1")
                        + ", sha256="
                        + signingCertificateDigest("SHA-256")
                        + ", webClientId="
                        + maskClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID),
                error
        );
    }

    private String signingCertificateDigest(String algorithm) {
        Signature[] signatures = appSignatures();
        if (signatures.length == 0) {
            return "unavailable";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance(algorithm);
            byte[] bytes = digest.digest(signatures[0].toByteArray());
            StringBuilder builder = new StringBuilder();
            for (byte value : bytes) {
                if (builder.length() > 0) {
                    builder.append(':');
                }
                builder.append(String.format(Locale.US, "%02X", value));
            }
            return builder.toString();
        } catch (Exception ignored) {
            return "unavailable";
        }
    }

    private Signature[] appSignatures() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo signingInfo = info.signingInfo;
                if (signingInfo == null) {
                    return new Signature[0];
                }
                return signingInfo.hasMultipleSigners()
                        ? signingInfo.getApkContentsSigners()
                        : signingInfo.getSigningCertificateHistory();
            }
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
            return info.signatures == null ? new Signature[0] : info.signatures;
        } catch (PackageManager.NameNotFoundException ignored) {
            return new Signature[0];
        }
    }

    private String maskClientId(String clientId) {
        String value = clientId == null ? "" : clientId.trim();
        if (value.length() <= 16) {
            return value.isEmpty() ? "empty" : value;
        }
        return value.substring(0, 8) + "..." + value.substring(value.length() - 16);
    }

    private void sendGoogleOtp() {
        String normalized = buildIndianPhone(phoneNational);
        if (normalized == null) {
            authError = "Enter a valid 10-digit mobile number";
            renderAuthOrOnboarding();
            return;
        }
        if (googleRegistrationToken == null || googleRegistrationToken.trim().isEmpty()) {
            authError = "Google session expired. Start sign-in again.";
            authMode = AuthMode.PICK;
            renderAuthOrOnboarding();
            return;
        }
        phoneE164 = normalized;
        authBusy = true;
        authError = null;
        renderAuthOrOnboarding();
        repository.sendGoogleOtp(googleRegistrationToken, phoneE164, new UiResult<Dtos.OtpResponse>() {
            @Override
            public void success(Dtos.OtpResponse value) {
                authBusy = false;
                otpCode = "";
                authMode = AuthMode.GOOGLE_OTP;
                resendAvailableAtMs = System.currentTimeMillis() + OTP_RESEND_MS;
                int expires = value == null ? 0 : value.expiresInSeconds;
                authStatus = expires > 0
                        ? "OTP sent. It expires in " + expires + " seconds."
                        : "OTP sent.";
                startSmsRetriever();
                handler.removeCallbacks(otpTicker);
                handler.post(otpTicker);
                renderAuthOrOnboarding();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                authBusy = false;
                authError = friendlyFailure(failure, "Could not send code");
                renderAuthOrOnboarding();
            }
        });
    }

    private void completeGoogleOtp() {
        if (otpCode == null || otpCode.trim().length() != 6) {
            authError = "Enter the 6-digit code";
            renderAuthOrOnboarding();
            return;
        }
        authBusy = true;
        authError = null;
        renderAuthOrOnboarding();
        repository.completeGoogle(googleRegistrationToken, phoneE164, otpCode, new UiResult<Dtos.GoogleAuthResponse>() {
            @Override
            public void success(Dtos.GoogleAuthResponse value) {
                unregisterSmsReceiver();
                handler.removeCallbacks(otpTicker);
                authBusy = false;
                routeAfterAuthenticated(value == null ? null : value.user, value == null ? null : value.rider);
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                authBusy = false;
                authError = friendlyFailure(failure, "Verification failed");
                renderAuthOrOnboarding();
            }
        });
    }

    private void routeAfterAuthenticated(Dtos.UserDto user, Dtos.RiderDto authRider) {
        if (user == null || !"RIDER".equals(user.role)) {
            sessionStore.clear();
            authMode = AuthMode.PICK;
            authError = "This Google account is not registered for rider access.";
            renderAuthOrOnboarding();
            return;
        }
        sessionStore.updateUser(user);
        rider = authRider;
        if (authRider != null) {
            sessionStore.updateRider(authRider);
        }
        if (!user.isOnboardingCompleted) {
            addressDraft = sessionStore.onboardingAddressDraft();
            showOnboardingWelcome();
            return;
        }
        bootstrapSession();
    }

    private void showOnboardingWelcome() {
        socketManager.disconnect();
        RiderLocationService.stop(this);
        authMode = AuthMode.ONBOARDING_WELCOME;
        authBusy = false;
        authError = null;
        authStatus = null;
        renderAuthOrOnboarding();
    }

    private View onboardingSurface(View body, int activeIndex) {
        NestedScrollView scroll = new NestedScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackgroundColor(Ui.PAGE);
        scroll.setNestedScrollingEnabled(true);
        LinearLayout root = Ui.vertical(this);
        root.setPadding(Ui.dp(this, 16), 0, Ui.dp(this, 16), Ui.dp(this, 32));
        root.setLayoutParams(new NestedScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        LinearLayout topBlock = Ui.vertical(this);
        topBlock.setGravity(Gravity.CENTER_HORIZONTAL);
        topBlock.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        View top = new View(this);
        top.setBackgroundColor(Ui.PRIMARY);
        top.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 4)));
        topBlock.addView(top);
        topBlock.addView(stepper(activeIndex));
        root.addView(topBlock);

        LinearLayout centerContent = Ui.vertical(this);
        centerContent.setGravity(Gravity.CENTER);
        centerContent.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        centerContent.addView(body);
        root.addView(centerContent);

        scroll.addOnLayoutChangeListener((view, left, layoutTop, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            int viewportHeight = bottom - layoutTop;
            centerContent.setMinimumHeight(Math.max(
                    0,
                    viewportHeight - root.getPaddingTop() - root.getPaddingBottom() - topBlock.getHeight()
            ));
        });
        scroll.addView(root);
        return scroll;
    }

    private View stepper(int activeIndex) {
        LinearLayout wrapper = Ui.horizontal(this);
        wrapper.setGravity(Gravity.CENTER_VERTICAL);
        wrapper.setPadding(0, Ui.dp(this, 14), 0, Ui.dp(this, 14));
        for (int i = 0; i < 3; i++) {
            TextView bar = new TextView(this);
            bar.setBackground(Ui.roundedBackground(this, i <= activeIndex ? Ui.PRIMARY : Ui.DEFAULT_BORDER, 4));
            bar.setLayoutParams(new LinearLayout.LayoutParams(0, Ui.dp(this, 6), 1f));
            wrapper.addView(bar);
            if (i < 2) {
                Ui.gap(wrapper, 8);
            }
        }
        TextView label = Ui.text(this, "STEP " + (activeIndex + 1) + "/3", 10, Typeface.BOLD);
        label.setTextColor(Ui.MUTED);
        label.setPadding(Ui.dp(this, 10), 0, 0, 0);
        wrapper.addView(label);
        return wrapper;
    }

    private View onboardingWelcomeView() {
        MaterialCardView card = Ui.card(this);
        card.setCardBackgroundColor(Ui.PRIMARY_LIGHT);
        card.setContentPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8));
        LinearLayout body = Ui.vertical(this);
        body.setBackground(Ui.roundedBackground(this, Ui.CARD, 8));
        body.setPadding(Ui.dp(this, 20), Ui.dp(this, 20), Ui.dp(this, 20), Ui.dp(this, 20));
        body.addView(Ui.eyebrow(this, "Welcome"));
        Ui.gap(body, 8);
        body.addView(Ui.text(this, "Let's set up your rider account", 24, Typeface.BOLD));
        Ui.gap(body, 12);
        body.addView(Ui.text(this, "A few quick details help dispatch send the right jobs, keep delivery addresses accurate, and get you to the dashboard faster.", 14, Typeface.NORMAL));
        if (authError != null) {
            Ui.gap(body, 12);
            TextView error = Ui.error(this, authError);
            error.setGravity(Gravity.CENTER);
            body.addView(error);
        }
        Ui.gap(body, 30);
        MaterialButton next = Ui.button(this, "Next");
        bindAction(next, () -> {
            authMode = AuthMode.ONBOARDING_ADDRESS;
            authError = null;
            renderAuthOrOnboarding();
        });
        body.addView(next);
        card.addView(body);
        return card;
    }

    private View onboardingAddressView() {
        LinearLayout root = Ui.vertical(this);
        root.addView(Ui.text(this, "Delivery address", 20, Typeface.BOLD));
        root.addView(Ui.text(this, "This is used for rider account verification and routing context.", 14, Typeface.NORMAL));
        Ui.gap(root, 14);

        MaterialCardView card = Ui.card(this);
        card.setContentPadding(Ui.dp(this, 20), Ui.dp(this, 20), Ui.dp(this, 20), Ui.dp(this, 20));
        LinearLayout form = Ui.vertical(this);

        MaterialButton places = Ui.secondaryButton(this, "Search with Google Places");
        bindAction(places, this::openPlacesAutocomplete);
        form.addView(places);
        Ui.gap(form, 10);
        MaterialButton currentLocation = Ui.secondaryButton(this, "Use current location");
        bindAction(currentLocation, this::useCurrentLocationForAddress);
        form.addView(currentLocation);
        Ui.gap(form, 16);

        form.addView(labeledAddressInput("Complete address *", "Street, building, unit", "line1", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS));
        Ui.gap(form, 12);
        form.addView(labeledAddressInput("Landmark (optional)", "Suite, floor, landmark", "line2", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS));
        Ui.gap(form, 12);
        form.addView(labeledAddressInput("City *", "City", "city", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS));
        Ui.gap(form, 12);
        form.addView(labeledAddressInput("State *", "State", "state", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS));
        Ui.gap(form, 12);
        form.addView(labeledAddressInput("PIN code *", "6 digit PIN code", "pincode", InputType.TYPE_CLASS_NUMBER));
        card.addView(form);
        root.addView(card);

        if (authError != null) {
            Ui.gap(root, 10);
            TextView error = Ui.error(this, authError);
            error.setGravity(Gravity.CENTER);
            root.addView(error);
        }

        Ui.gap(root, 14);
        LinearLayout buttons = Ui.horizontal(this);
        MaterialButton back = Ui.secondaryButton(this, "Back");
        back.setLayoutParams(weightedButtonParams());
        back.setEnabled(!onboardingSaving);
        bindAction(back, () -> {
            authMode = AuthMode.ONBOARDING_WELCOME;
            authError = null;
            renderAuthOrOnboarding();
        });
        MaterialButton save = Ui.button(this, onboardingSaving ? "Saving..." : "Save & continue");
        save.setLayoutParams(weightedButtonParams());
        save.setEnabled(!onboardingSaving);
        bindAction(save, this::submitOnboardingAddress);
        buttons.addView(back);
        Ui.gap(buttons, 8);
        buttons.addView(save);
        root.addView(buttons);
        return root;
    }

    private View onboardingSuccessView() {
        MaterialCardView card = Ui.card(this);
        card.setCardBackgroundColor(Ui.PRIMARY_LIGHT);
        card.setContentPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8));
        LinearLayout body = Ui.vertical(this);
        body.setGravity(Gravity.CENTER_HORIZONTAL);
        body.setBackground(Ui.roundedBackground(this, Ui.CARD, 8));
        body.setPadding(Ui.dp(this, 24), Ui.dp(this, 32), Ui.dp(this, 24), Ui.dp(this, 32));

        FrameLayout circle = new FrameLayout(this);
        circle.setBackground(Ui.roundedBackground(this, Ui.SUCCESS_BG, 32));
        circle.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 64), Ui.dp(this, 64)));
        ImageView check = new ImageView(this);
        check.setImageResource(com.startup.rider.R.drawable.ic_success_check);
        check.setLayoutParams(new FrameLayout.LayoutParams(Ui.dp(this, 36), Ui.dp(this, 36), Gravity.CENTER));
        circle.addView(check);
        body.addView(circle);
        circle.setScaleX(0.75f);
        circle.setScaleY(0.75f);
        circle.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(420L).start();

        Ui.gap(body, 22);
        TextView title = Ui.text(this, "You're all set", 24, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        body.addView(title);
        TextView copy = Ui.text(this, "Your rider account is ready. We'll take you to today's delivery dashboard.", 14, Typeface.NORMAL);
        copy.setGravity(Gravity.CENTER);
        body.addView(copy);
        Ui.gap(body, 30);
        MaterialButton start = Ui.button(this, "Go to dashboard");
        bindAction(start, this::bootstrapSession);
        body.addView(start);
        card.addView(body);
        return card;
    }

    private View labeledAddressInput(String label, String hint, String key, int inputType) {
        LinearLayout wrapper = Ui.vertical(this);
        wrapper.addView(Ui.label(this, label));
        Ui.gap(wrapper, 6);
        EditText input = Ui.input(this, hint, inputType);
        if ("line1".equals(key)) {
            input.setSingleLine(false);
            input.setMinLines(2);
            input.setGravity(Gravity.TOP | Gravity.START);
            input.setText(addressDraft.line1);
            input.addTextChangedListener(textWatcher(value -> {
                addressDraft.line1 = value;
                saveAddressDraft();
            }));
        } else if ("line2".equals(key)) {
            input.setText(addressDraft.line2);
            input.addTextChangedListener(textWatcher(value -> {
                addressDraft.line2 = value;
                saveAddressDraft();
            }));
        } else if ("city".equals(key)) {
            input.setText(addressDraft.city);
            input.addTextChangedListener(textWatcher(value -> {
                addressDraft.city = value;
                saveAddressDraft();
            }));
        } else if ("state".equals(key)) {
            input.setText(addressDraft.state);
            input.addTextChangedListener(textWatcher(value -> {
                addressDraft.state = value;
                saveAddressDraft();
            }));
        } else if ("pincode".equals(key)) {
            input.setText(addressDraft.pincode);
            input.addTextChangedListener(textWatcher(value -> {
                String digits = digitsOnly(value);
                addressDraft.pincode = digits.length() > 6 ? digits.substring(0, 6) : digits;
                saveAddressDraft();
            }));
        }
        wrapper.addView(input);
        return wrapper;
    }

    private void submitOnboardingAddress() {
        String validation = validateAddressDraft();
        if (validation != null) {
            authError = validation;
            renderAuthOrOnboarding();
            return;
        }
        onboardingSaving = true;
        authError = null;
        renderAuthOrOnboarding();
        Dtos.CreateAddressRequest request = new Dtos.CreateAddressRequest(
                addressDraft.line1.trim(),
                emptyToNull(addressDraft.line2),
                addressDraft.city.trim(),
                addressDraft.state.trim(),
                addressDraft.pincode.trim(),
                true
        );
        repository.completeOnboarding(request, new UiResult<Dtos.UserDto>() {
            @Override
            public void success(Dtos.UserDto value) {
                onboardingSaving = false;
                authMode = AuthMode.ONBOARDING_SUCCESS;
                authError = null;
                renderAuthOrOnboarding();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                onboardingSaving = false;
                authError = friendlyFailure(failure, "Could not save your address");
                renderAuthOrOnboarding();
            }
        });
    }

    private String validateAddressDraft() {
        if (addressDraft.line1 == null || addressDraft.line1.trim().isEmpty()) {
            return "Street address is required";
        }
        if (addressDraft.line1.trim().length() > 200 || (addressDraft.line2 != null && addressDraft.line2.trim().length() > 200)) {
            return "Address lines must be 200 characters or less";
        }
        if (addressDraft.city == null || addressDraft.city.trim().isEmpty()) {
            return "City is required";
        }
        if (addressDraft.state == null || addressDraft.state.trim().isEmpty()) {
            return "State is required";
        }
        if (addressDraft.city.trim().length() > 100 || addressDraft.state.trim().length() > 100) {
            return "City and state must be 100 characters or less";
        }
        if (addressDraft.pincode == null || !addressDraft.pincode.trim().matches("^[1-9][0-9]{5}$")) {
            return "Enter a valid 6-digit PIN code";
        }
        return null;
    }

    private void openPlacesAutocomplete() {
        if (!Places.isInitialized()) {
            authError = "Google Places is not configured. Add GOOGLE_MAPS_API_KEY to Gradle properties.";
            renderAuthOrOnboarding();
            return;
        }
        List<Place.Field> fields = Arrays.asList(
                Place.Field.ADDRESS_COMPONENTS,
                Place.Field.FORMATTED_ADDRESS,
                Place.Field.LOCATION,
                Place.Field.DISPLAY_NAME
        );
        Intent intent = new Autocomplete.IntentBuilder(AutocompleteActivityMode.OVERLAY, fields).build(this);
        placesLauncher.launch(intent);
    }

    private void applyPlaceToAddressDraft(Place place) {
        if (place == null) {
            return;
        }
        String formatted = place.getFormattedAddress();
        if (formatted != null && !formatted.trim().isEmpty()) {
            addressDraft.line1 = formatted.trim();
        }
        if (place.getAddressComponents() != null) {
            for (com.google.android.libraries.places.api.model.AddressComponent component : place.getAddressComponents().asList()) {
                List<String> types = component.getTypes();
                if (types.contains("locality") || types.contains("administrative_area_level_3")) {
                    addressDraft.city = component.getName();
                } else if (types.contains("administrative_area_level_1")) {
                    addressDraft.state = component.getName();
                } else if (types.contains("postal_code")) {
                    addressDraft.pincode = component.getName();
                }
            }
        }
        saveAddressDraft();
    }

    private void useCurrentLocationForAddress() {
        if (!hasFineLocationPermission()) {
            pendingOnboardingLocationRequest = true;
            requestFineLocation();
            return;
        }
        CurrentLocationRequest request = new CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setDurationMillis(10_000)
                .setMaxUpdateAgeMillis(30_000)
                .build();
        fusedLocation.getCurrentLocation(request, new CancellationTokenSource().getToken())
                .addOnSuccessListener(location -> {
                    if (location == null) {
                        authError = "Location unavailable. Try Google Places search instead.";
                        renderAuthOrOnboarding();
                        return;
                    }
                    reverseGeocodeAddress(location);
                })
                .addOnFailureListener(error -> {
                    authError = "Location unavailable: " + error.getMessage();
                    renderAuthOrOnboarding();
                });
    }

    private void reverseGeocodeAddress(Location location) {
        try {
            Geocoder geocoder = new Geocoder(this, Locale.getDefault());
            List<Address> addresses = geocoder.getFromLocation(location.getLatitude(), location.getLongitude(), 1);
            if (addresses == null || addresses.isEmpty()) {
                authError = "Could not resolve this location into an address.";
                renderAuthOrOnboarding();
                return;
            }
            Address address = addresses.get(0);
            addressDraft.line1 = joinNonEmpty(", ", address.getFeatureName(), address.getThoroughfare(), address.getSubLocality());
            if (addressDraft.line1.trim().isEmpty()) {
                addressDraft.line1 = address.getAddressLine(0) == null ? "" : address.getAddressLine(0);
            }
            addressDraft.city = firstNonEmpty(address.getLocality(), address.getSubAdminArea());
            addressDraft.state = address.getAdminArea() == null ? "" : address.getAdminArea();
            addressDraft.pincode = address.getPostalCode() == null ? "" : digitsOnly(address.getPostalCode());
            saveAddressDraft();
            authError = null;
            renderAuthOrOnboarding();
        } catch (Exception error) {
            authError = "Could not resolve this location into an address.";
            renderAuthOrOnboarding();
        }
    }

    private void startSmsRetriever() {
        try {
            unregisterSmsReceiver();
            smsReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (!SmsRetriever.SMS_RETRIEVED_ACTION.equals(intent.getAction())) {
                        return;
                    }
                    Bundle extras = intent.getExtras();
                    if (extras == null) {
                        return;
                    }
                    Status status = (Status) extras.get(SmsRetriever.EXTRA_STATUS);
                    if (status == null || status.getStatusCode() != CommonStatusCodes.SUCCESS) {
                        return;
                    }
                    String message = (String) extras.get(SmsRetriever.EXTRA_SMS_MESSAGE);
                    Matcher matcher = message == null ? null : OTP_PATTERN.matcher(message);
                    if (matcher != null && matcher.find()) {
                        otpCode = matcher.group(1);
                        authStatus = "OTP detected automatically.";
                        renderAuthOrOnboarding();
                    }
                }
            };
            IntentFilter filter = new IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                registerReceiver(smsReceiver, filter);
            }
            SmsRetriever.getClient(this).startSmsRetriever();
        } catch (RuntimeException ignored) {
            smsReceiver = null;
        }
    }

    private void unregisterSmsReceiver() {
        if (smsReceiver == null) {
            return;
        }
        try {
            unregisterReceiver(smsReceiver);
        } catch (RuntimeException ignored) {
        }
        smsReceiver = null;
    }

    private void registerOrderAvailableReceiver() {
        if (orderAvailableReceiver != null) {
            return;
        }
        orderAvailableReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (OrderAlertNotifier.ACTION_ORDER_AVAILABLE.equals(intent.getAction())) {
                    handleOrderAvailableBroadcast(intent);
                }
            }
        };
        IntentFilter filter = new IntentFilter(OrderAlertNotifier.ACTION_ORDER_AVAILABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(orderAvailableReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(orderAvailableReceiver, filter);
        }
    }

    private void unregisterOrderAvailableReceiver() {
        if (orderAvailableReceiver == null) {
            return;
        }
        try {
            unregisterReceiver(orderAvailableReceiver);
        } catch (RuntimeException ignored) {
        }
        orderAvailableReceiver = null;
    }

    private TextWatcher textWatcher(Consumer<String> onChanged) {
        return new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                onChanged.accept(s == null ? "" : s.toString());
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        };
    }

    private TextWatcher sanitizingTextWatcher(EditText input, Function<String, String> sanitizer, Consumer<String> onChanged) {
        return new TextWatcher() {
            private boolean selfChange;

            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                if (selfChange) {
                    return;
                }
                String original = s == null ? "" : s.toString();
                String sanitized = sanitizer.apply(original);
                onChanged.accept(sanitized);
                if (sanitized.equals(original)) {
                    return;
                }
                selfChange = true;
                input.setText(sanitized);
                input.setSelection(sanitized.length());
                selfChange = false;
            }
        };
    }

    private LinearLayout.LayoutParams weightedButtonParams() {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
    }

    private void bindAction(MaterialButton button, Runnable action) {
        button.setClickable(true);
        button.setFocusable(false);
        button.setOnTouchListener(null);
        button.setOnClickListener(v -> {
            if (!v.isEnabled()) {
                return;
            }
            handler.post(() -> {
                if (!isFinishing() && !isDestroyed()) {
                    action.run();
                }
            });
        });
    }

    private String buildIndianPhone(String national) {
        String digits = normalizeIndianNationalDigits(national);
        if (!digits.matches("^[6-9][0-9]{9}$")) {
            return null;
        }
        return "+91" + digits;
    }

    private String normalizeIndianNationalDigits(String value) {
        String digits = digitsOnly(value);
        if (digits.length() > 10 && digits.startsWith("91")) {
            digits = digits.substring(2);
        }
        if (digits.length() > 10 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        return limitDigits(digits, 10);
    }

    private String limitDigits(String value, int maxDigits) {
        String digits = digitsOnly(value);
        return digits.length() > maxDigits ? digits.substring(0, maxDigits) : digits;
    }

    private String digitsOnly(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private long remainingResendMs() {
        return Math.max(0L, resendAvailableAtMs - System.currentTimeMillis());
    }

    private String resendLabel() {
        long remaining = remainingResendMs();
        if (remaining <= 0L) {
            return "Resend code";
        }
        return "Resend in " + Math.max(1L, (remaining + 999L) / 1000L) + "s";
    }

    private void updateOtpResendButton() {
        if (otpResendButton == null || authMode != AuthMode.GOOGLE_OTP) {
            return;
        }
        otpResendButton.setText(resendLabel());
        otpResendButton.setEnabled(!authBusy && remainingResendMs() <= 0);
    }

    private String friendlyFailure(RiderRepository.ApiFailure failure, String fallback) {
        if (failure == null || failure.message == null || failure.message.trim().isEmpty()) {
            return fallback;
        }
        if (failure.network) {
            return "No internet connection. Check your network and try again.";
        }
        return failure.message;
    }

    private void saveAddressDraft() {
        if (sessionStore != null) {
            sessionStore.saveOnboardingAddressDraft(addressDraft);
        }
    }

    private String emptyToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    private String joinNonEmpty(String separator, String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                parts.add(value.trim());
            }
        }
        return String.join(separator, parts);
    }

    private void resumeLoggedInSession() {
        repository.refreshProfile(new UiResult<Dtos.UserDto>() {
            @Override
            public void success(Dtos.UserDto user) {
                if (user == null || !"RIDER".equals(user.role)) {
                    sessionStore.clear();
                    showLogin();
                    return;
                }
                if (!user.isOnboardingCompleted) {
                    addressDraft = sessionStore.onboardingAddressDraft();
                    showOnboardingWelcome();
                    return;
                }
                bootstrapSession();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                if (failure.unauthorized) {
                    sessionStore.clear();
                    showLogin();
                    return;
                }
                if (!sessionStore.isOnboardingCompleted() || failure.onboardingRequired) {
                    showOnboardingRequired(failure);
                    return;
                }
                bootstrapSession();
            }
        });
    }

    private void showOnboardingRequired(RiderRepository.ApiFailure failure) {
        addressDraft = sessionStore.onboardingAddressDraft();
        showOnboardingWelcome();
        authError = friendlyFailure(failure, "Complete onboarding to continue");
        renderAuthOrOnboarding();
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
                if (failure.onboardingRequired) {
                    showOnboardingRequired(failure);
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
        mainRoot = new FrameLayout(this);
        mainRoot.setBackgroundColor(Ui.PAGE);

        mainScroll = new NestedScrollView(this);
        mainScroll.setFillViewport(true);
        mainScroll.setClipToPadding(false);
        mainScroll.setNestedScrollingEnabled(true);
        mainScroll.setPadding(0, 0, 0, Ui.dp(this, 106));
        content = Ui.vertical(this);
        content.setPadding(Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 28));
        content.setLayoutParams(new NestedScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        mainScroll.addView(content);
        mainRoot.addView(mainScroll, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        bottomNav = new LinearLayout(this);
        bottomNav.setOrientation(LinearLayout.HORIZONTAL);
        bottomNav.setGravity(Gravity.CENTER);
        bottomNav.setPadding(Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4));
        bottomNav.setMinimumHeight(Ui.dp(this, 64));
        bottomNav.setBackground(glassNavBackground());
        bottomNav.setElevation(Ui.dp(this, 18));
        FrameLayout.LayoutParams navParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Ui.dp(this, 72),
                Gravity.BOTTOM
        );
        navParams.setMargins(Ui.dp(this, 12), 0, Ui.dp(this, 12), Ui.dp(this, 12));
        mainRoot.addView(bottomNav, navParams);

        setContentView(mainRoot);
        connectSocket();
        render();
        handler.postDelayed(this::promptRequiredRuntimeAccess, 500L);
    }

    private void render() {
        if (content == null) {
            return;
        }
        content.removeAllViews();
        if (activeMainTab == MainTab.ORDERS) {
            content.addView(sectionTitle("Orders", "Accept new jobs and manage your active delivery."));
            Ui.gap(content, 10);
            if (activeOrder != null && !Dtos.isTerminal(activeOrder)) {
                content.addView(activeOrderCard(activeOrder));
                Ui.gap(content, 10);
            }
            content.addView(availableOrdersCard());
        } else if (activeMainTab == MainTab.ALERTS) {
            content.addView(sectionTitle("Alerts", "Keep permissions and delivery notifications ready."));
            Ui.gap(content, 10);
            content.addView(permissionCard());
            Ui.gap(content, 10);
            content.addView(alertsStatusCard());
        } else if (activeMainTab == MainTab.ACCOUNT) {
            content.addView(sectionTitle("Account", "Rider profile, session, and device actions."));
            Ui.gap(content, 10);
            content.addView(accountCard());
            Ui.gap(content, 10);
            content.addView(actionsCard());
        } else {
            content.addView(header());
            Ui.gap(content, 10);
            List<Dtos.OrderDto> offers = visibleOrderOffers();
            if (!offers.isEmpty()) {
                content.addView(orderOffersCard("New order offers", offers, true));
                Ui.gap(content, 10);
            }
            if (activeOrder != null && !Dtos.isTerminal(activeOrder)) {
                content.addView(activeOrderCard(activeOrder));
                Ui.gap(content, 10);
            }
            content.addView(homeStatusCard());
            Ui.gap(content, 10);
            content.addView(permissionCard());
        }
        renderBottomNav();
        updateRiderRuntimeState();
    }

    private List<Dtos.OrderDto> visibleOrderOffers() {
        List<Dtos.OrderDto> offers = new ArrayList<>();
        addVisibleOffers(offers, pushedOrderOffers);
        if (availableOrders != null && availableOrders.items != null) {
            addVisibleOffers(offers, availableOrders.items);
        }
        return offers;
    }

    private void addVisibleOffers(List<Dtos.OrderDto> target, List<Dtos.OrderDto> source) {
        if (source == null) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (Dtos.OrderDto existing : target) {
            if (existing != null && existing.id != null) {
                seen.add(existing.id);
            }
        }
        for (Dtos.OrderDto order : source) {
            if (order == null || order.id == null || order.id.trim().isEmpty()) {
                continue;
            }
            if (rejectedOfferIds.contains(order.id) || seen.contains(order.id) || Dtos.isTerminal(order)) {
                continue;
            }
            if (activeOrder != null && order.id.equals(activeOrder.id)) {
                continue;
            }
            target.add(order);
            seen.add(order.id);
        }
    }

    private MaterialCardView orderOffersCard(String title, List<Dtos.OrderDto> offers, boolean emphasized) {
        MaterialCardView card = Ui.card(this);
        if (emphasized) {
            card.setCardBackgroundColor(Ui.PRIMARY_LIGHT);
            card.setStrokeColor(Ui.PRIMARY);
        }
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, title + " (" + offers.size() + ")", 18, Typeface.BOLD));
        body.addView(Ui.text(this, "Newly placed orders appear here with live distance context from your current location.", 12, Typeface.NORMAL));
        for (Dtos.OrderDto order : offers) {
            Ui.gap(body, 10);
            body.addView(orderOfferRow(order));
        }
        card.addView(body);
        return card;
    }

    private View orderOfferRow(Dtos.OrderDto order) {
        LinearLayout box = Ui.vertical(this);
        box.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        box.setBackground(Ui.strokedBackground(this, Ui.CARD, Ui.DEFAULT_BORDER, 12));

        LinearLayout top = Ui.horizontal(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = Ui.text(this, "Order #" + Dtos.shortOrderId(order), 15, Typeface.BOLD);
        title.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView price = Ui.text(this, orderPriceLabel(order), 15, Typeface.BOLD);
        price.setTextColor(Ui.PRIMARY);
        price.setGravity(Gravity.END);
        top.addView(title);
        top.addView(price);
        box.addView(top);

        Ui.gap(box, 8);
        box.addView(Ui.text(this, "Delivery Address", 11, Typeface.BOLD));
        TextView address = Ui.text(this, Dtos.deliveryAddress(order), 13, Typeface.NORMAL);
        address.setTextColor(Ui.HEADING);
        box.addView(address);

        Ui.gap(box, 8);
        TextView metrics = Ui.text(this, offerDistanceEta(order), 13, Typeface.BOLD);
        metrics.setTextColor(Ui.SECONDARY);
        box.addView(metrics);

        Ui.gap(box, 10);
        LinearLayout buttons = Ui.horizontal(this);
        MaterialButton reject = Ui.secondaryButton(this, "Reject");
        reject.setLayoutParams(weightedButtonParams());
        bindAction(reject, () -> rejectOffer(order));
        MaterialButton accept = Ui.button(this, "Accept");
        accept.setLayoutParams(weightedButtonParams());
        bindAction(accept, () -> claimOrder(order));
        buttons.addView(reject);
        Ui.gap(buttons, 8);
        buttons.addView(accept);
        box.addView(buttons);
        return box;
    }

    private String orderPriceLabel(Dtos.OrderDto order) {
        if (order != null && order.totalAmount != null && !order.totalAmount.trim().isEmpty()) {
            return Dtos.total(order);
        }
        return Dtos.payout(order);
    }

    private String offerDistanceEta(Dtos.OrderDto order) {
        Dtos.Coordinates drop = Dtos.coordinates(order == null ? null : order.addressSnapshot);
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        Dtos.Coordinates origin = Dtos.coordinates(localRider == null ? null : localRider.currentLocation);
        if (drop == null) {
            String fallbackDistance = offerDistanceFallback(order);
            return fallbackDistance == null ? "Distance pending • ETA pending" : fallbackDistance + " • ETA pending";
        }
        if (origin == null) {
            return "Update location for distance & ETA";
        }
        double km = distanceKm(origin.lat, origin.lng, drop.lat, drop.lng);
        int etaMinutes = Math.max(1, (int) Math.ceil((km / 25.0d) * 60.0d));
        return String.format(Locale.US, "%.1f km • %d min ETA", km, etaMinutes);
    }

    private String offerDistanceFallback(Dtos.OrderDto order) {
        try {
            if (order == null || order.addressSnapshot == null || !order.addressSnapshot.isJsonObject()) {
                return null;
            }
            JsonObject object = order.addressSnapshot.getAsJsonObject();
            if (!object.has("distanceLabel") || object.get("distanceLabel").isJsonNull()) {
                return null;
            }
            String label = object.get("distanceLabel").getAsString();
            return label == null || label.trim().isEmpty() ? null : label.trim();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private double distanceKm(double fromLat, double fromLng, double toLat, double toLng) {
        double earthRadiusKm = 6371.0d;
        double dLat = Math.toRadians(toLat - fromLat);
        double dLng = Math.toRadians(toLng - fromLng);
        double a = Math.sin(dLat / 2.0d) * Math.sin(dLat / 2.0d)
                + Math.cos(Math.toRadians(fromLat)) * Math.cos(Math.toRadians(toLat))
                * Math.sin(dLng / 2.0d) * Math.sin(dLng / 2.0d);
        return earthRadiusKm * 2.0d * Math.atan2(Math.sqrt(a), Math.sqrt(1.0d - a));
    }

    private View sectionTitle(String title, String subtitle) {
        LinearLayout body = Ui.vertical(this);
        body.setPadding(Ui.dp(this, 4), Ui.dp(this, 2), Ui.dp(this, 4), 0);
        body.addView(Ui.text(this, title, 24, Typeface.BOLD));
        TextView copy = Ui.text(this, subtitle, 13, Typeface.NORMAL);
        copy.setTextColor(Ui.SECONDARY);
        body.addView(copy);
        return body;
    }

    private View homeStatusCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Today at a glance", 17, Typeface.BOLD));
        int availableCount = availableOrders == null ? 0 : availableOrders.total;
        String active = activeOrder != null && !Dtos.isTerminal(activeOrder)
                ? "Active delivery #" + Dtos.shortOrderId(activeOrder)
                : "No active delivery";
        body.addView(Ui.text(this, active, 13, Typeface.NORMAL));
        body.addView(Ui.text(this, availableCount + " available orders nearby", 13, Typeface.NORMAL));
        body.addView(Ui.text(this, "Socket " + socketState, 12, Typeface.NORMAL));
        card.addView(body);
        return card;
    }

    private View alertsStatusCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Notification status", 17, Typeface.BOLD));
        body.addView(Ui.text(this, hasNotificationPermission() ? "Notifications are enabled" : "Notifications need attention", 13, Typeface.NORMAL));
        body.addView(Ui.text(this, hasFineLocationPermission() && isDeviceLocationEnabled() ? "Location is ready" : "Location needs attention", 13, Typeface.NORMAL));
        body.addView(Ui.text(this, "Socket " + socketState, 12, Typeface.NORMAL));
        if (lastError != null) {
            Ui.gap(body, 8);
            body.addView(Ui.error(this, lastError));
        }
        card.addView(body);
        return card;
    }

    private View accountCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        body.addView(Ui.text(this, localRider == null ? "Rider account" : localRider.name, 18, Typeface.BOLD));
        Ui.gap(body, 8);
        body.addView(accountRow("Phone", localRider == null || localRider.phone == null ? "Not available" : localRider.phone));
        Ui.gap(body, 6);
        body.addView(accountRow("Status", localRider == null || localRider.status == null ? "Unknown" : Dtos.statusLabel(localRider.status)));
        Ui.gap(body, 6);
        body.addView(accountRow("API", AppConfig.API_BASE_URL));
        card.addView(body);
        return card;
    }

    private View accountRow(String label, String value) {
        LinearLayout row = Ui.horizontal(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView left = Ui.text(this, label, 12, Typeface.BOLD);
        left.setTextColor(Ui.MUTED);
        left.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.42f));
        TextView right = Ui.text(this, value, 13, Typeface.NORMAL);
        right.setGravity(Gravity.END);
        right.setTextColor(Ui.HEADING);
        right.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.58f));
        row.addView(left);
        row.addView(right);
        return row;
    }

    private void renderBottomNav() {
        if (bottomNav == null) {
            return;
        }
        bottomNav.removeAllViews();
        bottomNav.setBackground(glassNavBackground());
        bottomNav.addView(bottomNavItem(MainTab.HOME, "Home", R.drawable.ic_nav_home));
        bottomNav.addView(bottomNavItem(MainTab.ORDERS, "Orders", R.drawable.ic_nav_orders));
        bottomNav.addView(bottomNavItem(MainTab.ALERTS, "Alerts", R.drawable.ic_nav_alerts));
        bottomNav.addView(bottomNavItem(MainTab.ACCOUNT, "Account", R.drawable.ic_nav_account));
    }

    private View bottomNavItem(MainTab tab, String label, int iconRes) {
        boolean active = activeMainTab == tab;
        LinearLayout item = Ui.vertical(this);
        item.setGravity(Gravity.CENTER);
        item.setPadding(Ui.dp(this, 2), Ui.dp(this, 6), Ui.dp(this, 2), Ui.dp(this, 6));
        item.setMinimumHeight(Ui.dp(this, 56));
        item.setClickable(true);
        item.setFocusable(true);
        item.setBackground(navItemBackground(active));
        item.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f));
        item.setOnClickListener(v -> handleBottomNavTap(tab));

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(active ? Ui.PRIMARY : Ui.SECONDARY);
        icon.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 24), Ui.dp(this, 24)));
        icon.setClickable(false);
        icon.setFocusable(false);
        item.addView(icon);

        TextView text = Ui.text(this, label, 10, Typeface.BOLD);
        text.setGravity(Gravity.CENTER);
        text.setSingleLine(true);
        text.setTextColor(active ? Ui.PRIMARY : Ui.SECONDARY);
        text.setIncludeFontPadding(false);
        text.setClickable(false);
        text.setFocusable(false);
        item.addView(text);
        return item;
    }

    private void handleBottomNavTap(MainTab tab) {
        if (isFinishing() || isDestroyed()) {
            return;
        }
        if (tab == MainTab.ORDERS) {
            openOrderHistory();
            return;
        }
        if (activeMainTab == tab) {
            return;
        }
        activeMainTab = tab;
        render();
        if (mainScroll != null) {
            mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
        }
    }

    private void openOrderHistory() {
        try {
            startActivity(new Intent(MainActivity.this, OrderHistoryActivity.class));
        } catch (RuntimeException error) {
            activeMainTab = MainTab.ORDERS;
            lastError = "Could not open order history: " + error.getMessage();
            render();
            if (mainScroll != null) {
                mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
            }
        }
    }

    private GradientDrawable glassNavBackground() {
        GradientDrawable drawable = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{
                Color.argb(235, 255, 255, 255),
                Color.argb(205, 246, 251, 249),
                Color.argb(175, 230, 244, 241)
        });
        drawable.setCornerRadius(Ui.dp(this, 28));
        drawable.setStroke(Ui.dp(this, 1), Color.argb(150, 255, 255, 255));
        return drawable;
    }

    private GradientDrawable navItemBackground(boolean active) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setCornerRadius(Ui.dp(this, 22));
        drawable.setColor(active ? Color.argb(116, 255, 255, 255) : Color.TRANSPARENT);
        return drawable;
    }

    private View header() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        body.addView(Ui.text(this, localRider == null ? "Rider dashboard" : "Welcome, " + localRider.name, 22, Typeface.BOLD));
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
            bindAction(button, this::requestFineLocation);
            buttons.addView(button);
        } else if (!isDeviceLocationEnabled()) {
            MaterialButton button = Ui.button(this, "Turn on location services");
            bindAction(button, this::promptEnableLocationServices);
            buttons.addView(button);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
            MaterialButton button = Ui.button(this, "Allow background location");
            bindAction(button, this::requestBackgroundLocation);
            buttons.addView(button);
        }
        if (!hasNotificationPermission()) {
            MaterialButton button = Ui.button(this, "Allow notifications");
            bindAction(button, this::requestNotifications);
            buttons.addView(button);
        }
        if (!isIgnoringBatteryOptimizations()) {
            MaterialButton button = Ui.button(this, "Allow battery exemption");
            bindAction(button, this::requestBatteryExemption);
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
        bindAction(dropNav, () -> openNavigation(order));
        body.addView(dropNav);

        MaterialButton preview = Ui.button(this, "Preview route");
        bindAction(preview, () -> openRoutePreview(order));
        body.addView(preview);

        String next = Dtos.nextRiderStatus(order);
        if (next != null) {
            MaterialButton transition = Ui.button(this, "Mark " + Dtos.statusLabel(next));
            bindAction(transition, () -> patchStatus(order, next));
            body.addView(transition);
        }
        card.addView(body);
        return card;
    }

    private View availableOrdersCard() {
        List<Dtos.OrderDto> items = visibleOrderOffers();
        if (items.isEmpty()) {
            MaterialCardView card = Ui.card(this);
            LinearLayout body = Ui.vertical(this);
            body.addView(Ui.text(this, "Available orders (0)", 18, Typeface.BOLD));
            body.addView(Ui.text(this, "No unassigned orders right now. The list refreshes from sockets, FCM, and periodic fallback refresh.", 13, Typeface.NORMAL));
            card.addView(body);
            return card;
        }

        MaterialCardView card = orderOffersCard("Available orders", items, false);
        LinearLayout body = (LinearLayout) card.getChildAt(0);

        Ui.gap(body, 10);
        LinearLayout pager = Ui.horizontal(this);
        pager.setGravity(Gravity.CENTER_VERTICAL);
        MaterialButton previous = Ui.button(this, "Previous");
        previous.setEnabled(availablePage > 1);
        bindAction(previous, () -> {
            availablePage = Math.max(1, availablePage - 1);
            refreshAvailableOrders(true);
        });
        MaterialButton next = Ui.button(this, "Next");
        boolean hasNext = availableOrders != null && availableOrders.page * availableOrders.pageSize < availableOrders.total;
        next.setEnabled(hasNext);
        bindAction(next, () -> {
            availablePage += 1;
            refreshAvailableOrders(true);
        });
        pager.addView(previous);
        pager.addView(next);
        body.addView(pager);
        return card;
    }

    private View availableOrderRow(Dtos.OrderDto order) {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "#" + Dtos.shortOrderId(order) + " - " + Dtos.statusLabel(order.deliveryType), 15, Typeface.BOLD));
        body.addView(Ui.text(this, Dtos.deliveryAddress(order), 13, Typeface.NORMAL));
        body.addView(Ui.text(this, Dtos.payout(order) + " - " + Dtos.timeSinceCreated(order), 13, Typeface.BOLD));
        MaterialButton accept = Ui.button(this, "Accept order");
        bindAction(accept, () -> claimOrder(order));
        body.addView(accept);
        card.addView(body);
        return card;
    }

    private View actionsCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        MaterialButton refresh = Ui.button(this, "Refresh");
        bindAction(refresh, () -> refreshData(true));
        MaterialButton updateLocation = Ui.button(this, "Update my location");
        bindAction(updateLocation, this::publishCurrentLocationSnapshot);
        MaterialButton logout = Ui.button(this, "Logout");
        bindAction(logout, () -> repository.logout(new UiResult<Object>() {
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
                if (failure.unauthorized) {
                    showLogin();
                } else if (failure.onboardingRequired) {
                    showOnboardingRequired(failure);
                } else {
                    render();
                }
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
                if (failure.unauthorized) {
                    showLogin();
                } else if (failure.onboardingRequired) {
                    showOnboardingRequired(failure);
                } else {
                    render();
                }
            }
        });
    }

    private void claimOrder(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        claimOrder(order.id, order);
    }

    private void claimOrder(String orderId, Dtos.OrderDto order) {
        dismissOrderAlertDialog();
        stopOrderAlertSound();
        removeOfferById(orderId);
        render();
        repository.claimOrder(orderId, new UiResult<Dtos.OrderDto>() {
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

    private void rejectOffer(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        rejectedOfferIds.add(order.id);
        removeOfferById(order.id);
        stopOrderAlertSound();
        Toast.makeText(this, "Order rejected", Toast.LENGTH_SHORT).show();
        render();
    }

    private void removeOfferById(String orderId) {
        if (orderId == null || orderId.trim().isEmpty()) {
            return;
        }
        for (int i = pushedOrderOffers.size() - 1; i >= 0; i--) {
            Dtos.OrderDto item = pushedOrderOffers.get(i);
            if (item != null && orderId.equals(item.id)) {
                pushedOrderOffers.remove(i);
            }
        }
        if (availableOrders != null && availableOrders.items != null) {
            for (int i = availableOrders.items.size() - 1; i >= 0; i--) {
                Dtos.OrderDto item = availableOrders.items.get(i);
                if (item != null && orderId.equals(item.id)) {
                    availableOrders.items.remove(i);
                    availableOrders.total = Math.max(0, availableOrders.total - 1);
                }
            }
        }
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

    private void handleNewAvailableOrderAlert(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        if (!new NotificationDeduper(this).shouldShow(OrderAlertNotifier.dedupeKey(order))) {
            return;
        }
        if (isRiderIdleForOrderAlert()) {
            showOfferCardsForNewOrder(order);
        } else {
            OrderAlertNotifier.show(this, order);
        }
    }

    private void handleOrderAvailableBroadcast(Intent intent) {
        String orderId = intent == null ? null : intent.getStringExtra(OrderAlertNotifier.EXTRA_ORDER_ID);
        if (orderId == null || orderId.trim().isEmpty()) {
            return;
        }
        if (!new NotificationDeduper(this).shouldShow(OrderAlertNotifier.dedupeKey(intent))) {
            return;
        }
        if (!isRiderIdleForOrderAlert()) {
            OrderAlertNotifier.show(this, broadcastData(intent));
            return;
        }
        showOfferCardsForNewOrder(orderFromBroadcast(intent));
        refreshAvailableOrders(false);
    }

    private void showOfferCardsForNewOrder(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        rejectedOfferIds.remove(order.id);
        addPushedOrderOffer(order);
        activeMainTab = MainTab.HOME;
        playOrderAlertSound();
        vibrateOrderAlert();
        render();
        if (mainScroll != null) {
            mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
        }
    }

    private void addPushedOrderOffer(Dtos.OrderDto order) {
        for (int i = pushedOrderOffers.size() - 1; i >= 0; i--) {
            Dtos.OrderDto item = pushedOrderOffers.get(i);
            if (item != null && order.id.equals(item.id)) {
                pushedOrderOffers.remove(i);
            }
        }
        pushedOrderOffers.add(0, order);
    }

    private Dtos.OrderDto orderFromBroadcast(Intent intent) {
        Dtos.OrderDto order = new Dtos.OrderDto();
        order.id = intent.getStringExtra(OrderAlertNotifier.EXTRA_ORDER_ID);
        order.deliveryFee = OrderAlertNotifier.payout(intent);
        order.totalAmount = OrderAlertNotifier.orderTotal(intent);
        order.createdAt = intent.getStringExtra(OrderAlertNotifier.EXTRA_ORDER_CREATED_AT);
        JsonObject address = new JsonObject();
        address.addProperty("line1", OrderAlertNotifier.deliveryAddress(intent));
        address.addProperty("distanceLabel", OrderAlertNotifier.distance(intent));
        Double deliveryLat = OrderAlertNotifier.deliveryLat(intent);
        Double deliveryLng = OrderAlertNotifier.deliveryLng(intent);
        if (deliveryLat != null && deliveryLng != null) {
            JsonObject coordinates = new JsonObject();
            coordinates.addProperty("lat", deliveryLat);
            coordinates.addProperty("lng", deliveryLng);
            address.add("coordinates", coordinates);
        }
        order.addressSnapshot = address;
        return order;
    }

    private void showAcceptOrderDialog(String orderId, String deliveryAddress, String payout, String meta) {
        dismissOrderAlertDialog();
        playOrderAlertSound();
        vibrateOrderAlert();

        String message = deliveryAddress + "\n\n" + payout;
        if (meta != null && !meta.trim().isEmpty()) {
            message += " - " + meta;
        }

        orderAlertDialog = new AlertDialog.Builder(this)
                .setTitle("New delivery available")
                .setMessage(message)
                .setPositiveButton("Accept order", (dialog, which) -> claimOrder(orderId, null))
                .setNegativeButton("Not now", (dialog, which) -> stopOrderAlertSound())
                .setOnCancelListener(dialog -> stopOrderAlertSound())
                .create();
        orderAlertDialog.setOnDismissListener(dialog -> {
            stopOrderAlertSound();
            orderAlertDialog = null;
        });
        orderAlertDialog.show();
    }

    private void dismissOrderAlertDialog() {
        if (orderAlertDialog == null) {
            return;
        }
        AlertDialog dialog = orderAlertDialog;
        orderAlertDialog = null;
        if (dialog.isShowing()) {
            dialog.dismiss();
        }
    }

    private void playOrderAlertSound() {
        stopOrderAlertSound();
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            orderAlertRingtone = RingtoneManager.getRingtone(this, soundUri);
            if (orderAlertRingtone == null) {
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                orderAlertRingtone.setLooping(true);
            }
            orderAlertRingtone.play();
            handler.postDelayed(stopOrderAlertSoundRunnable, 15_000L);
        } catch (RuntimeException ignored) {
            orderAlertRingtone = null;
        }
    }

    private void stopOrderAlertSound() {
        handler.removeCallbacks(stopOrderAlertSoundRunnable);
        if (orderAlertRingtone == null) {
            return;
        }
        try {
            if (orderAlertRingtone.isPlaying()) {
                orderAlertRingtone.stop();
            }
        } catch (RuntimeException ignored) {
        }
        orderAlertRingtone = null;
    }

    private void vibrateOrderAlert() {
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0L, 450L, 220L, 450L}, -1));
        } else {
            vibrator.vibrate(1000L);
        }
    }

    private boolean isRiderIdleForOrderAlert() {
        if (!resumed || content == null || sessionStore == null || !sessionStore.isLoggedIn()) {
            return false;
        }
        if (activeOrder != null && !Dtos.isTerminal(activeOrder)) {
            return false;
        }
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        return localRider != null && "IDLE".equals(localRider.status);
    }

    private void updateRiderRuntimeState() {
        RiderRuntimeState.set(this, resumed, isRiderIdleForOrderAlert());
    }

    private java.util.HashMap<String, String> broadcastData(Intent intent) {
        java.util.HashMap<String, String> data = new java.util.HashMap<>();
        putIfPresent(data, OrderAlertNotifier.EXTRA_ORDER_ID, intent.getStringExtra(OrderAlertNotifier.EXTRA_ORDER_ID));
        putIfPresent(data, OrderAlertNotifier.EXTRA_DELIVERY_ADDRESS, intent.getStringExtra(OrderAlertNotifier.EXTRA_DELIVERY_ADDRESS));
        putIfPresent(data, OrderAlertNotifier.EXTRA_ORDER_TOTAL, intent.getStringExtra(OrderAlertNotifier.EXTRA_ORDER_TOTAL));
        putIfPresent(data, OrderAlertNotifier.EXTRA_ESTIMATED_PAYOUT, intent.getStringExtra(OrderAlertNotifier.EXTRA_ESTIMATED_PAYOUT));
        putIfPresent(data, OrderAlertNotifier.EXTRA_DELIVERY_DISTANCE, intent.getStringExtra(OrderAlertNotifier.EXTRA_DELIVERY_DISTANCE));
        putIfPresent(data, OrderAlertNotifier.EXTRA_DELIVERY_LAT, intent.getStringExtra(OrderAlertNotifier.EXTRA_DELIVERY_LAT));
        putIfPresent(data, OrderAlertNotifier.EXTRA_DELIVERY_LNG, intent.getStringExtra(OrderAlertNotifier.EXTRA_DELIVERY_LNG));
        putIfPresent(data, OrderAlertNotifier.EXTRA_DELIVERY_ACCURACY_METERS, intent.getStringExtra(OrderAlertNotifier.EXTRA_DELIVERY_ACCURACY_METERS));
        putIfPresent(data, OrderAlertNotifier.EXTRA_ORDER_CREATED_AT, intent.getStringExtra(OrderAlertNotifier.EXTRA_ORDER_CREATED_AT));
        return data;
    }

    private void putIfPresent(java.util.HashMap<String, String> data, String key, String value) {
        if (value != null) {
            data.put(key, value);
        }
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
            public void onNewAvailableOrder(Dtos.OrderDto order) {
                runOnUiThread(() -> handleNewAvailableOrderAlert(order));
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
                        if (failure.unauthorized) {
                            showLogin();
                        } else if (failure.onboardingRequired) {
                            showOnboardingRequired(failure);
                        } else {
                            render();
                        }
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
        if (!isDeviceLocationEnabled()) missing.add("device location");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) missing.add("background location");
        if (!hasNotificationPermission()) missing.add("notifications");
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
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            return false;
        }
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isDeviceLocationEnabled() {
        LocationManager locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (locationManager == null) {
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return locationManager.isLocationEnabled();
        }
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    private boolean isIgnoringBatteryOptimizations() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        return powerManager == null || powerManager.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void requestFineLocation() {
        markRuntimePromptStarted();
        ActivityCompat.requestPermissions(this, new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        }, REQ_FINE_LOCATION);
    }

    private void requestBackgroundLocation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            markRuntimePromptStarted();
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, REQ_BACKGROUND_LOCATION);
        }
    }

    private void requestNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            markRuntimePromptStarted();
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
            return;
        }
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            promptEnableNotifications();
        }
    }

    private void requestBatteryExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    private void promptRequiredRuntimeAccess() {
        if (content == null || runtimeAccessPromptActive || sessionStore == null || !sessionStore.isLoggedIn()) {
            return;
        }
        if (System.currentTimeMillis() - lastRuntimePromptAtMs < RUNTIME_PROMPT_COOLDOWN_MS) {
            return;
        }
        if (!hasFineLocationPermission()) {
            requestFineLocation();
            return;
        }
        if (!isDeviceLocationEnabled()) {
            promptEnableLocationServices();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
            requestBackgroundLocation();
            return;
        }
        if (!hasNotificationPermission()) {
            requestNotifications();
        }
    }

    private void markRuntimePromptStarted() {
        runtimeAccessPromptActive = true;
        lastRuntimePromptAtMs = System.currentTimeMillis();
    }

    private void promptEnableLocationServices() {
        markRuntimePromptStarted();
        new AlertDialog.Builder(this)
                .setTitle("Turn on location")
                .setMessage("Enable device location so the rider app can update deliveries and route progress.")
                .setPositiveButton("Open settings", (dialog, which) -> {
                    runtimeAccessPromptActive = false;
                    startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
                })
                .setNegativeButton("Not now", (dialog, which) -> runtimeAccessPromptActive = false)
                .setOnCancelListener(dialog -> runtimeAccessPromptActive = false)
                .show();
    }

    private void promptEnableNotifications() {
        markRuntimePromptStarted();
        new AlertDialog.Builder(this)
                .setTitle("Turn on notifications")
                .setMessage("Enable notifications so you receive new delivery jobs and order updates.")
                .setPositiveButton("Open settings", (dialog, which) -> {
                    runtimeAccessPromptActive = false;
                    openAppNotificationSettings();
                })
                .setNegativeButton("Not now", (dialog, which) -> runtimeAccessPromptActive = false)
                .setOnCancelListener(dialog -> runtimeAccessPromptActive = false)
                .show();
    }

    private void openAppNotificationSettings() {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + getPackageName()));
        }
        startActivity(intent);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        runtimeAccessPromptActive = false;
        if (requestCode == REQ_FINE_LOCATION && hasFineLocationPermission()) {
            if (pendingOnboardingLocationRequest) {
                pendingOnboardingLocationRequest = false;
                useCurrentLocationForAddress();
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
                requestBackgroundLocation();
            }
            publishCurrentLocationSnapshot();
            maybeStartTracking();
        }
        if (content == null) {
            renderAuthOrOnboarding();
        } else {
            render();
            handler.postDelayed(this::promptRequiredRuntimeAccess, 500L);
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

    private void openNavigation(Dtos.OrderDto order) {
        Dtos.Coordinates drop = Dtos.coordinates(order == null ? null : order.addressSnapshot);
        if (drop == null) {
            openNavigation(Dtos.deliveryAddress(order));
            return;
        }
        Uri uri = Uri.parse("google.navigation:q=" + drop.lat + "," + drop.lng + "&mode=d");
        Intent intent = new Intent(Intent.ACTION_VIEW, uri).setPackage("com.google.android.apps.maps");
        if (intent.resolveActivity(getPackageManager()) == null) {
            intent = new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + drop.lat + "," + drop.lng + "&travelmode=driving")
            );
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
            activeMainTab = MainTab.HOME;
            render();
            Toast.makeText(this, "Opened active order " + Dtos.shortOrderId(activeOrder), Toast.LENGTH_SHORT).show();
            targetOrderId = null;
            return;
        }
        if (availableOrders != null && availableOrders.items != null) {
            for (Dtos.OrderDto order : availableOrders.items) {
                if (targetOrderId.equals(order.id)) {
                    activeMainTab = MainTab.HOME;
                    render();
                    if (mainScroll != null) {
                        mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
                    }
                    Toast.makeText(this, "Order is available to claim", Toast.LENGTH_SHORT).show();
                    targetOrderId = null;
                    return;
                }
            }
        }
    }

    private NestedScrollView wrap(View view) {
        NestedScrollView scrollView = new NestedScrollView(this);
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
