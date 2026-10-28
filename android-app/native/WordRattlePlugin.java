package com.jackstoneley.wordrattle;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.WindowManager;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Native features for Word Rattle: offline live games over Bluetooth and Wi-Fi
 * (Google Nearby Connections, star layout with the host in the middle), sharing,
 * clipboard, keeping the screen on, the back button and opening game links.
 */
@CapacitorPlugin(
    name = "WordRattle",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "bluetooth", strings = { "android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_ADVERTISE", "android.permission.BLUETOOTH_CONNECT" }),
        @Permission(alias = "wifi", strings = { "android.permission.NEARBY_WIFI_DEVICES" })
    }
)
public class WordRattlePlugin extends Plugin {
    private static final String SERVICE_ID = "com.jackstoneley.wordrattle.live";
    private ConnectionsClient client;
    private String launchUrl;

    @Override
    public void load() {
        client = Nearby.getConnectionsClient(getContext());
        Intent intent = getActivity().getIntent();
        if (intent != null && intent.getData() != null) launchUrl = intent.getData().toString();
        getActivity().runOnUiThread(() -> getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                notifyListeners("back", new JSObject());
            }
        }));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.getData() != null) {
            JSObject o = new JSObject();
            o.put("url", intent.getData().toString());
            notifyListeners("appUrl", o, true);
        }
    }

    /* ---------- general ---------- */

    @PluginMethod
    public void getLaunchUrl(PluginCall call) {
        JSObject o = new JSObject();
        o.put("url", launchUrl);
        launchUrl = null;
        call.resolve(o);
    }

    @PluginMethod
    public void share(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        Intent chooser = Intent.createChooser(send, "Share");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(chooser);
        call.resolve();
    }

    @PluginMethod
    public void copy(PluginCall call) {
        ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        cm.setPrimaryClip(ClipData.newPlainText("Word Rattle", call.getString("text", "")));
        call.resolve();
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    @PluginMethod
    public void minimise(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }

    /* ---------- permissions for nearby play ---------- */

    private String[] requiredAliases() {
        if (Build.VERSION.SDK_INT >= 33) return new String[] { "bluetooth", "wifi" };
        if (Build.VERSION.SDK_INT >= 31) return new String[] { "bluetooth", "location" };
        return new String[] { "location" };
    }

    private String[] requestAliases() {
        if (Build.VERSION.SDK_INT >= 33) return new String[] { "bluetooth", "wifi", "location" };
        return requiredAliases();
    }

    private boolean allGranted() {
        for (String a : requiredAliases()) if (getPermissionState(a) != PermissionState.GRANTED) return false;
        return true;
    }

    @PluginMethod
    public void ensurePermissions(PluginCall call) {
        if (allGranted()) {
            JSObject o = new JSObject();
            o.put("granted", true);
            call.resolve(o);
            return;
        }
        requestPermissionForAliases(requestAliases(), call, "permissionsDone");
    }

    @PermissionCallback
    private void permissionsDone(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", allGranted());
        call.resolve(o);
    }

    /* ---------- nearby connections ---------- */

    private final PayloadCallback payloadCallback = new PayloadCallback() {
        @Override
        public void onPayloadReceived(@NonNull String id, @NonNull Payload payload) {
            if (payload.getType() == Payload.Type.BYTES && payload.asBytes() != null) {
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("data", new String(payload.asBytes(), StandardCharsets.UTF_8));
                notifyListeners("message", o);
            }
        }

        @Override
        public void onPayloadTransferUpdate(@NonNull String id, @NonNull PayloadTransferUpdate update) {}
    };

    private final ConnectionLifecycleCallback lifecycle = new ConnectionLifecycleCallback() {
        @Override
        public void onConnectionInitiated(@NonNull String id, @NonNull ConnectionInfo info) {
            client.acceptConnection(id, payloadCallback);
        }

        @Override
        public void onConnectionResult(@NonNull String id, @NonNull ConnectionResolution result) {
            JSObject o = new JSObject();
            o.put("id", id);
            o.put("ok", result.getStatus().isSuccess());
            o.put("code", result.getStatus().getStatusCode());
            notifyListeners("result", o);
        }

        @Override
        public void onDisconnected(@NonNull String id) {
            JSObject o = new JSObject();
            o.put("id", id);
            notifyListeners("disconnected", o);
        }
    };

    private final EndpointDiscoveryCallback discovery = new EndpointDiscoveryCallback() {
        @Override
        public void onEndpointFound(@NonNull String id, @NonNull DiscoveredEndpointInfo info) {
            JSObject o = new JSObject();
            o.put("id", id);
            o.put("name", info.getEndpointName());
            notifyListeners("found", o);
        }

        @Override
        public void onEndpointLost(@NonNull String id) {
            JSObject o = new JSObject();
            o.put("id", id);
            notifyListeners("lost", o);
        }
    };

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        AdvertisingOptions options = new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_STAR).build();
        client.startAdvertising(call.getString("name", "Word Rattle"), SERVICE_ID, lifecycle, options)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        DiscoveryOptions options = new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build();
        client.startDiscovery(SERVICE_ID, discovery, options)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        client.stopDiscovery();
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        if (id == null) { call.reject("Missing id"); return; }
        client.requestConnection(call.getString("name", "Player"), id, lifecycle)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
    }

    @PluginMethod
    public void send(PluginCall call) {
        String id = call.getString("id");
        if (id == null) { call.reject("Missing id"); return; }
        List<String> ids = new ArrayList<>();
        ids.add(id);
        client.sendPayload(ids, Payload.fromBytes(call.getString("data", "").getBytes(StandardCharsets.UTF_8)));
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String id = call.getString("id");
        if (id != null) client.disconnectFromEndpoint(id);
        call.resolve();
    }

    @PluginMethod
    public void stopAll(PluginCall call) {
        client.stopAdvertising();
        client.stopDiscovery();
        client.stopAllEndpoints();
        call.resolve();
    }
}
