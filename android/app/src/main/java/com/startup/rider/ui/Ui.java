package com.startup.rider.ui;

import android.content.Context;
import android.graphics.Typeface;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

public final class Ui {
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
        view.setLineSpacing(dp(context, 2), 1f);
        return view;
    }

    public static MaterialButton button(Context context, String label) {
        MaterialButton button = new MaterialButton(context);
        button.setText(label);
        button.setMinHeight(dp(context, 44));
        return button;
    }

    public static MaterialCardView card(Context context) {
        MaterialCardView card = new MaterialCardView(context);
        card.setRadius(dp(context, 8));
        card.setCardElevation(dp(context, 1));
        card.setUseCompatPadding(true);
        card.setContentPadding(dp(context, 14), dp(context, 14), dp(context, 14), dp(context, 14));
        card.setLayoutParams(matchWrap());
        return card;
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
        gap.setLayoutParams(new LinearLayout.LayoutParams(1, dp(layout.getContext(), dp)));
        layout.addView(gap);
    }

    public static ViewGroup.LayoutParams matchWrap() {
        return new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }
}
