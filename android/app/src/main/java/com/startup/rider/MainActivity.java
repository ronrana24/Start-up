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
import android.widget.HorizontalScrollView;
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
import com.google.android.material.bottomsheet.BottomSheetDialog;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final long ACTIVE_ORDERS_SOCKET_REFRESH_DELAY_MS = 750L;
    private static final long PERFORMANCE_REFRESH_MS = 300_000L;
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
        TRACKING,
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
    private final Runnable activeOrdersSocketRefresh = new Runnable() {
        @Override
        public void run() {
            activeOrdersRefreshScheduled = false;
            if (resumed && sessionStore != null && sessionStore.isLoggedIn()) {
                refreshActiveOrder();
            }
        }
    };

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
    private BottomSheetDialog orderDetailsSheet;
    private LinearLayout orderDetailsSheetContent;
    private Ringtone orderAlertRingtone;
    private Dtos.RiderDto rider;
    private Dtos.OrderDto activeOrder;
    private final List<Dtos.OrderDto> activeOrders = new ArrayList<>();
    private Dtos.Page<Dtos.OrderDto> availableOrders;
    private Dtos.RiderOrderHistoryResponse performanceSnapshot;
    private final Map<String, Dtos.OrderDto> orderDetailsCache = new HashMap<>();
    private final List<Dtos.OrderDto> pushedOrderOffers = new ArrayList<>();
    private final Set<String> rejectedOfferIds = new HashSet<>();
    private String selectedActiveOrderId;
    private int availablePage = 1;
    private String socketState = "disconnected";
    private String targetOrderId;
    private String lastError;
    private boolean resumed;
    private boolean locationSnapshotInFlight;
    private boolean activeOrdersRefreshScheduled;
    private boolean performanceRefreshInFlight;
    private boolean orderDetailsLoading;
    private boolean orderDetailsExpanded;
    private String orderDetailsError;
    private String openOrderDetailsId;
    private long lastPerformanceRefreshAtMs;
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
        handler.removeCallbacks(activeOrdersSocketRefresh);
        activeOrdersRefreshScheduled = false;
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
        dismissOrderDetailsSheet();
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
        dismissOrderDetailsSheet();
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
        ImageView mark = new ImageView(this);
        mark.setImageResource(com.startup.rider.R.drawable.ic_dispense_wordmark);
        mark.setAdjustViewBounds(true);
        mark.setContentDescription("Dispense.");
        mark.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 186), Ui.dp(this, 46)));
        header.addView(mark);
        Ui.gap(header, 12);
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
        dial.setTypeface(Ui.typeface(this, Typeface.NORMAL));
        dial.setTextColor(Ui.MUTED);
        TextView iso = Ui.text(this, "(IN)", 12, Typeface.BOLD);
        iso.setTypeface(Ui.typeface(this, Typeface.BOLD));
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
        phone.setTypeface(Ui.typeface(this, Typeface.NORMAL));
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
        boolean hasRiderRole = false;
        if (user != null && user.roles != null) {
            for (String role : user.roles) {
                if ("RIDER".equals(role)) {
                    hasRiderRole = true;
                    break;
                }
            }
        }
        if (!hasRiderRole) {
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
                boolean hasRiderRole = false;
                if (user != null && user.roles != null) {
                    for (String role : user.roles) {
                        if ("RIDER".equals(role)) {
                            hasRiderRole = true;
                            break;
                        }
                    }
                }
                if (!hasRiderRole) {
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
        content.setPadding(Ui.dp(this, 14), Ui.dp(this, 16) + statusBarHeight(), Ui.dp(this, 14), Ui.dp(this, 28));
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
            Dtos.OrderDto selected = selectedActiveOrder();
            if (selected != null) {
                content.addView(activeOrderCard(selected));
                Ui.gap(content, 10);
            }
            content.addView(availableOrdersCard());
        } else if (activeMainTab == MainTab.TRACKING) {
            content.addView(sectionTitle("Tracking", "Switch between active deliveries and navigate instantly."));
            Ui.gap(content, 10);
            content.addView(trackingScreen());
        } else if (activeMainTab == MainTab.ALERTS) {
            content.addView(sectionTitle("Alerts", "Keep permissions and delivery notifications ready."));
            Ui.gap(content, 10);
            content.addView(permissionCard());
            Ui.gap(content, 10);
            content.addView(alertsStatusCard());
        } else if (activeMainTab == MainTab.ACCOUNT) {
            content.addView(sectionTitle("Profile", "Rider profile, session, and device actions."));
            Ui.gap(content, 10);
            content.addView(accountCard());
            Ui.gap(content, 10);
            content.addView(actionsCard());
        } else {
            content.addView(homeHeroHeader());
            Ui.gap(content, 12);
            content.addView(performanceOverviewCards());
            Ui.gap(content, 12);
            if (riderOffline()) {
                content.addView(offlineStatusCard());
                Ui.gap(content, 12);
            }
            List<Dtos.OrderDto> offers = visibleOrderOffers();
            if (!offers.isEmpty()) {
                // Segregate so priority offers always read above standard ones.
                List<Dtos.OrderDto> priority = new ArrayList<>();
                List<Dtos.OrderDto> standard = new ArrayList<>();
                for (Dtos.OrderDto order : offers) {
                    if (Dtos.isPriority(order)) {
                        priority.add(order);
                    } else {
                        standard.add(order);
                    }
                }
                if (!priority.isEmpty()) {
                    content.addView(orderOffersCard("Priority Orders", priority, true));
                    Ui.gap(content, 12);
                }
                if (!standard.isEmpty()) {
                    content.addView(orderOffersCard("Standard Orders", standard, false));
                    Ui.gap(content, 12);
                }
            }
            if (hasActiveDeliveries()) {
                content.addView(premiumActiveDeliveriesCard());
                Ui.gap(content, 12);
            }
            content.addView(quickActionsCard());
            Ui.gap(content, 12);
            content.addView(compactRoutePreviewCard());
            if (!runtimeAccessReady()) {
                Ui.gap(content, 12);
                content.addView(permissionCard());
            }
        }
        renderBottomNav();
        updateRiderRuntimeState();
    }

    private boolean riderOffline() {
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        return localRider != null && !localRider.isAvailable;
    }

    private List<Dtos.OrderDto> visibleOrderOffers() {
        // Offline riders must not see any new-order offers, anywhere.
        if (riderOffline()) {
            return new ArrayList<>();
        }
        List<Dtos.OrderDto> offers = new ArrayList<>();
        addVisibleOffers(offers, pushedOrderOffers);
        if (availableOrders != null && availableOrders.items != null) {
            addVisibleOffers(offers, availableOrders.items);
        }
        // Client-side fallback so priority-first ordering stays stable when
        // socket-pushed offers and paginated results are merged together.
        java.util.Collections.sort(offers, Dtos.OFFER_PRIORITY_COMPARATOR);
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
            if (isActiveOrderId(order.id)) {
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
        boolean priority = Dtos.isPriority(order);

        LinearLayout box = Ui.vertical(this);
        box.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        if (priority) {
            // Subtle amber accent + tint so priority offers stand out without
            // overwhelming the list.
            box.setBackground(Ui.strokedBackground(this, Color.parseColor("#FFF7ED"), Color.parseColor("#F59E0B"), 12));
        } else {
            box.setBackground(Ui.strokedBackground(this, Ui.CARD, Ui.DEFAULT_BORDER, 12));
        }

        LinearLayout top = Ui.horizontal(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = Ui.text(this, "Order #" + Dtos.shortOrderId(order), 15, Typeface.BOLD);
        title.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView price = Ui.text(this, orderPriceLabel(order), 15, Typeface.BOLD);
        price.setTextColor(Ui.PRIMARY);
        price.setGravity(Gravity.END);
        top.addView(title);
        if (priority) {
            top.addView(priorityBadge());
            Ui.gap(top, 8);
        }
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

    private TextView priorityBadge() {
        TextView badge = Ui.text(this, "PRIORITY", 10, Typeface.BOLD);
        badge.setTextColor(Color.WHITE);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(Ui.dp(this, 8), Ui.dp(this, 3), Ui.dp(this, 8), Ui.dp(this, 3));
        badge.setBackground(Ui.roundedBackground(this, Color.parseColor("#F59E0B"), 10));
        return badge;
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

    private View homeHeroHeader() {
        MaterialCardView card = Ui.card(this);
        card.setRadius(Ui.dp(this, 24));
        card.setCardElevation(Ui.dp(this, 8));
        card.setStrokeWidth(0);
        card.setUseCompatPadding(false);
        card.setContentPadding(0, 0, 0, 0);

        LinearLayout body = Ui.vertical(this);
        body.setPadding(Ui.dp(this, 18), Ui.dp(this, 18), Ui.dp(this, 18), Ui.dp(this, 18));
        GradientDrawable heroBackground = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{
                Color.parseColor("#155A49"),
                Ui.PRIMARY,
                Color.parseColor("#56B28F")
        });
        heroBackground.setCornerRadius(Ui.dp(this, 24));
        body.setBackground(heroBackground);

        LinearLayout top = Ui.horizontal(this);
        top.setGravity(Gravity.CENTER_VERTICAL);

        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        TextView avatar = avatarView(localRider == null ? null : localRider.name);
        top.addView(avatar);
        Ui.gap(top, 12);

        LinearLayout titleBlock = Ui.vertical(this);
        titleBlock.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView greeting = Ui.text(this, greetingText(localRider), 20, Typeface.BOLD);
        greeting.setTextColor(Color.WHITE);
        titleBlock.addView(greeting);
        TextView subtitle = Ui.text(this, homeSubtitle(), 12, Typeface.NORMAL);
        subtitle.setTextColor(Color.argb(225, 255, 255, 255));
        titleBlock.addView(subtitle);
        top.addView(titleBlock);

        FrameLayout bell = iconCircle(R.drawable.ic_nav_alerts, Color.WHITE, Color.argb(38, 255, 255, 255));
        bell.setOnClickListener(v -> {
            if (!runtimeAccessReady()) {
                promptRequiredRuntimeAccess();
            } else {
                Toast.makeText(this, "Alerts are ready", Toast.LENGTH_SHORT).show();
            }
        });
        top.addView(bell);
        body.addView(top);

        Ui.gap(body, 16);
        LinearLayout statusRow = Ui.horizontal(this);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        statusRow.addView(statusToggle(localRider));
        Ui.gap(statusRow, 8);
        statusRow.addView(socketChip());
        body.addView(statusRow);

        if (lastError != null) {
            Ui.gap(body, 12);
            TextView error = Ui.text(this, lastError, 12, Typeface.BOLD);
            error.setTextColor(Color.WHITE);
            error.setBackground(Ui.roundedBackground(this, Color.argb(42, 220, 38, 38), 12));
            error.setPadding(Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8));
            body.addView(error);
        }

        card.addView(body);
        return card;
    }

    private TextView avatarView(String name) {
        TextView avatar = Ui.text(this, initials(name), 18, Typeface.BOLD);
        avatar.setTextColor(Ui.PRIMARY_DARK);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(Ui.roundedBackground(this, Color.WHITE, 28));
        avatar.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 56), Ui.dp(this, 56)));
        return avatar;
    }

    private FrameLayout iconCircle(int iconRes, int iconColor, int backgroundColor) {
        FrameLayout frame = new FrameLayout(this);
        frame.setBackground(Ui.roundedBackground(this, backgroundColor, 22));
        frame.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 44)));
        frame.setClickable(true);
        frame.setFocusable(true);
        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(iconColor);
        icon.setLayoutParams(new FrameLayout.LayoutParams(Ui.dp(this, 22), Ui.dp(this, 22), Gravity.CENTER));
        frame.addView(icon);
        return frame;
    }

    private View statusToggle(Dtos.RiderDto localRider) {
        boolean ready = runtimeAccessReady();
        boolean available = localRider == null || localRider.isAvailable;

        LinearLayout toggle = Ui.horizontal(this);
        toggle.setGravity(Gravity.CENTER_VERTICAL);
        toggle.setPadding(Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8));
        toggle.setBackground(Ui.roundedBackground(this, Color.argb(44, 255, 255, 255), 20));
        toggle.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        toggle.setClickable(true);
        toggle.setFocusable(true);
        toggle.setOnClickListener(v -> {
            if (!runtimeAccessReady()) {
                promptRequiredRuntimeAccess();
                return;
            }
            if (riderOffline()) {
                setRiderAvailability(true);
            } else {
                confirmGoOffline();
            }
        });

        View dot = new View(this);
        int dotColor;
        if (!ready) {
            dotColor = Color.parseColor("#FDE68A");
        } else if (available) {
            dotColor = Color.parseColor("#86EFAC");
        } else {
            dotColor = Color.parseColor("#FCA5A5");
        }
        dot.setBackground(Ui.roundedBackground(this, dotColor, 5));
        dot.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 10), Ui.dp(this, 10)));
        toggle.addView(dot);
        Ui.gap(toggle, 8);

        String label;
        if (!ready) {
            label = "Setup needed";
        } else if (!available) {
            label = "Offline";
        } else if (hasActiveDeliveries() || (localRider != null && "BUSY".equals(localRider.status))) {
            label = "Online · Busy";
        } else {
            label = "Online";
        }
        TextView text = Ui.text(this, label, 12, Typeface.BOLD);
        text.setTextColor(Color.WHITE);
        toggle.addView(text);
        return toggle;
    }

    private void confirmGoOffline() {
        new AlertDialog.Builder(this)
                .setTitle("Go offline?")
                .setMessage("You won't receive new orders while offline. Deliveries already in progress stay active.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Go offline", (dialog, which) -> setRiderAvailability(false))
                .show();
    }

    /**
     * Persists the rider's availability toggle. Applies optimistically for an
     * instant response, then reverts if the backend call fails. The DB is the
     * source of truth, so the choice survives restarts/logout/devices.
     */
    private void setRiderAvailability(boolean target) {
        Dtos.RiderDto current = rider == null ? sessionStore.rider() : rider;
        if (current != null && current.isAvailable == target) {
            return;
        }
        if (current != null) {
            current.isAvailable = target;
            rider = current;
            sessionStore.updateRider(current);
        }
        render();
        if (target) {
            publishCurrentLocationSnapshot();
        }
        repository.setAvailability(target, new UiResult<Dtos.RiderDto>() {
            @Override
            public void success(Dtos.RiderDto value) {
                if (value != null) {
                    rider = value;
                }
                render();
                Toast.makeText(MainActivity.this,
                        target ? "You're online for new orders" : "You're offline",
                        Toast.LENGTH_SHORT).show();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                Dtos.RiderDto reverted = rider == null ? sessionStore.rider() : rider;
                if (reverted != null) {
                    reverted.isAvailable = !target;
                    rider = reverted;
                    sessionStore.updateRider(reverted);
                }
                render();
                String message = failure != null && failure.message != null
                        ? failure.message
                        : "Could not update availability. Try again.";
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private View socketChip() {
        TextView chip = Ui.text(this, "Live " + socketState, 12, Typeface.BOLD);
        chip.setSingleLine(true);
        chip.setTextColor(Color.WHITE);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8));
        chip.setBackground(Ui.roundedBackground(this, Color.argb(34, 255, 255, 255), 20));
        chip.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return chip;
    }

    private String greetingText(Dtos.RiderDto localRider) {
        String firstName = localRider == null || localRider.name == null ? "Rider" : localRider.name.trim().split("\\s+")[0];
        return "Hi, " + (firstName.isEmpty() ? "Rider" : firstName);
    }

    private String homeSubtitle() {
        if (hasActiveDeliveries()) {
            return activeOrders.size() + " active " + (activeOrders.size() == 1 ? "delivery" : "deliveries") + " in progress";
        }
        int availableCount = availableOrders == null ? 0 : availableOrders.total;
        return availableCount > 0 ? availableCount + " new delivery opportunities nearby" : "Ready for the next delivery";
    }

    private String initials(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "R";
        }
        String[] parts = name.trim().split("\\s+");
        String first = parts[0].substring(0, 1);
        String second = parts.length > 1 ? parts[1].substring(0, 1) : "";
        return (first + second).toUpperCase(Locale.US);
    }

    private View performanceOverviewCards() {
        LinearLayout root = Ui.vertical(this);
        LinearLayout firstRow = Ui.horizontal(this);
        firstRow.addView(metricCard(
                "Deliveries",
                performanceDeliveriesLabel(),
                "Completed",
                Ui.PRIMARY_LIGHT,
                Ui.PRIMARY
        ));
        Ui.gap(firstRow, 10);
        firstRow.addView(metricCard(
                "Active",
                String.valueOf(activeOrders.size()),
                "Now assigned",
                Color.parseColor("#EEF2FF"),
                Color.parseColor("#4F46E5")
        ));
        root.addView(firstRow);
        Ui.gap(root, 10);

        LinearLayout secondRow = Ui.horizontal(this);
        secondRow.addView(metricCard(
                "Success rate",
                performanceSuccessRateLabel(),
                "Delivered jobs",
                Color.parseColor("#ECFDF5"),
                Color.parseColor("#059669")
        ));
        Ui.gap(secondRow, 10);
        secondRow.addView(metricCard(
                "Distance",
                performanceDistanceLabel(),
                "Recent delivered",
                Color.parseColor("#FFF7ED"),
                Color.parseColor("#EA580C")
        ));
        root.addView(secondRow);
        return root;
    }

    private View metricCard(String title, String value, String subtitle, int background, int accent) {
        MaterialCardView card = Ui.card(this);
        card.setRadius(Ui.dp(this, 18));
        card.setCardElevation(Ui.dp(this, 3));
        card.setStrokeWidth(0);
        card.setCardBackgroundColor(background);
        card.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        LinearLayout body = Ui.vertical(this);
        body.setPadding(Ui.dp(this, 2), Ui.dp(this, 2), Ui.dp(this, 2), Ui.dp(this, 2));
        TextView titleView = Ui.text(this, title, 11, Typeface.BOLD);
        titleView.setTextColor(Ui.SECONDARY);
        body.addView(titleView);
        TextView valueView = Ui.text(this, value, 24, Typeface.BOLD);
        valueView.setTextColor(accent);
        body.addView(valueView);
        TextView subtitleView = Ui.text(this, subtitle, 11, Typeface.NORMAL);
        subtitleView.setTextColor(Ui.SECONDARY);
        body.addView(subtitleView);
        card.addView(body);
        return card;
    }

    private View premiumActiveDeliveriesCard() {
        MaterialCardView card = Ui.card(this);
        card.setRadius(Ui.dp(this, 20));
        card.setCardElevation(Ui.dp(this, 4));
        LinearLayout body = Ui.vertical(this);

        LinearLayout top = Ui.horizontal(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout copy = Ui.vertical(this);
        copy.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        copy.addView(Ui.text(this, "Active deliveries", 18, Typeface.BOLD));
        TextView subtitle = Ui.text(this, "Swipe to switch routes without losing tracking.", 12, Typeface.NORMAL);
        subtitle.setTextColor(Ui.SECONDARY);
        copy.addView(subtitle);
        top.addView(copy);
        TextView count = Ui.text(this, String.valueOf(activeOrders.size()), 18, Typeface.BOLD);
        count.setTextColor(Ui.PRIMARY);
        count.setGravity(Gravity.CENTER);
        count.setBackground(Ui.roundedBackground(this, Ui.PRIMARY_LIGHT, 18));
        count.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 42), Ui.dp(this, 42)));
        top.addView(count);
        body.addView(top);

        Ui.gap(body, 12);
        body.addView(activeDeliveryPillsScroller());
        Ui.gap(body, 12);
        LinearLayout buttons = Ui.horizontal(this);
        MaterialButton tracking = Ui.button(this, "Tracking");
        tracking.setLayoutParams(weightedButtonParams());
        bindAction(tracking, () -> {
            activeMainTab = MainTab.TRACKING;
            render();
            if (mainScroll != null) {
                mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
            }
        });
        MaterialButton route = Ui.secondaryButton(this, "Route");
        route.setLayoutParams(weightedButtonParams());
        bindAction(route, () -> {
            Dtos.OrderDto selected = selectedActiveOrder();
            if (selected == null) {
                Toast.makeText(this, "No active delivery selected", Toast.LENGTH_SHORT).show();
            } else {
                openRoutePreview(selected);
            }
        });
        buttons.addView(tracking);
        Ui.gap(buttons, 8);
        buttons.addView(route);
        body.addView(buttons);
        card.addView(body);
        return card;
    }

    private View quickActionsCard() {
        MaterialCardView card = Ui.card(this);
        card.setRadius(Ui.dp(this, 20));
        card.setCardElevation(Ui.dp(this, 3));
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Quick actions", 18, Typeface.BOLD));
        TextView copy = Ui.text(this, "Common rider tasks kept within thumb reach.", 12, Typeface.NORMAL);
        copy.setTextColor(Ui.SECONDARY);
        body.addView(copy);
        Ui.gap(body, 12);

        LinearLayout firstRow = Ui.horizontal(this);
        firstRow.addView(quickActionTile("Navigate", "Selected drop", R.drawable.ic_nav_tracking, () -> {
            Dtos.OrderDto selected = selectedActiveOrder();
            if (selected == null) {
                Toast.makeText(this, "Accept or select a delivery first", Toast.LENGTH_SHORT).show();
            } else {
                openNavigation(selected);
            }
        }));
        Ui.gap(firstRow, 8);
        firstRow.addView(quickActionTile("Call", "Customer", R.drawable.ic_nav_account, () -> callSelectedCustomer()));
        body.addView(firstRow);
        Ui.gap(body, 8);

        LinearLayout secondRow = Ui.horizontal(this);
        secondRow.addView(quickActionTile("Tracking", "Live queue", R.drawable.ic_nav_home, () -> {
            activeMainTab = MainTab.TRACKING;
            render();
            if (mainScroll != null) {
                mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
            }
        }));
        Ui.gap(secondRow, 8);
        secondRow.addView(quickActionTile("History", "Completed", R.drawable.ic_nav_orders, this::openOrderHistory));
        body.addView(secondRow);

        card.addView(body);
        return card;
    }

    private View quickActionTile(String title, String subtitle, int iconRes, Runnable action) {
        LinearLayout tile = Ui.horizontal(this);
        tile.setGravity(Gravity.CENTER_VERTICAL);
        tile.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        tile.setBackground(Ui.strokedBackground(this, Ui.INPUT_BG, Ui.DEFAULT_BORDER, 16));
        tile.setClickable(true);
        tile.setFocusable(true);
        tile.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        tile.setOnClickListener(v -> {
            v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(70L).withEndAction(() ->
                    v.animate().scaleX(1f).scaleY(1f).setDuration(90L).start()
            ).start();
            handler.post(action);
        });

        FrameLayout icon = iconCircle(iconRes, Ui.PRIMARY, Ui.PRIMARY_LIGHT);
        icon.setClickable(false);
        icon.setFocusable(false);
        tile.addView(icon);
        Ui.gap(tile, 10);

        LinearLayout copy = Ui.vertical(this);
        copy.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        copy.addView(Ui.text(this, title, 13, Typeface.BOLD));
        TextView sub = Ui.text(this, subtitle, 11, Typeface.NORMAL);
        sub.setTextColor(Ui.MUTED);
        copy.addView(sub);
        tile.addView(copy);
        return tile;
    }

    private View compactRoutePreviewCard() {
        MaterialCardView card = Ui.card(this);
        card.setRadius(Ui.dp(this, 22));
        card.setCardElevation(Ui.dp(this, 4));
        card.setContentPadding(0, 0, 0, 0);

        LinearLayout body = Ui.vertical(this);
        body.setPadding(Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14));
        GradientDrawable previewBackground = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{
                Color.WHITE,
                Color.parseColor("#F1F8F6")
        });
        previewBackground.setCornerRadius(Ui.dp(this, 22));
        body.setBackground(previewBackground);

        LinearLayout top = Ui.horizontal(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout copy = Ui.vertical(this);
        copy.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        copy.addView(Ui.text(this, "Live route preview", 18, Typeface.BOLD));
        TextView sub = Ui.text(this, hasActiveDeliveries() ? "Selected delivery updates as tracking changes." : "Active routes appear here after accepting an order.", 12, Typeface.NORMAL);
        sub.setTextColor(Ui.SECONDARY);
        copy.addView(sub);
        top.addView(copy);
        body.addView(top);
        Ui.gap(body, 12);

        body.addView(routeCanvas());
        Ui.gap(body, 12);
        MaterialButton open = Ui.secondaryButton(this, hasActiveDeliveries() ? "Open route preview" : "Refresh location");
        bindAction(open, () -> {
            Dtos.OrderDto selected = selectedActiveOrder();
            if (selected == null) {
                publishCurrentLocationSnapshot();
            } else {
                openRoutePreview(selected);
            }
        });
        body.addView(open);

        card.addView(body);
        return card;
    }

    private View routeCanvas() {
        FrameLayout map = new FrameLayout(this);
        GradientDrawable mapBackground = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{
                Color.parseColor("#DFF7EF"),
                Color.parseColor("#F8FAFC"),
                Color.parseColor("#E0F2FE")
        });
        mapBackground.setCornerRadius(Ui.dp(this, 18));
        map.setBackground(mapBackground);
        map.setMinimumHeight(Ui.dp(this, 168));
        map.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 168)));
        map.setPadding(Ui.dp(this, 16), Ui.dp(this, 16), Ui.dp(this, 16), Ui.dp(this, 16));

        View route = new View(this);
        route.setBackground(Ui.roundedBackground(this, Color.argb(185, 31, 122, 99), 3));
        FrameLayout.LayoutParams routeParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Ui.dp(this, 5),
                Gravity.CENTER
        );
        routeParams.setMargins(Ui.dp(this, 46), 0, Ui.dp(this, 46), 0);
        map.addView(route, routeParams);

        map.addView(mapMarker("You", Ui.PRIMARY, Gravity.START | Gravity.CENTER_VERTICAL, Ui.dp(this, 18), 0));
        map.addView(mapMarker("Drop", Color.parseColor("#EA580C"), Gravity.END | Gravity.CENTER_VERTICAL, 0, Ui.dp(this, 18)));

        LinearLayout details = Ui.vertical(this);
        details.setPadding(Ui.dp(this, 10), Ui.dp(this, 8), Ui.dp(this, 10), Ui.dp(this, 8));
        details.setBackground(Ui.roundedBackground(this, Color.argb(235, 255, 255, 255), 14));
        Dtos.OrderDto selected = selectedActiveOrder();
        details.addView(Ui.text(this, selected == null ? "No selected delivery" : "#" + Dtos.shortOrderId(selected), 13, Typeface.BOLD));
        TextView eta = Ui.text(this, selected == null ? "Accept an order to see route ETA" : offerDistanceEta(selected), 12, Typeface.NORMAL);
        eta.setTextColor(Ui.SECONDARY);
        details.addView(eta);
        FrameLayout.LayoutParams detailParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );
        detailParams.setMargins(0, 0, 0, Ui.dp(this, 12));
        map.addView(details, detailParams);
        return map;
    }

    private View mapMarker(String label, int color, int gravity, int leftMargin, int rightMargin) {
        LinearLayout marker = Ui.vertical(this);
        marker.setGravity(Gravity.CENTER);
        View dot = new View(this);
        dot.setBackground(Ui.roundedBackground(this, color, 10));
        dot.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 20), Ui.dp(this, 20)));
        marker.addView(dot);
        TextView text = Ui.text(this, label, 11, Typeface.BOLD);
        text.setTextColor(Ui.HEADING);
        text.setGravity(Gravity.CENTER);
        text.setBackground(Ui.roundedBackground(this, Color.argb(220, 255, 255, 255), 10));
        text.setPadding(Ui.dp(this, 8), Ui.dp(this, 4), Ui.dp(this, 8), Ui.dp(this, 4));
        marker.addView(text);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                gravity
        );
        params.setMargins(leftMargin, 0, rightMargin, 0);
        marker.setLayoutParams(params);
        return marker;
    }

    private void callSelectedCustomer() {
        Dtos.OrderDto selected = selectedActiveOrder();
        String phone = selected == null || selected.user == null ? null : selected.user.phone;
        if (phone == null || phone.trim().isEmpty()) {
            Toast.makeText(this, "Customer phone is not available for this order", Toast.LENGTH_SHORT).show();
            return;
        }
        startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone.trim()))));
    }

    private boolean runtimeAccessReady() {
        return hasFineLocationPermission()
                && isDeviceLocationEnabled()
                && hasNotificationPermission()
                && isIgnoringBatteryOptimizations();
    }

    private String performanceDeliveriesLabel() {
        Dtos.RiderOrderHistorySummary summary = performanceSnapshot == null ? null : performanceSnapshot.summary;
        return summary == null ? "--" : String.valueOf(summary.totalDeliveries);
    }

    private String performanceSuccessRateLabel() {
        Dtos.RiderOrderHistorySummary summary = performanceSnapshot == null ? null : performanceSnapshot.summary;
        if (summary == null || summary.totalDeliveries <= 0) {
            return "--";
        }
        int rate = Math.round((summary.completedOrders * 100f) / Math.max(1, summary.totalDeliveries));
        return Math.min(100, Math.max(0, rate)) + "%";
    }

    private String performanceDistanceLabel() {
        if (performanceSnapshot == null || performanceSnapshot.orders == null || performanceSnapshot.orders.items == null) {
            return "--";
        }
        double totalKm = 0d;
        for (Dtos.RiderHistoryOrderDto order : performanceSnapshot.orders.items) {
            if (order == null || order.deliveryDistanceKm == null || order.deliveryDistanceKm.trim().isEmpty()) {
                continue;
            }
            try {
                totalKm += Double.parseDouble(order.deliveryDistanceKm.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        return totalKm <= 0d ? "--" : String.format(Locale.US, "%.1f km", totalKm);
    }

    private View trackingScreen() {
        LinearLayout root = Ui.vertical(this);
        if (!hasActiveDeliveries()) {
            root.addView(trackingEmptyState());
            return root;
        }

        root.addView(activeDeliveryPillsCard());
        Ui.gap(root, 10);
        Dtos.OrderDto selected = selectedActiveOrder();
        if (selected != null) {
            root.addView(activeOrderCard(selected));
        }
        return root;
    }

    private View activeDeliveriesSummaryCard() {
        MaterialCardView card = Ui.card(this);
        card.setCardBackgroundColor(Ui.PRIMARY_LIGHT);
        card.setStrokeColor(Ui.PRIMARY);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Active deliveries (" + activeOrders.size() + ")", 18, Typeface.BOLD));
        TextView copy = Ui.text(this, "Tracking is running. Switch to any active order for route preview or navigation.", 12, Typeface.NORMAL);
        copy.setTextColor(Ui.SECONDARY);
        body.addView(copy);
        Ui.gap(body, 10);
        body.addView(activeDeliveryPillsScroller());
        Ui.gap(body, 10);
        MaterialButton open = Ui.button(this, "Open tracking");
        bindAction(open, () -> {
            activeMainTab = MainTab.TRACKING;
            render();
            if (mainScroll != null) {
                mainScroll.post(() -> mainScroll.smoothScrollTo(0, 0));
            }
        });
        body.addView(open);
        card.addView(body);
        return card;
    }

    private View activeDeliveryPillsCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Active order queue", 18, Typeface.BOLD));
        TextView copy = Ui.text(this, "Each pill keeps its own status, route, and delivery actions.", 12, Typeface.NORMAL);
        copy.setTextColor(Ui.SECONDARY);
        body.addView(copy);
        Ui.gap(body, 12);
        body.addView(activeDeliveryPillsScroller());
        card.addView(body);
        return card;
    }

    private View activeDeliveryPillsScroller() {
        HorizontalScrollView scroll = new HorizontalScrollView(this);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setFillViewport(false);
        LinearLayout row = Ui.horizontal(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, 0, Ui.dp(this, 2), 0);
        for (Dtos.OrderDto order : activeOrders) {
            row.addView(activeDeliveryPill(order));
            Ui.gap(row, 8);
        }
        scroll.addView(row);
        return scroll;
    }

    private View activeDeliveryPill(Dtos.OrderDto order) {
        boolean selected = order != null && order.id != null && order.id.equals(selectedActiveOrderId);
        LinearLayout pill = Ui.vertical(this);
        pill.setPadding(Ui.dp(this, 12), Ui.dp(this, 10), Ui.dp(this, 12), Ui.dp(this, 10));
        pill.setMinimumWidth(Ui.dp(this, 214));
        pill.setBackground(Ui.strokedBackground(
                this,
                selected ? Ui.PRIMARY_LIGHT : Ui.CARD,
                selected ? Ui.PRIMARY : Ui.DEFAULT_BORDER,
                14
        ));
        pill.setClickable(true);
        pill.setFocusable(true);
        pill.setOnClickListener(v -> openActiveOrderDetails(order));

        LinearLayout top = Ui.horizontal(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView id = Ui.text(this, "#" + Dtos.shortOrderId(order), 14, Typeface.BOLD);
        id.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView status = Ui.text(this, Dtos.statusLabel(order == null ? null : order.status), 11, Typeface.BOLD);
        status.setTextColor(selected ? Ui.PRIMARY : Ui.SECONDARY);
        status.setGravity(Gravity.END);
        top.addView(id);
        top.addView(status);
        pill.addView(top);

        TextView customer = Ui.text(this, Dtos.customerName(order), 12, Typeface.NORMAL);
        customer.setTextColor(Ui.HEADING);
        pill.addView(customer);
        TextView metrics = Ui.text(this, offerDistanceEta(order), 12, Typeface.BOLD);
        metrics.setTextColor(Ui.SECONDARY);
        pill.addView(metrics);
        Ui.gap(pill, 8);
        MaterialButton navigate = Ui.secondaryButton(this, "Navigate");
        navigate.setMinWidth(0);
        bindAction(navigate, () -> {
            selectActiveOrder(order);
            openNavigation(order);
        });
        pill.addView(navigate);
        return pill;
    }

    private View trackingEmptyState() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.setGravity(Gravity.CENTER_HORIZONTAL);
        body.setPadding(Ui.dp(this, 10), Ui.dp(this, 24), Ui.dp(this, 10), Ui.dp(this, 24));
        FrameLayout badge = new FrameLayout(this);
        badge.setBackground(Ui.roundedBackground(this, Ui.PRIMARY_LIGHT, 32));
        badge.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 64), Ui.dp(this, 64)));
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_nav_tracking);
        icon.setColorFilter(Ui.PRIMARY);
        icon.setLayoutParams(new FrameLayout.LayoutParams(Ui.dp(this, 34), Ui.dp(this, 34), Gravity.CENTER));
        badge.addView(icon);
        body.addView(badge);
        Ui.gap(body, 16);
        TextView title = Ui.text(this, "No active deliveries available.", 19, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        body.addView(title);
        TextView copy = Ui.text(this, "You have completed all assigned orders. New accepted deliveries will appear here automatically.", 13, Typeface.NORMAL);
        copy.setGravity(Gravity.CENTER);
        copy.setTextColor(Ui.SECONDARY);
        body.addView(copy);
        Ui.gap(body, 18);
        MaterialButton refresh = Ui.button(this, "Check for orders");
        bindAction(refresh, () -> refreshData(true));
        body.addView(refresh);
        card.addView(body);
        return card;
    }

    private boolean hasActiveDeliveries() {
        return !activeOrders.isEmpty();
    }

    private Dtos.OrderDto selectedActiveOrder() {
        if (selectedActiveOrderId != null) {
            for (Dtos.OrderDto order : activeOrders) {
                if (order != null && selectedActiveOrderId.equals(order.id)) {
                    activeOrder = order;
                    return order;
                }
            }
        }
        if (activeOrder != null && !Dtos.isTerminal(activeOrder)) {
            return activeOrder;
        }
        return activeOrders.isEmpty() ? null : activeOrders.get(0);
    }

    private boolean isActiveOrderId(String orderId) {
        if (orderId == null) {
            return false;
        }
        for (Dtos.OrderDto order : activeOrders) {
            if (order != null && orderId.equals(order.id)) {
                return true;
            }
        }
        return activeOrder != null && orderId.equals(activeOrder.id) && !Dtos.isTerminal(activeOrder);
    }

    private void replaceActiveOrders(List<Dtos.OrderDto> orders) {
        activeOrders.clear();
        Set<String> seen = new HashSet<>();
        if (orders != null) {
            for (Dtos.OrderDto order : orders) {
                if (order == null || order.id == null || Dtos.isTerminal(order) || seen.contains(order.id)) {
                    continue;
                }
                cacheOrderDetails(order);
                activeOrders.add(order);
                seen.add(order.id);
            }
        }
        autoSelectActiveOrder();
    }

    private void upsertActiveOrder(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        if (Dtos.isTerminal(order)) {
            removeActiveOrder(order.id);
            return;
        }
        for (int i = 0; i < activeOrders.size(); i++) {
            Dtos.OrderDto item = activeOrders.get(i);
            if (item != null && order.id.equals(item.id)) {
                cacheOrderDetails(order);
                activeOrders.set(i, order);
                autoSelectActiveOrder();
                return;
            }
        }
        cacheOrderDetails(order);
        activeOrders.add(order);
        selectedActiveOrderId = order.id;
        autoSelectActiveOrder();
    }

    private void removeActiveOrder(String orderId) {
        if (orderId == null) {
            return;
        }
        for (int i = activeOrders.size() - 1; i >= 0; i--) {
            Dtos.OrderDto item = activeOrders.get(i);
            if (item != null && orderId.equals(item.id)) {
                activeOrders.remove(i);
            }
        }
        if (orderId.equals(selectedActiveOrderId)) {
            selectedActiveOrderId = null;
        }
        if (orderDetailsSheet != null && orderId.equals(openOrderDetailsId)) {
            renderOrderDetailsSheet(orderDetailsCache.get(orderId), false, "This order is no longer active. It may have been completed or cancelled.");
        }
        autoSelectActiveOrder();
    }

    private void selectActiveOrder(Dtos.OrderDto order) {
        if (order == null || order.id == null || Dtos.isTerminal(order)) {
            return;
        }
        selectedActiveOrderId = order.id;
        activeOrder = order;
        render();
    }

    private void openActiveOrderDetails(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            Toast.makeText(this, "Order details are not available yet", Toast.LENGTH_SHORT).show();
            return;
        }
        selectedActiveOrderId = order.id;
        activeOrder = order;
        cacheOrderDetails(order);
        orderDetailsExpanded = false;
        orderDetailsError = null;
        openOrderDetailsId = order.id;
        render();
        showOrderDetailsSheet(cachedOrderDetails(order.id));
        fetchOrderDetails(order.id);
    }

    private void showOrderDetailsSheet(Dtos.OrderDto order) {
        if (orderDetailsSheet == null) {
            orderDetailsSheet = new BottomSheetDialog(this);
            NestedScrollView scroll = new NestedScrollView(this);
            scroll.setFillViewport(false);
            scroll.setClipToPadding(false);
            scroll.setPadding(0, 0, 0, Ui.dp(this, 12));
            orderDetailsSheetContent = Ui.vertical(this);
            orderDetailsSheetContent.setPadding(Ui.dp(this, 16), Ui.dp(this, 12), Ui.dp(this, 16), Ui.dp(this, 20));
            orderDetailsSheetContent.setLayoutParams(new NestedScrollView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            ));
            scroll.addView(orderDetailsSheetContent);
            orderDetailsSheet.setContentView(scroll);
            orderDetailsSheet.setOnDismissListener(dialog -> {
                orderDetailsSheet = null;
                orderDetailsSheetContent = null;
                orderDetailsLoading = false;
                orderDetailsExpanded = false;
                orderDetailsError = null;
                openOrderDetailsId = null;
            });
        }
        renderOrderDetailsSheet(order, orderDetailsLoading, orderDetailsError);
        if (!orderDetailsSheet.isShowing()) {
            orderDetailsSheet.show();
        }
    }

    private void dismissOrderDetailsSheet() {
        if (orderDetailsSheet != null) {
            orderDetailsSheet.dismiss();
        }
        orderDetailsSheet = null;
        orderDetailsSheetContent = null;
        orderDetailsLoading = false;
        orderDetailsExpanded = false;
        orderDetailsError = null;
        openOrderDetailsId = null;
    }

    private void fetchOrderDetails(String orderId) {
        if (repository == null || orderId == null || orderId.trim().isEmpty()) {
            return;
        }
        orderDetailsLoading = true;
        renderOrderDetailsSheet(cachedOrderDetails(orderId), true, null);
        repository.orderDetails(orderId, new UiResult<Dtos.OrderDto>() {
            @Override
            public void success(Dtos.OrderDto value) {
                orderDetailsLoading = false;
                orderDetailsError = null;
                if (value != null) {
                    upsertActiveOrder(value);
                    cacheOrderDetails(value);
                }
                if (orderId.equals(openOrderDetailsId)) {
                    renderOrderDetailsSheet(cachedOrderDetails(orderId), false, null);
                }
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                orderDetailsLoading = false;
                orderDetailsError = friendlyFailure(failure, "Could not refresh order details");
                if (failure != null && failure.unauthorized) {
                    sessionStore.clear();
                    showLogin();
                    return;
                }
                if (orderId.equals(openOrderDetailsId)) {
                    renderOrderDetailsSheet(cachedOrderDetails(orderId), false, orderDetailsError);
                }
            }
        });
    }

    private void renderOrderDetailsSheet(Dtos.OrderDto order, boolean loading, String error) {
        if (orderDetailsSheetContent == null) {
            return;
        }
        orderDetailsSheetContent.removeAllViews();

        if (order == null) {
            orderDetailsSheetContent.addView(Ui.text(this, "Loading order details", 20, Typeface.BOLD));
            Ui.gap(orderDetailsSheetContent, 12);
            ProgressBar progress = new ProgressBar(this);
            progress.setIndeterminate(true);
            progress.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 36), Ui.dp(this, 36)));
            orderDetailsSheetContent.addView(progress);
            return;
        }

        orderDetailsSheetContent.addView(orderDetailsHeader(order, loading));
        if (error != null && !error.trim().isEmpty()) {
            Ui.gap(orderDetailsSheetContent, 10);
            orderDetailsSheetContent.addView(orderDetailsNotice(error, Ui.ERROR, Color.parseColor("#FEE2E2")));
        }

        Ui.gap(orderDetailsSheetContent, 12);
        orderDetailsSheetContent.addView(orderBuyerSection(order));
        Ui.gap(orderDetailsSheetContent, 12);
        orderDetailsSheetContent.addView(orderInstructionsSection(order));
        Ui.gap(orderDetailsSheetContent, 12);
        orderDetailsSheetContent.addView(orderItemsSection(order, loading));
        Ui.gap(orderDetailsSheetContent, 12);
        orderDetailsSheetContent.addView(orderTotalsSection(order));
        Ui.gap(orderDetailsSheetContent, 14);
        orderDetailsSheetContent.addView(orderDetailsActions(order));
    }

    private View orderDetailsHeader(Dtos.OrderDto order, boolean loading) {
        LinearLayout root = Ui.vertical(this);
        LinearLayout row = Ui.horizontal(this);
        row.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout titleBlock = Ui.vertical(this);
        titleBlock.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        titleBlock.addView(Ui.text(this, "Order #" + Dtos.shortOrderId(order), 22, Typeface.BOLD));
        TextView status = Ui.text(this, Dtos.statusLabel(order.status), 12, Typeface.BOLD);
        status.setTextColor(statusColor(order.status));
        status.setPadding(Ui.dp(this, 10), Ui.dp(this, 5), Ui.dp(this, 10), Ui.dp(this, 5));
        status.setBackground(Ui.roundedBackground(this, statusBackground(order.status), 14));
        titleBlock.addView(status);
        row.addView(titleBlock);

        MaterialButton close = Ui.secondaryButton(this, "Close");
        close.setMinWidth(0);
        close.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(this, 40)));
        bindAction(close, this::dismissOrderDetailsSheet);
        row.addView(close);
        root.addView(row);

        if (loading) {
            Ui.gap(root, 10);
            LinearLayout refresh = Ui.horizontal(this);
            refresh.setGravity(Gravity.CENTER_VERTICAL);
            ProgressBar progress = new ProgressBar(this);
            progress.setIndeterminate(true);
            progress.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 24), Ui.dp(this, 24)));
            refresh.addView(progress);
            Ui.gap(refresh, 8);
            TextView copy = Ui.text(this, "Refreshing latest buyer order details...", 12, Typeface.NORMAL);
            copy.setTextColor(Ui.SECONDARY);
            refresh.addView(copy);
            root.addView(refresh);
        }
        return root;
    }

    private View orderBuyerSection(Dtos.OrderDto order) {
        LinearLayout body = detailSection("Buyer and drop");
        body.addView(detailRow("Buyer", Dtos.customerName(order)));
        Ui.gap(body, 8);
        body.addView(detailRow("Address", Dtos.deliveryAddress(order)));
        if (order.user != null && order.user.phone != null && !order.user.phone.trim().isEmpty()) {
            Ui.gap(body, 8);
            body.addView(detailRow("Phone", order.user.phone.trim()));
        }
        return body;
    }

    private View orderInstructionsSection(Dtos.OrderDto order) {
        String instructions = orderInstructions(order);
        int background = instructions.isEmpty() ? Ui.INPUT_BG : Color.parseColor("#FFF7ED");
        int accent = instructions.isEmpty() ? Ui.SECONDARY : Color.parseColor("#C2410C");
        LinearLayout body = detailSection("Delivery notes");
        TextView note = Ui.text(
                this,
                instructions.isEmpty() ? "No buyer delivery notes provided." : instructions,
                13,
                instructions.isEmpty() ? Typeface.NORMAL : Typeface.BOLD
        );
        note.setTextColor(accent);
        note.setPadding(Ui.dp(this, 12), Ui.dp(this, 10), Ui.dp(this, 12), Ui.dp(this, 10));
        note.setBackground(Ui.strokedBackground(this, background, instructions.isEmpty() ? Ui.DEFAULT_BORDER : Color.parseColor("#FDBA74"), 12));
        body.addView(note);
        return body;
    }

    private View orderItemsSection(Dtos.OrderDto order, boolean loading) {
        List<Dtos.OrderItemDto> items = order.items == null ? new ArrayList<>() : order.items;
        LinearLayout body = detailSection("Items to verify");
        TextView summary = Ui.text(this, items.size() + " products • " + totalItemQuantity(items) + " units", 12, Typeface.BOLD);
        summary.setTextColor(Ui.PRIMARY);
        body.addView(summary);
        Ui.gap(body, 10);

        if (items.isEmpty()) {
            body.addView(orderDetailsNotice(
                    loading ? "Loading buyer item details..." : "Item details are unavailable offline. They will refresh automatically when the network returns.",
                    Ui.SECONDARY,
                    Ui.INPUT_BG
            ));
            return body;
        }

        int visibleCount = orderDetailsExpanded ? items.size() : Math.min(items.size(), 6);
        for (int i = 0; i < visibleCount; i++) {
            if (i > 0) {
                Ui.gap(body, 8);
            }
            body.addView(orderItemRow(items.get(i)));
        }

        if (items.size() > visibleCount) {
            Ui.gap(body, 10);
            MaterialButton showAll = Ui.secondaryButton(this, "Show all " + items.size() + " items");
            bindAction(showAll, () -> {
                orderDetailsExpanded = true;
                renderOrderDetailsSheet(order, orderDetailsLoading, orderDetailsError);
            });
            body.addView(showAll);
        }
        return body;
    }

    private View orderItemRow(Dtos.OrderItemDto item) {
        LinearLayout row = Ui.horizontal(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        row.setBackground(Ui.strokedBackground(this, Ui.CARD, Ui.DEFAULT_BORDER, 14));

        TextView qty = Ui.text(this, "x" + Math.max(0, item == null ? 0 : item.quantity), 14, Typeface.BOLD);
        qty.setTextColor(Ui.PRIMARY);
        qty.setGravity(Gravity.CENTER);
        qty.setBackground(Ui.roundedBackground(this, Ui.PRIMARY_LIGHT, 16));
        qty.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 44)));
        row.addView(qty);
        Ui.gap(row, 12);

        LinearLayout copy = Ui.vertical(this);
        copy.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        copy.addView(Ui.text(this, itemProductName(item), 14, Typeface.BOLD));
        String meta = itemProductMeta(item);
        if (!meta.isEmpty()) {
            TextView metaView = Ui.text(this, meta, 12, Typeface.NORMAL);
            metaView.setTextColor(Ui.SECONDARY);
            copy.addView(metaView);
        }
        TextView price = Ui.text(this, itemLineTotal(item), 12, Typeface.BOLD);
        price.setTextColor(Ui.PRIMARY);
        copy.addView(price);
        row.addView(copy);
        return row;
    }

    private View orderTotalsSection(Dtos.OrderDto order) {
        LinearLayout body = detailSection("Order summary");
        body.addView(detailRow("Item subtotal", moneyLabel(order == null ? null : order.subtotalAmount)));
        Ui.gap(body, 8);
        body.addView(detailRow("Delivery fee", moneyLabel(order == null ? null : order.deliveryFee)));
        Ui.gap(body, 8);
        body.addView(detailRow("Buyer order total", moneyLabel(order == null ? null : order.totalAmount)));
        Ui.gap(body, 8);
        body.addView(detailRow("Paid online", Dtos.paid(order)));
        Ui.gap(body, 8);
        body.addView(detailRow("Collect on delivery", Dtos.due(order)));
        Ui.gap(body, 8);
        body.addView(detailRow("Payment mode", paymentModeLabel(order)));
        if (order != null && order.collectionInstructions != null && !order.collectionInstructions.trim().isEmpty()) {
            Ui.gap(body, 8);
            body.addView(orderDetailsNotice(order.collectionInstructions, Color.parseColor("#C2410C"), Color.parseColor("#FFF7ED")));
        }
        return body;
    }

    private View orderDetailsActions(Dtos.OrderDto order) {
        LinearLayout root = Ui.vertical(this);
        if (orderRequiresCollection(order)) {
            MaterialButton collect = Ui.button(this, "Record payment collection");
            bindAction(collect, () -> showPaymentCollectionDialog(order, () -> fetchOrderDetails(order.id)));
            root.addView(collect);
            Ui.gap(root, 8);
        }
        LinearLayout buttons = Ui.horizontal(this);
        MaterialButton navigate = Ui.button(this, "Navigate");
        navigate.setLayoutParams(weightedButtonParams());
        bindAction(navigate, () -> openNavigation(order));
        MaterialButton preview = Ui.secondaryButton(this, "Preview");
        preview.setLayoutParams(weightedButtonParams());
        bindAction(preview, () -> openRoutePreview(order));
        buttons.addView(navigate);
        Ui.gap(buttons, 8);
        buttons.addView(preview);
        root.addView(buttons);
        return root;
    }

    private LinearLayout detailSection(String title) {
        LinearLayout body = Ui.vertical(this);
        body.setPadding(Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14));
        body.setBackground(Ui.strokedBackground(this, Ui.CARD, Ui.DEFAULT_BORDER, 16));
        body.addView(Ui.text(this, title, 15, Typeface.BOLD));
        Ui.gap(body, 10);
        return body;
    }

    private View detailRow(String label, String value) {
        LinearLayout row = Ui.horizontal(this);
        row.setGravity(Gravity.TOP);
        TextView left = Ui.text(this, label, 12, Typeface.BOLD);
        left.setTextColor(Ui.MUTED);
        left.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.36f));
        TextView right = Ui.text(this, value == null || value.trim().isEmpty() ? "Not available" : value.trim(), 13, Typeface.NORMAL);
        right.setTextColor(Ui.HEADING);
        right.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.64f));
        row.addView(left);
        row.addView(right);
        return row;
    }

    private View orderDetailsNotice(String value, int textColor, int backgroundColor) {
        TextView notice = Ui.text(this, value, 13, Typeface.NORMAL);
        notice.setTextColor(textColor);
        notice.setPadding(Ui.dp(this, 12), Ui.dp(this, 10), Ui.dp(this, 12), Ui.dp(this, 10));
        notice.setBackground(Ui.strokedBackground(this, backgroundColor, Ui.DEFAULT_BORDER, 12));
        return notice;
    }

    private void cacheOrderDetails(Dtos.OrderDto order) {
        if (order == null || order.id == null || order.id.trim().isEmpty()) {
            return;
        }
        orderDetailsCache.put(order.id, order);
        if (order.id.equals(openOrderDetailsId) && orderDetailsSheetContent != null && !orderDetailsLoading) {
            renderOrderDetailsSheet(order, false, orderDetailsError);
        }
    }

    private Dtos.OrderDto cachedOrderDetails(String orderId) {
        if (orderId == null) {
            return null;
        }
        Dtos.OrderDto cached = orderDetailsCache.get(orderId);
        if (cached != null) {
            return cached;
        }
        for (Dtos.OrderDto order : activeOrders) {
            if (order != null && orderId.equals(order.id)) {
                return order;
            }
        }
        return activeOrder != null && orderId.equals(activeOrder.id) ? activeOrder : null;
    }

    private int totalItemQuantity(List<Dtos.OrderItemDto> items) {
        int total = 0;
        for (Dtos.OrderItemDto item : items) {
            total += Math.max(0, item == null ? 0 : item.quantity);
        }
        return total;
    }

    private String itemProductName(Dtos.OrderItemDto item) {
        if (item != null && item.product != null && item.product.name != null && !item.product.name.trim().isEmpty()) {
            return item.product.name.trim();
        }
        return "Product " + (item == null || item.productId == null ? "" : item.productId);
    }

    private String itemProductMeta(Dtos.OrderItemDto item) {
        List<String> parts = new ArrayList<>();
        if (item != null && item.product != null) {
            if (item.product.unit != null && !item.product.unit.trim().isEmpty()) {
                parts.add("Unit: " + item.product.unit.trim());
            }
            if (item.product.category != null && !item.product.category.trim().isEmpty()) {
                parts.add("Category: " + Dtos.statusLabel(item.product.category));
            }
        }
        return String.join(" / ", parts);
    }

    private String itemLineTotal(Dtos.OrderItemDto item) {
        double unitPrice = parseMoney(item == null ? null : item.priceApplied);
        int quantity = Math.max(0, item == null ? 0 : item.quantity);
        if (unitPrice <= 0d || quantity <= 0) {
            return "Line total pending";
        }
        return "Line total " + moneyLabel(String.valueOf(unitPrice * quantity));
    }

    private String moneyLabel(String raw) {
        double value = parseMoney(raw);
        return String.format(Locale.US, "Rs %.2f", value);
    }

    private double parseMoney(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return 0d;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException ignored) {
            return 0d;
        }
    }

    private String orderInstructions(Dtos.OrderDto order) {
        String notes = addressString(order, "deliveryNotes", "deliveryNote", "buyerNotes", "specialInstructions", "instructions", "notes");
        if (!notes.isEmpty()) {
            return notes;
        }
        String landmark = addressString(order, "landmark");
        return landmark.isEmpty() ? "" : "Landmark: " + landmark;
    }

    private String addressString(Dtos.OrderDto order, String... keys) {
        try {
            if (order == null || order.addressSnapshot == null || !order.addressSnapshot.isJsonObject()) {
                return "";
            }
            JsonObject object = order.addressSnapshot.getAsJsonObject();
            for (String key : keys) {
                if (object.has(key) && !object.get(key).isJsonNull()) {
                    String value = object.get(key).getAsString();
                    if (value != null && !value.trim().isEmpty()) {
                        return value.trim();
                    }
                }
            }
        } catch (RuntimeException ignored) {
        }
        return "";
    }

    private int statusColor(String status) {
        if ("DELIVERED".equals(status)) {
            return Ui.SUCCESS;
        }
        if ("CANCELLED".equals(status)) {
            return Ui.ERROR;
        }
        if ("PICKED_UP".equals(status) || "OUT_FOR_DELIVERY".equals(status)) {
            return Color.parseColor("#EA580C");
        }
        return Ui.PRIMARY;
    }

    private int statusBackground(String status) {
        if ("DELIVERED".equals(status)) {
            return Ui.SUCCESS_BG;
        }
        if ("CANCELLED".equals(status)) {
            return Color.parseColor("#FEE2E2");
        }
        if ("PICKED_UP".equals(status) || "OUT_FOR_DELIVERY".equals(status)) {
            return Color.parseColor("#FFEDD5");
        }
        return Ui.PRIMARY_LIGHT;
    }

    private String paymentSummaryLine(Dtos.OrderDto order) {
        if (order == null) {
            return "Payment: pending";
        }
        if (orderRequiresCollection(order)) {
            return "Payment: " + Dtos.paid(order) + " paid • collect " + Dtos.due(order);
        }
        return "Payment: " + paymentModeLabel(order) + " • " + Dtos.paid(order) + " paid";
    }

    private String paymentModeLabel(Dtos.OrderDto order) {
        String mode = order == null ? null : order.paymentMode;
        if ("PARTIAL_UPI".equals(mode)) {
            return "Partial UPI";
        }
        if ("LEGACY".equals(mode)) {
            return "Legacy paid";
        }
        return "UPI";
    }

    private boolean orderRequiresCollection(Dtos.OrderDto order) {
        if (order == null) {
            return false;
        }
        if (!order.paymentCollectionRequired) {
            return false;
        }
        if ("COLLECTED".equals(order.collectionStatus) || "NOT_REQUIRED".equals(order.collectionStatus)) {
            return false;
        }
        return parseMoney(order.dueAmount) > 0d;
    }

    private void showPaymentCollectionDialog(Dtos.OrderDto order, Runnable afterRecorded) {
        if (order == null || order.id == null) {
            return;
        }
        String amount = order.dueAmount == null || order.dueAmount.trim().isEmpty() ? "0" : order.dueAmount.trim();
        new AlertDialog.Builder(this)
                .setTitle("Collect payment at delivery")
                .setMessage("Collect " + Dtos.due(order) + " from the buyer before marking this order delivered.")
                .setPositiveButton("Collected cash", (dialog, which) -> recordPaymentCollection(order, "CASH", amount, afterRecorded))
                .setNegativeButton("Collected UPI", (dialog, which) -> recordPaymentCollection(order, "UPI_AT_DELIVERY", amount, afterRecorded))
                .setNeutralButton("Cancel", null)
                .show();
    }

    private void recordPaymentCollection(Dtos.OrderDto order, String method, String amount, Runnable afterRecorded) {
        repository.recordCollection(order.id, method, amount, null, "Recorded by rider app", new UiResult<Dtos.OrderDto>() {
            @Override
            public void success(Dtos.OrderDto value) {
                upsertActiveOrder(value);
                Toast.makeText(MainActivity.this, "Payment collection recorded", Toast.LENGTH_SHORT).show();
                if (afterRecorded != null) {
                    afterRecorded.run();
                }
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                Toast.makeText(MainActivity.this, friendlyFailure(failure, "Could not record payment collection"), Toast.LENGTH_LONG).show();
                if (orderDetailsSheetContent != null) {
                    orderDetailsError = friendlyFailure(failure, "Could not record payment collection");
                    renderOrderDetailsSheet(cachedOrderDetails(order.id), false, orderDetailsError);
                }
            }
        });
    }

    private void autoSelectActiveOrder() {
        if (activeOrders.isEmpty()) {
            selectedActiveOrderId = null;
            activeOrder = null;
            return;
        }
        if (selectedActiveOrderId != null) {
            for (Dtos.OrderDto order : activeOrders) {
                if (order != null && selectedActiveOrderId.equals(order.id)) {
                    activeOrder = order;
                    return;
                }
            }
        }
        selectedActiveOrderId = nearestActiveOrderId();
        activeOrder = selectedActiveOrder();
    }

    private String nearestActiveOrderId() {
        if (activeOrders.isEmpty()) {
            return null;
        }
        Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
        Dtos.Coordinates origin = Dtos.coordinates(localRider == null ? null : localRider.currentLocation);
        if (origin == null) {
            return activeOrders.get(0).id;
        }
        Dtos.OrderDto best = activeOrders.get(0);
        double bestDistance = Double.MAX_VALUE;
        for (Dtos.OrderDto order : activeOrders) {
            Dtos.Coordinates drop = Dtos.coordinates(order == null ? null : order.addressSnapshot);
            if (drop == null) {
                continue;
            }
            double distance = distanceKm(origin.lat, origin.lng, drop.lat, drop.lng);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = order;
            }
        }
        return best == null ? null : best.id;
    }

    private void subscribeActiveOrders() {
        for (Dtos.OrderDto order : activeOrders) {
            if (order != null && order.id != null) {
                socketManager.subscribeOrder(order.id);
            }
        }
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

    private int statusBarHeight() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private View homeStatusCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Today at a glance", 17, Typeface.BOLD));
        int availableCount = availableOrders == null ? 0 : availableOrders.total;
        Dtos.OrderDto selected = selectedActiveOrder();
        String active = hasActiveDeliveries()
                ? activeOrders.size() + " active " + (activeOrders.size() == 1 ? "delivery" : "deliveries")
                + (selected == null ? "" : " • selected #" + Dtos.shortOrderId(selected))
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
        bottomNav.addView(bottomNavItem(MainTab.TRACKING, "Tracking", R.drawable.ic_nav_tracking));
        bottomNav.addView(bottomNavItem(MainTab.ORDERS, "Orders", R.drawable.ic_nav_orders));
        bottomNav.addView(bottomNavItem(MainTab.ACCOUNT, "Profile", R.drawable.ic_nav_account));
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
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(v -> openActiveOrderDetails(order));
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "Active delivery #" + Dtos.shortOrderId(order), 18, Typeface.BOLD));
        body.addView(Ui.text(this, "Customer: " + Dtos.customerName(order), 13, Typeface.NORMAL));
        body.addView(Ui.text(this, "Status: " + Dtos.statusLabel(order.status), 13, Typeface.NORMAL));
        body.addView(Ui.text(this, "Drop: " + Dtos.deliveryAddress(order), 14, Typeface.NORMAL));
        body.addView(Ui.text(this, "Route: " + offerDistanceEta(order), 13, Typeface.BOLD));
        body.addView(Ui.text(this, "Payout: " + Dtos.payout(order), 14, Typeface.BOLD));
        body.addView(Ui.text(this, paymentSummaryLine(order), 13, Typeface.BOLD));
        Ui.gap(body, 8);

        MaterialButton dropNav = Ui.button(this, "Navigate to drop");
        bindAction(dropNav, () -> openNavigation(order));
        body.addView(dropNav);

        MaterialButton preview = Ui.button(this, "Preview route");
        bindAction(preview, () -> openRoutePreview(order));
        body.addView(preview);

        MaterialButton details = Ui.secondaryButton(this, "View buyer order details");
        bindAction(details, () -> openActiveOrderDetails(order));
        body.addView(details);

        String next = Dtos.nextRiderStatus(order);
        if (next != null) {
            MaterialButton transition = Ui.button(this, "Mark " + Dtos.statusLabel(next));
            bindAction(transition, () -> {
                if ("DELIVERED".equals(next) && orderRequiresCollection(order)) {
                    showPaymentCollectionDialog(order, () -> patchStatus(order, next));
                    return;
                }
                patchStatus(order, next);
            });
            body.addView(transition);
        }
        card.addView(body);
        return card;
    }

    private View availableOrdersCard() {
        if (riderOffline()) {
            return offlineStatusCard();
        }

        List<Dtos.OrderDto> items = visibleOrderOffers();
        if (items.isEmpty()) {
            MaterialCardView card = Ui.card(this);
            LinearLayout body = Ui.vertical(this);
            body.addView(Ui.text(this, "Available orders (0)", 18, Typeface.BOLD));
            body.addView(Ui.text(this, "No unassigned orders right now. The list refreshes from sockets, FCM, and periodic fallback refresh.", 13, Typeface.NORMAL));
            card.addView(body);
            return card;
        }

        // Segregate priority from standard so priority offers always read first.
        List<Dtos.OrderDto> priority = new ArrayList<>();
        List<Dtos.OrderDto> standard = new ArrayList<>();
        for (Dtos.OrderDto order : items) {
            if (Dtos.isPriority(order)) {
                priority.add(order);
            } else {
                standard.add(order);
            }
        }

        LinearLayout container = Ui.vertical(this);
        if (!priority.isEmpty()) {
            container.addView(orderOffersCard("Priority Orders", priority, true));
            Ui.gap(container, 12);
        }

        MaterialCardView card;
        if (standard.isEmpty()) {
            card = Ui.card(this);
            LinearLayout emptyBody = Ui.vertical(this);
            emptyBody.addView(Ui.text(this, "Standard Orders (0)", 18, Typeface.BOLD));
            emptyBody.addView(Ui.text(this, "No standard orders right now.", 13, Typeface.NORMAL));
            card.addView(emptyBody);
        } else {
            card = orderOffersCard("Standard Orders", standard, false);
        }
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

        container.addView(card);
        return container;
    }

    private View offlineStatusCard() {
        MaterialCardView card = Ui.card(this);
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, "You're offline", 18, Typeface.BOLD));
        body.addView(Ui.text(this, "Turn on availability to start receiving new orders. Any deliveries already in progress stay active.", 13, Typeface.NORMAL));
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
        refreshPerformanceSnapshot(visible);
    }

    private void refreshPerformanceSnapshot(boolean force) {
        if (performanceRefreshInFlight || repository == null || sessionStore == null || !sessionStore.isLoggedIn()) {
            return;
        }
        long now = System.currentTimeMillis();
        if (!force && performanceSnapshot != null && now - lastPerformanceRefreshAtMs < PERFORMANCE_REFRESH_MS) {
            return;
        }
        performanceRefreshInFlight = true;
        repository.orderHistory("all_time", 1, 12, new UiResult<Dtos.RiderOrderHistoryResponse>() {
            @Override
            public void success(Dtos.RiderOrderHistoryResponse value) {
                performanceRefreshInFlight = false;
                performanceSnapshot = value;
                lastPerformanceRefreshAtMs = System.currentTimeMillis();
                if (activeMainTab == MainTab.HOME) {
                    render();
                }
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                performanceRefreshInFlight = false;
                if (failure != null && failure.unauthorized) {
                    sessionStore.clear();
                    showLogin();
                }
            }
        });
    }

    private void refreshActiveOrder() {
        repository.activeOrders(new UiResult<List<Dtos.OrderDto>>() {
            @Override
            public void success(List<Dtos.OrderDto> value) {
                replaceActiveOrders(value);
                lastError = null;
                if (hasActiveDeliveries()) {
                    subscribeActiveOrders();
                    maybeStartTracking();
                } else {
                    RiderLocationService.stop(MainActivity.this);
                }
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
                upsertActiveOrder(value);
                activeMainTab = MainTab.TRACKING;
                Toast.makeText(MainActivity.this, "Order assigned", Toast.LENGTH_SHORT).show();
                if (value != null && value.id != null) {
                    socketManager.subscribeOrder(value.id);
                }
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
                if (Dtos.isTerminal(value)) {
                    removeActiveOrder(value.id);
                    if (!hasActiveDeliveries()) {
                        RiderLocationService.stop(MainActivity.this);
                    }
                } else {
                    upsertActiveOrder(value);
                }
                if (activeMainTab == MainTab.HOME && hasActiveDeliveries()) {
                    activeMainTab = MainTab.TRACKING;
                }
                render();
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
        // Defense-in-depth: the backend already withholds offers from offline
        // riders; ignore any in-flight push that races the toggle.
        if (riderOffline()) {
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
        if (hasActiveDeliveries()) {
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
                runOnUiThread(MainActivity.this::scheduleActiveOrdersRefresh);
            }

            @Override
            public void onConnectionState(String state) {
                runOnUiThread(() -> {
                    socketState = state;
                    render();
                });
            }

            @Override
            public void onRiderAvailabilityChanged(Boolean isAvailable) {
                if (isAvailable == null) {
                    return;
                }
                runOnUiThread(() -> {
                    // Keep this device's toggle in sync when the rider flips
                    // availability from another session (multi-device).
                    Dtos.RiderDto current = rider == null ? sessionStore.rider() : rider;
                    if (current == null || current.isAvailable == isAvailable) {
                        return;
                    }
                    current.isAvailable = isAvailable;
                    rider = current;
                    sessionStore.updateRider(current);
                    render();
                });
            }
        });
        socketManager.connect(sessionStore.accessToken());
    }

    private void scheduleActiveOrdersRefresh() {
        if (activeOrdersRefreshScheduled) {
            return;
        }
        activeOrdersRefreshScheduled = true;
        handler.postDelayed(activeOrdersSocketRefresh, ACTIVE_ORDERS_SOCKET_REFRESH_DELAY_MS);
    }

    private void maybeStartTracking() {
        if (!hasActiveDeliveries()) {
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
        if (riderLocation == null) {
            Dtos.RiderDto localRider = rider == null ? sessionStore.rider() : rider;
            riderLocation = Dtos.coordinates(localRider == null ? null : localRider.currentLocation);
        }
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
        for (Dtos.OrderDto order : activeOrders) {
            if (order != null && targetOrderId.equals(order.id)) {
                selectedActiveOrderId = order.id;
                activeOrder = order;
                activeMainTab = MainTab.TRACKING;
                render();
                Toast.makeText(this, "Opened active order " + Dtos.shortOrderId(order), Toast.LENGTH_SHORT).show();
                targetOrderId = null;
                return;
            }
        }
        if (activeOrder != null && targetOrderId.equals(activeOrder.id)) {
            activeMainTab = MainTab.TRACKING;
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
