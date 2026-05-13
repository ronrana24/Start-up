package com.startup.rider;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.startup.rider.data.Dtos;
import com.startup.rider.data.RiderRepository;
import com.startup.rider.data.SecureSessionStore;
import com.startup.rider.ui.Ui;

import java.text.NumberFormat;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class OrderHistoryActivity extends AppCompatActivity {
    private static final int PAGE_SIZE = 20;
    private static final String PERIOD_THIS_MONTH = "this_month";
    private static final String PERIOD_LAST_3_MONTHS = "last_3_months";
    private static final String PERIOD_ALL_TIME = "all_time";
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMM, h:mm a").withZone(ZoneId.systemDefault());
    private static final NumberFormat INR = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
    private final Handler handler = new Handler(Looper.getMainLooper());

    private RiderRepository repository;
    private SecureSessionStore sessionStore;
    private final HistoryAdapter adapter = new HistoryAdapter();
    private final List<Dtos.RiderHistoryOrderDto> orders = new ArrayList<>();
    private LinearLayout summaryRow;
    private LinearLayout filterRow;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progress;
    private LinearLayout statePanel;
    private TextView stateTitle;
    private TextView stateBody;
    private MaterialButton retryButton;
    private String period = PERIOD_THIS_MONTH;
    private int page = 1;
    private boolean loading;
    private boolean hasNext = true;
    private boolean firstLoad = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.PAGE);
        getWindow().setNavigationBarColor(Ui.PAGE);
        AppContainer container = RiderApplication.container(this);
        repository = container.riderRepository();
        sessionStore = container.sessionStore();
        setContentView(screen());
        loadHistory(true, false);
    }

    private View screen() {
        LinearLayout root = Ui.vertical(this);
        root.setBackgroundColor(Ui.PAGE);
        root.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        root.addView(header());
        summaryRow = Ui.horizontal(this);
        summaryRow.setGravity(Gravity.CENTER);
        summaryRow.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 14), 0);
        root.addView(summaryRow);

        filterRow = Ui.horizontal(this);
        filterRow.setGravity(Gravity.CENTER_VERTICAL);
        filterRow.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 14), Ui.dp(this, 8));
        root.addView(filterRow);
        renderFilters();
        renderSummary(null);

        FrameLayout listFrame = new FrameLayout(this);
        listFrame.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setColorSchemeColors(Ui.PRIMARY, Ui.PRIMARY_DARK);
        RecyclerView recyclerView = new RecyclerView(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);
        recyclerView.setClipToPadding(false);
        recyclerView.setPadding(Ui.dp(this, 14), Ui.dp(this, 4), Ui.dp(this, 14), Ui.dp(this, 24));
        recyclerView.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@NonNull RecyclerView recycler, int dx, int dy) {
                if (dy > 0 && hasNext && !loading && !recycler.canScrollVertically(1)) {
                    loadHistory(false, false);
                }
            }
        });
        swipeRefresh.setOnRefreshListener(() -> loadHistory(true, true));
        swipeRefresh.addView(recyclerView);
        listFrame.addView(swipeRefresh, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        statePanel = Ui.vertical(this);
        statePanel.setGravity(Gravity.CENTER);
        statePanel.setPadding(Ui.dp(this, 28), Ui.dp(this, 28), Ui.dp(this, 28), Ui.dp(this, 28));
        stateTitle = Ui.text(this, "Loading order history", 18, Typeface.BOLD);
        stateTitle.setGravity(Gravity.CENTER);
        stateBody = Ui.text(this, "Your completed deliveries are being prepared.", 13, Typeface.NORMAL);
        stateBody.setGravity(Gravity.CENTER);
        retryButton = Ui.button(this, "Retry");
        bindAction(retryButton, () -> loadHistory(true, false));
        progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        progress.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 36), Ui.dp(this, 36)));
        statePanel.addView(progress);
        Ui.gap(statePanel, 14);
        statePanel.addView(stateTitle);
        Ui.gap(statePanel, 8);
        statePanel.addView(stateBody);
        Ui.gap(statePanel, 16);
        statePanel.addView(retryButton);
        listFrame.addView(statePanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        root.addView(listFrame);
        return root;
    }

    private View header() {
        LinearLayout header = Ui.horizontal(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(Ui.dp(this, 12), statusBarHeight() + Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8));
        header.setBackgroundColor(Ui.PAGE);
        header.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        MaterialButton back = Ui.secondaryButton(this, "<");
        back.setMinWidth(0);
        back.setTextSize(20);
        back.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 44)));
        bindAction(back, this::finish);
        TextView title = Ui.text(this, "Order History", 20, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        View spacer = new View(this);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 44)));
        header.addView(back);
        header.addView(title);
        header.addView(spacer);
        return header;
    }

    private void renderSummary(Dtos.RiderOrderHistorySummary summary) {
        summaryRow.removeAllViews();
        long total = summary == null ? 0 : summary.totalDeliveries;
        long totalSeconds = summary == null ? 0 : summary.totalDeliveryTimeSeconds;
        long avgSeconds = summary == null ? 0 : summary.averageDeliveryTimeSeconds;
        summaryRow.addView(summaryCard("Total Deliveries", String.valueOf(total), "Completed Orders"));
        Ui.gap(summaryRow, 10);
        summaryRow.addView(summaryCard("Efficiency", durationHours(totalSeconds) + " Total", "Avg " + durationMinutes(avgSeconds) + "/order"));
    }

    private View summaryCard(String title, String value, String subtitle) {
        MaterialCardView card = Ui.card(this);
        card.setRadius(Ui.dp(this, 14));
        card.setCardElevation(Ui.dp(this, 2));
        card.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.text(this, title, 11, Typeface.BOLD));
        TextView primary = Ui.text(this, value, 22, Typeface.BOLD);
        primary.setTextColor(Ui.PRIMARY);
        body.addView(primary);
        TextView sub = Ui.text(this, subtitle, 12, Typeface.NORMAL);
        sub.setTextColor(Ui.MUTED);
        body.addView(sub);
        card.addView(body);
        return card;
    }

    private void renderFilters() {
        filterRow.removeAllViews();
        filterRow.addView(filterButton("This Month", PERIOD_THIS_MONTH));
        Ui.gap(filterRow, 8);
        filterRow.addView(filterButton("Last 3 Months", PERIOD_LAST_3_MONTHS));
        Ui.gap(filterRow, 8);
        filterRow.addView(filterButton("All Time", PERIOD_ALL_TIME));
    }

    private View filterButton(String label, String value) {
        boolean active = period.equals(value);
        MaterialButton button = active ? Ui.button(this, label) : Ui.secondaryButton(this, label);
        button.setMinWidth(0);
        button.setTextSize(12);
        button.setLayoutParams(new LinearLayout.LayoutParams(0, Ui.dp(this, 42), 1f));
        bindAction(button, () -> {
            if (period.equals(value) || loading) {
                return;
            }
            period = value;
            renderFilters();
            loadHistory(true, false);
        });
        return button;
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

    private void loadHistory(boolean reset, boolean pullToRefresh) {
        if (loading) {
            if (pullToRefresh && swipeRefresh != null) swipeRefresh.setRefreshing(false);
            return;
        }
        loading = true;
        if (reset) {
            page = 1;
            hasNext = true;
            if (!pullToRefresh) {
                showState("Loading order history", "Your completed deliveries are being prepared.", true, false);
            }
        }
        repository.orderHistory(period, page, PAGE_SIZE, new UiResult<Dtos.RiderOrderHistoryResponse>() {
            @Override
            public void success(Dtos.RiderOrderHistoryResponse value) {
                loading = false;
                firstLoad = false;
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                Dtos.Page<Dtos.RiderHistoryOrderDto> pageData = value == null ? null : value.orders;
                if (reset) orders.clear();
                if (pageData != null && pageData.items != null) orders.addAll(pageData.items);
                if (value != null) renderSummary(value.summary);
                hasNext = pageData != null && pageData.page * pageData.pageSize < pageData.total;
                page = pageData == null ? page + 1 : pageData.page + 1;
                adapter.notifyDataSetChanged();
                updateStateAfterLoad();
            }

            @Override
            public void error(RiderRepository.ApiFailure failure) {
                loading = false;
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (failure.unauthorized) {
                    sessionStore.clear();
                    Intent intent = new Intent(OrderHistoryActivity.this, MainActivity.class)
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(intent);
                    finish();
                    return;
                }
                if (failure.onboardingRequired) {
                    Intent intent = new Intent(OrderHistoryActivity.this, MainActivity.class)
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(intent);
                    finish();
                    return;
                }
                if (orders.isEmpty()) {
                    showState("Could not load history", friendlyFailure(failure), false, true);
                }
            }
        });
    }

    private void updateStateAfterLoad() {
        if (!orders.isEmpty()) {
            statePanel.setVisibility(View.GONE);
            return;
        }
        String filterLabel = period.equals(PERIOD_THIS_MONTH)
                ? "this month"
                : period.equals(PERIOD_LAST_3_MONTHS) ? "in the last 3 months" : "yet";
        showState("No deliveries " + filterLabel, "Completed deliveries will appear here as soon as you finish your first assigned order.", false, false);
    }

    private void showState(String title, String body, boolean showProgress, boolean showRetry) {
        stateTitle.setText(title);
        stateBody.setText(body);
        progress.setVisibility(showProgress ? View.VISIBLE : View.GONE);
        retryButton.setVisibility(showRetry ? View.VISIBLE : View.GONE);
        statePanel.setVisibility(View.VISIBLE);
    }

    private String friendlyFailure(RiderRepository.ApiFailure failure) {
        if (failure == null || failure.message == null || failure.message.trim().isEmpty()) {
            return "Check your connection and try again.";
        }
        return failure.network ? "No internet connection. Pull down or retry when you are back online." : failure.message;
    }

    private int statusBarHeight() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private String durationHours(long seconds) {
        if (seconds <= 0) return "0h";
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        return hours > 0 ? hours + "h" : minutes + "m";
    }

    private String durationMinutes(long seconds) {
        if (seconds <= 0) return "0 mins";
        long minutes = Math.max(1, Math.round(seconds / 60.0d));
        return minutes + " mins";
    }

    private String money(String raw) {
        if (raw == null || raw.trim().isEmpty()) return INR.format(0);
        try {
            return INR.format(Double.parseDouble(raw));
        } catch (NumberFormatException ignored) {
            return raw;
        }
    }

    private String distance(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "Distance pending";
        try {
            return String.format(Locale.US, "%.1f km", Double.parseDouble(raw));
        } catch (NumberFormatException ignored) {
            return raw + " km";
        }
    }

    private String time(String iso) {
        if (iso == null || iso.trim().isEmpty()) return "Not captured";
        try {
            return TIME_FORMATTER.format(Instant.parse(iso));
        } catch (RuntimeException ignored) {
            return iso;
        }
    }

    private String duration(Dtos.RiderHistoryOrderDto order) {
        if (order.deliveryDurationSeconds != null && order.deliveryDurationSeconds > 0) {
            long minutes = Math.max(1, order.deliveryDurationSeconds / 60);
            return minutes + " mins";
        }
        try {
            if (order.pickedUpAt != null && order.deliveredAt != null) {
                long minutes = Math.max(1, Duration.between(Instant.parse(order.pickedUpAt), Instant.parse(order.deliveredAt)).toMinutes());
                return minutes + " mins";
            }
        } catch (RuntimeException ignored) {
        }
        return "Pending";
    }

    private final class HistoryAdapter extends RecyclerView.Adapter<HistoryViewHolder> {
        @NonNull
        @Override
        public HistoryViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            MaterialCardView card = Ui.card(parent.getContext());
            card.setRadius(Ui.dp(parent.getContext(), 14));
            card.setLayoutParams(new RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            ));
            LinearLayout body = Ui.vertical(parent.getContext());
            card.addView(body);
            return new HistoryViewHolder(card, body);
        }

        @Override
        public void onBindViewHolder(@NonNull HistoryViewHolder holder, int position) {
            holder.bind(orders.get(position));
        }

        @Override
        public int getItemCount() {
            return orders.size();
        }
    }

    private final class HistoryViewHolder extends RecyclerView.ViewHolder {
        private final LinearLayout body;

        HistoryViewHolder(@NonNull View itemView, LinearLayout body) {
            super(itemView);
            this.body = body;
        }

        void bind(Dtos.RiderHistoryOrderDto order) {
            body.removeAllViews();
            TextView address = Ui.text(OrderHistoryActivity.this, order.deliveryAddress == null ? "Delivery address" : order.deliveryAddress, 16, Typeface.BOLD);
            address.setMaxLines(3);
            body.addView(address);
            Ui.gap(body, 8);

            LinearLayout amountRow = Ui.horizontal(OrderHistoryActivity.this);
            amountRow.setGravity(Gravity.CENTER_VERTICAL);
            TextView amount = Ui.text(OrderHistoryActivity.this, money(order.orderAmount), 18, Typeface.BOLD);
            amount.setTextColor(Ui.PRIMARY);
            amount.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            TextView badge = Ui.text(OrderHistoryActivity.this, statusLabel(order.status), 12, Typeface.BOLD);
            badge.setGravity(Gravity.CENTER);
            badge.setTextColor(statusColor(order.status));
            badge.setPadding(Ui.dp(OrderHistoryActivity.this, 10), Ui.dp(OrderHistoryActivity.this, 5), Ui.dp(OrderHistoryActivity.this, 10), Ui.dp(OrderHistoryActivity.this, 5));
            badge.setBackground(Ui.roundedBackground(OrderHistoryActivity.this, statusBg(order.status), 14));
            amountRow.addView(amount);
            amountRow.addView(badge);
            body.addView(amountRow);

            Ui.gap(body, 8);
            body.addView(meta("Order ID", "#" + shortId(order.id)));
            body.addView(meta("Picked up", time(order.pickedUpAt)));
            body.addView(meta("Delivered", time(order.deliveredAt != null ? order.deliveredAt : order.completedAt)));
            body.addView(meta("Duration", duration(order)));
            body.addView(meta("Distance", distance(order.deliveryDistanceKm)));
        }

        private View meta(String label, String value) {
            LinearLayout row = Ui.horizontal(OrderHistoryActivity.this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            TextView left = Ui.text(OrderHistoryActivity.this, label, 12, Typeface.BOLD);
            left.setTextColor(Ui.MUTED);
            left.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.42f));
            TextView right = Ui.text(OrderHistoryActivity.this, value, 13, Typeface.NORMAL);
            right.setTextColor(Ui.HEADING);
            right.setGravity(Gravity.END);
            right.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.58f));
            row.addView(left);
            row.addView(right);
            return row;
        }
    }

    private String shortId(String id) {
        if (id == null) return "";
        return id.length() <= 8 ? id : id.substring(0, 8);
    }

    private String statusLabel(String status) {
        if ("DELIVERED".equals(status)) return "Delivered";
        if ("CANCELLED".equals(status)) return "Cancelled";
        return status == null ? "Unknown" : status.replace('_', ' ').toLowerCase(Locale.US);
    }

    private int statusColor(String status) {
        if ("DELIVERED".equals(status)) return Ui.SUCCESS;
        if ("CANCELLED".equals(status)) return Ui.ERROR;
        return Color.parseColor("#B45309");
    }

    private int statusBg(String status) {
        if ("DELIVERED".equals(status)) return Ui.SUCCESS_BG;
        if ("CANCELLED".equals(status)) return Color.parseColor("#FEE2E2");
        return Color.parseColor("#FEF3C7");
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
