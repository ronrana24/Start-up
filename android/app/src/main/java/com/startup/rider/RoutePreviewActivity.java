package com.startup.rider;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.fragment.app.FragmentActivity;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.gms.maps.model.PolylineOptions;

public final class RoutePreviewActivity extends FragmentActivity implements OnMapReadyCallback {
    public static final String EXTRA_RIDER_LAT = "riderLat";
    public static final String EXTRA_RIDER_LNG = "riderLng";
    public static final String EXTRA_DEST_LAT = "destLat";
    public static final String EXTRA_DEST_LNG = "destLng";
    public static final String EXTRA_DEST_LABEL = "destLabel";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout container = new FrameLayout(this);
        container.setId(View.generateViewId());
        setContentView(container);

        SupportMapFragment map = SupportMapFragment.newInstance();
        getSupportFragmentManager()
                .beginTransaction()
                .replace(container.getId(), map)
                .commitNow();
        map.getMapAsync(this);
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        LatLng destination = new LatLng(
                getIntent().getDoubleExtra(EXTRA_DEST_LAT, 0d),
                getIntent().getDoubleExtra(EXTRA_DEST_LNG, 0d)
        );
        String label = getIntent().getStringExtra(EXTRA_DEST_LABEL);
        googleMap.addMarker(new MarkerOptions().position(destination).title(label == null ? "Drop location" : label));

        boolean hasRider = getIntent().hasExtra(EXTRA_RIDER_LAT) && getIntent().hasExtra(EXTRA_RIDER_LNG);
        if (hasRider) {
            LatLng rider = new LatLng(
                    getIntent().getDoubleExtra(EXTRA_RIDER_LAT, 0d),
                    getIntent().getDoubleExtra(EXTRA_RIDER_LNG, 0d)
            );
            googleMap.addMarker(new MarkerOptions().position(rider).title("Rider"));
            googleMap.addPolyline(new PolylineOptions()
                    .add(rider, destination)
                    .width(8f)
                    .color(Color.rgb(23, 107, 91)));
            LatLngBounds bounds = new LatLngBounds.Builder()
                    .include(rider)
                    .include(destination)
                    .build();
            googleMap.moveCamera(CameraUpdateFactory.newLatLngBounds(bounds, 96));
        } else {
            googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(destination, 14f));
        }
        googleMap.getUiSettings().setZoomControlsEnabled(true);
    }
}
