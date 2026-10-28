package com.jackstoneley.wordrattle;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.location.LocationManager;
import android.provider.Settings;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.view.WindowManager;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
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

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Native features for Stoneley Games (the plugin keeps its original name, "WordRattle"):
 * offline live games over Bluetooth and Wi-Fi (Google Nearby Connections, star layout with
 * the host in the middle), sharing, clipboard, keeping the screen on, the back button,
 * opening game links, and installing app updates downloaded from the latest GitHub release.
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

    /* ---------- app version and updates ---------- */

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            JSObject o = new JSObject();
            o.put("code", code);
            o.put("name", pi.versionName);
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    /** Downloads the APK at `url` (following redirects) and opens Android's installer for it. */
    @PluginMethod
    public void installUpdate(PluginCall call) {
        final String url = call.getString("url");
        if (url == null) { call.reject("Missing url"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject o = new JSObject();
            o.put("needsPermission", true);
            call.resolve(o);
            return;
        }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Couldn't make a download folder");
                File f = new File(dir, "stoneley-games.apk");
                if (f.exists() && !f.delete()) throw new IOException("Couldn't clear the old download");
                URL u = new URL(url);
                int hops = 0;
                while (true) {
                    c = (HttpURLConnection) u.openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(30000);
                    int status = c.getResponseCode();
                    if (status >= 300 && status < 400 && hops < 8) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        if (loc == null) throw new IOException("Download redirect had no address");
                        u = new URL(u, loc);
                        hops++;
                        continue;
                    }
                    if (status != 200) throw new IOException("Download failed (" + status + ")");
                    break;
                }
                int total = c.getContentLength();
                try (InputStream in = new BufferedInputStream(c.getInputStream()); OutputStream out = new FileOutputStream(f)) {
                    byte[] buf = new byte[65536];
                    long done = 0;
                    int n, last = -1;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != last) {
                                last = pct;
                                JSObject p = new JSObject();
                                p.put("pct", pct);
                                notifyListeners("updateProgress", p);
                            }
                        }
                    }
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updates", f);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                JSObject o = new JSObject();
                o.put("started", true);
                call.resolve(o);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    /* ---------- permissions for nearby play ---------- */

    private String[] requiredAliases() {
        if (Build.VERSION.SDK_INT >= 33) return new String[] { "bluetooth", "wifi", "location" };
        if (Build.VERSION.SDK_INT >= 31) return new String[] { "bluetooth", "location" };
        return new String[] { "location" };
    }

    private String[] requestAliases() {
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
        JSObject states = new JSObject();
        for (String a : requiredAliases()) states.put(a, getPermissionState(a).toString());
        o.put("states", states);
        call.resolve(o);
    }

    /* Is Bluetooth on, and are location services on? (Android needs both to find nearby phones.) */
    @PluginMethod
    public void status(PluginCall call) {
        boolean bt = false, loc = false;
        try {
            BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter ad = bm != null ? bm.getAdapter() : null;
            bt = ad != null && ad.isEnabled();
        } catch (Exception ignored) {}
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) loc = Build.VERSION.SDK_INT >= 28 ? lm.isLocationEnabled()
                : (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
        } catch (Exception ignored) {}
        JSObject o = new JSObject();
        o.put("bluetooth", bt);
        o.put("location", loc);
        o.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(o);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String which = call.getString("which", "app");
        Intent i;
        if ("bluetooth".equals(which)) i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        else if ("location".equals(which)) i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        else { i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS); i.setData(android.net.Uri.parse("package:" + getContext().getPackageName())); }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    private void fail(PluginCall call, Exception e) {
        if (e instanceof ApiException) {
            int code = ((ApiException) e).getStatusCode();
            call.reject(ConnectionsStatusCodes.getStatusCodeString(code) + " (" + code + ")", String.valueOf(code));
        } else call.reject(String.valueOf(e.getMessage()));
    }

    private boolean already(Exception e, int code) {
        return e instanceof ApiException && ((ApiException) e).getStatusCode() == code;
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
        client.stopAdvertising();
        client.startAdvertising(call.getString("name", "Word Rattle"), SERVICE_ID, lifecycle, options)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> { if (already(e, ConnectionsStatusCodes.STATUS_ALREADY_ADVERTISING)) call.resolve(); else fail(call, e); });
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        DiscoveryOptions options = new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build();
        client.stopDiscovery();
        client.startDiscovery(SERVICE_ID, discovery, options)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> { if (already(e, ConnectionsStatusCodes.STATUS_ALREADY_DISCOVERING)) call.resolve(); else fail(call, e); });
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
            .addOnFailureListener(e -> { if (already(e, ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT)) call.resolve(); else fail(call, e); });
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
