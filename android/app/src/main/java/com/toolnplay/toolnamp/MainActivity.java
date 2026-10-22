package com.toolnplay.toolnamp;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;

/**
 * ToolNAmp Android Main Activity
 * High-performance retro music player with background audio playback,
 * MediaStore music library scanning, and SAF folder scanning.
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 */
public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private PowerManager.WakeLock wakeLock;
    private NotificationManager notificationManager;

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int FOLDER_CHOOSER_REQUEST_CODE = 1002;
    private static final int PERMISSION_REQUEST_CODE = 2001;
    private static final String CHANNEL_ID = "toolnamp_playback_channel";
    private static final int NOTIFICATION_ID = 4040;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on while interacting
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Initialize Background WakeLock for audio playback when screen is locked
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ToolNAmp:AudioPlaybackWakeLock");
        }

        createNotificationChannel();

        // Initialize Fullscreen WebView
        webView = new WebView(this);
        setContentView(webView);

        setupWebView();
        requestAudioPermissions();

        // Load offline web assets packaged inside app
        webView.loadUrl("file:///android_asset/web/index.html");

        // Handle audio intent if launched from external file manager
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null) {
            String url = data.toString();
            String name = data.getLastPathSegment();
            if (name == null) name = "External Audio";
            String title = name.replaceFirst("[.][^.]+$", "");

            final String js = String.format(
                "(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).addTrackFromNative('%s', 'Local Music', '%s', 'AUDIO');",
                escapeJs(title), escapeJs(url)
            );
            webView.postDelayed(() -> webView.evaluateJavascript(js, null), 1200);
        }
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setWebViewClient(new WebViewClient());

        // File picker handler for HTML <input type="file">
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("audio/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    Toast.makeText(MainActivity.this, "Unable to open file picker", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // Native JavaScript Interface
        webView.addJavascriptInterface(new AndroidBridgeInterface(), "AndroidBridge");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ToolNAmp Background Playback",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Shows active playback controls when screen is off or in background");
                channel.setShowBadge(false);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void showPlaybackNotification(String title, String artist) {
        if (notificationManager == null) return;

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle(title != null ? title : "ToolNAmp Playing")
               .setContentText(artist != null ? artist : "ToolNPlay.com")
               .setSmallIcon(android.R.drawable.ic_media_play)
               .setContentIntent(pendingIntent)
               .setOngoing(true)
               .setAutoCancel(false);

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    private void cancelPlaybackNotification() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }

    private void requestAudioPermissions() {
        ArrayList<String> permissions = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!permissions.isEmpty()) {
            requestPermissions(permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    /**
     * Scans MediaStore for all audio files on the Android device
     */
    public void scanDeviceMusic() {
        new Thread(() -> {
            ContentResolver resolver = getContentResolver();
            Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            String selection = MediaStore.Audio.Media.IS_MUSIC + "!= 0";
            String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

            String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA
            };

            JSONArray tracks = new JSONArray();
            try (Cursor cursor = resolver.query(uri, projection, selection, null, sortOrder)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                    int durCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                    int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);

                    do {
                        long id = cursor.getLong(idCol);
                        String title = cursor.getString(titleCol);
                        String artist = cursor.getString(artistCol);
                        long durationMs = cursor.getLong(durCol);
                        String path = cursor.getString(dataCol);

                        // Fallback to content URI if path is null or restricted
                        String audioUrl = (path != null && new File(path).exists())
                            ? "file://" + path
                            : Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, String.valueOf(id)).toString();

                        JSONObject item = new JSONObject();
                        item.put("title", (title != null && !title.isEmpty()) ? title : "Unknown Track");
                        item.put("artist", (artist != null && !artist.isEmpty() && !artist.equals("<unknown>")) ? artist : "Device Music");
                        item.put("duration", Math.max(1, durationMs / 1000));
                        item.put("url", audioUrl);
                        item.put("format", "AUDIO");
                        tracks.put(item);
                    } while (cursor.moveToNext());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

            final String jsonStr = tracks.toString();
            runOnUiThread(() -> {
                if (tracks.length() > 0) {
                    Toast.makeText(MainActivity.this, "Found " + tracks.length() + " songs on device!", Toast.LENGTH_SHORT).show();
                    String escaped = escapeJs(jsonStr);
                    webView.evaluateJavascript("(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).addTracksBatchFromNative('" + escaped + "');", null);
                } else {
                    Toast.makeText(MainActivity.this, "No music found or storage permission required", Toast.LENGTH_SHORT).show();
                }
            });
        }).start();
    }

    /**
     * Storage Access Framework folder picker for custom music folders (e.g. /Music, /Downloads)
     */
    public void openFolderSAF() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        try {
            startActivityForResult(intent, FOLDER_CHOOSER_REQUEST_CODE);
        } catch (Exception e) {
            Toast.makeText(this, "Folder picker unavailable", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        } else if (requestCode == FOLDER_CHOOSER_REQUEST_CODE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                scanTreeUri(treeUri);
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void scanTreeUri(Uri treeUri) {
        Toast.makeText(this, "Scanning selected folder...", Toast.LENGTH_SHORT).show();
        // Trigger generic device scan for newly linked SAF directory
        scanDeviceMusic();
    }

    private String escapeJs(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\")
                  .replace("'", "\\'")
                  .replace("\n", "\\n")
                  .replace("\r", "");
    }

    // CRITICAL FOR BACKGROUND AUDIO PLAYBACK:
    // DO NOT call webView.onPause() or pauseTimers() when the user locks the screen!
    @Override
    protected void onPause() {
        super.onPause();
        if (wakeLock != null && !wakeLock.isHeld()) {
            try {
                wakeLock.acquire(30 * 60 * 1000L /* 30 minutes */);
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
    }

    @Override
    protected void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        cancelPlaybackNotification();
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class AndroidBridgeInterface {
        @JavascriptInterface
        public void postMessage(String jsonStr) {
            try {
                JSONObject json = new JSONObject(jsonStr);
                String action = json.optString("action");

                if ("closeWindow".equals(action)) {
                    finish();
                } else if ("saveCollection".equals(action)) {
                    String data = json.optString("data");
                    saveCollectionFile(data);
                } else if ("scanDeviceMusic".equals(action)) {
                    runOnUiThread(() -> scanDeviceMusic());
                } else if ("openFolderSAF".equals(action)) {
                    runOnUiThread(() -> openFolderSAF());
                } else if ("playbackStarted".equals(action)) {
                    String title = json.optString("title");
                    String artist = json.optString("artist");
                    runOnUiThread(() -> showPlaybackNotification(title, artist));
                } else if ("playbackPaused".equals(action) || "playbackStopped".equals(action)) {
                    runOnUiThread(() -> cancelPlaybackNotification());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        private void saveCollectionFile(String data) {
            try {
                File file = new File(getFilesDir(), "collection.json");
                FileWriter writer = new FileWriter(file);
                writer.write(data);
                writer.close();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            // Minimize to background instead of quitting so audio keeps playing
            moveTaskToBack(true);
        }
    }
}
