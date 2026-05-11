package com.startup.rider.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

public final class Ui {
    public static final int PRIMARY = Color.parseColor("#1F7A63");
    public static final int PRIMARY_DARK = Color.parseColor("#17614E");
    public static final int PRIMARY_LIGHT = Color.parseColor("#E6F4F1");
    public static final int PAGE = Color.parseColor("#F8F9FA");
    public static final int CARD = Color.WHITE;
    public static final int HEADING = Color.parseColor("#111827");
    public static final int SECONDARY = Color.parseColor("#6B7280");
    public static final int MUTED = Color.parseColor("#9CA3AF");
    public static final int DEFAULT_BORDER = Color.parseColor("#E5E7EB");
    public static final int INPUT_BG = Color.parseColor("#F9FAFB");
    public static final int DISABLED_BG = Color.parseColor("#F3F4F6");
    public static final int ERROR = Color.parseColor("#DC2626");
    public static final int SUCCESS = Color.parseColor("#22C55E");
    public static final int SUCCESS_BG = Color.parseColor("#DCFCE7");

    private Ui() {
    }

    public static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    public static TextView text(Context context, String value, int sp, int style) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(sp);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setTextColor(style == Typeface.BOLD ? HEADING : SECONDARY);
        view.setLineSpacing(dp(context, 2), 1f);
        return view;
    }

    public static TextView label(Context context, String value) {
        TextView view = text(context, value, 14, Typeface.BOLD);
        view.setTextColor(HEADING);
        return view;
    }

    public static TextView error(Context context, String value) {
        TextView view = text(context, value, 13, Typeface.NORMAL);
        view.setTextColor(ERROR);
        return view;
    }

    public static TextView eyebrow(Context context, String value) {
        TextView view = text(context, value, 12, Typeface.BOLD);
        view.setTextColor(PRIMARY);
        view.setAllCaps(true);
        view.setLetterSpacing(0.08f);
        return view;
    }

    public static MaterialButton button(Context context, String label) {
        MaterialButton button = new MaterialButton(context);
        button.setText(label);
        button.setMinHeight(dp(context, 44));
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setCornerRadius(dp(context, 8));
        button.setBackgroundTintList(ColorStateList.valueOf(PRIMARY));
        button.setTextColor(Color.WHITE);
        button.setRippleColor(ColorStateList.valueOf(PRIMARY_DARK));
        button.setLayoutParams(matchWrap());
        button.setInsetTop(0);
        button.setInsetBottom(0);
        return button;
    }

    public static MaterialButton secondaryButton(Context context, String label) {
        MaterialButton button = button(context, label);
        button.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#F9FAFB")));
        button.setTextColor(HEADING);
        button.setStrokeColor(ColorStateList.valueOf(DEFAULT_BORDER));
        button.setStrokeWidth(dp(context, 1));
        return button;
    }

    public static MaterialButton outlinePillButton(Context context, String label) {
        MaterialButton button = secondaryButton(context, label);
        button.setMinHeight(dp(context, 48));
        button.setCornerRadius(dp(context, 24));
        return button;
    }

    public static MaterialCardView card(Context context) {
        MaterialCardView card = new MaterialCardView(context);
        card.setRadius(dp(context, 12));
        card.setCardElevation(dp(context, 1));
        card.setUseCompatPadding(true);
        card.setCardBackgroundColor(CARD);
        card.setStrokeColor(DEFAULT_BORDER);
        card.setStrokeWidth(dp(context, 1));
        card.setContentPadding(dp(context, 14), dp(context, 14), dp(context, 14), dp(context, 14));
        card.setLayoutParams(matchWrap());
        return card;
    }

    public static EditText input(Context context, String hint, int inputType) {
        EditText input = new EditText(context);
        input.setHint(hint);
        input.setTextSize(16);
        input.setSingleLine(true);
        input.setInputType(inputType);
        input.setTextColor(HEADING);
        input.setHintTextColor(MUTED);
        input.setPadding(dp(context, 12), 0, dp(context, 12), 0);
        input.setMinHeight(dp(context, 44));
        input.setBackground(inputBackground(context, DEFAULT_BORDER));
        input.setLayoutParams(matchWrap());
        return input;
    }

    public static void setInputError(EditText input, boolean hasError) {
        input.setBackground(inputBackground(input.getContext(), hasError ? ERROR : DEFAULT_BORDER));
    }

    public static GradientDrawable roundedBackground(Context context, int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(context, radiusDp));
        return drawable;
    }

    public static GradientDrawable strokedBackground(Context context, int color, int strokeColor, int radiusDp) {
        GradientDrawable drawable = roundedBackground(context, color, radiusDp);
        drawable.setStroke(dp(context, 1), strokeColor);
        return drawable;
    }

    public static LinearLayout vertical(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setLayoutParams(matchWrap());
        return layout;
    }

    public static LinearLayout horizontal(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setLayoutParams(matchWrap());
        return layout;
    }

    public static void gap(LinearLayout layout, int dp) {
        View gap = new View(layout.getContext());
        if (layout.getOrientation() == LinearLayout.HORIZONTAL) {
            gap.setLayoutParams(new LinearLayout.LayoutParams(dp(layout.getContext(), dp), 1));
        } else {
            gap.setLayoutParams(new LinearLayout.LayoutParams(1, dp(layout.getContext(), dp)));
        }
        layout.addView(gap);
    }

    public static ViewGroup.LayoutParams matchWrap() {
        return new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    private static GradientDrawable inputBackground(Context context, int strokeColor) {
        return strokedBackground(context, INPUT_BG, strokeColor, 8);
    }
}
