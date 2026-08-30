import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const packageDir=path.join(root,'android','app','src','main','java','kz','mgtrener','familyfinance');
const mainActivityPath=path.join(packageDir,'MainActivity.java');
const pluginPath=path.join(packageDir,'AppUpdaterPlugin.java');
const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');

await mkdir(packageDir,{recursive:true});

const mainActivity=`package kz.mgtrener.familyfinance;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AppUpdaterPlugin.class);
    super.onCreate(savedInstanceState);

    getWindow().setStatusBarColor(Color.parseColor("#050b12"));
    getWindow().setNavigationBarColor(Color.parseColor("#050b12"));
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      getWindow().setNavigationBarContrastEnforced(false);
      getWindow().setStatusBarContrastEnforced(false);
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      getWindow().getDecorView().setSystemUiVisibility(0);
    }

    // Android 15+ forces edge-to-edge for apps targeting current SDKs.
    // Keep the Capacitor content below the status bar while leaving the
    // bottom inset to the web UI, which already accounts for Android nav.
    if (Build.VERSION.SDK_INT >= 35) {
      final View contentView = findViewById(android.R.id.content);
      final int initialLeft = contentView.getPaddingLeft();
      final int initialTop = contentView.getPaddingTop();
      final int initialRight = contentView.getPaddingRight();
      final int initialBottom = contentView.getPaddingBottom();
      ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, insets) -> {
        final Insets topInsets = insets.getInsets(
          WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
        );
        view.setPadding(
          initialLeft + topInsets.left,
          initialTop + topInsets.top,
          initialRight + topInsets.right,
          initialBottom
        );
        return insets;
      });
      ViewCompat.requestApplyInsets(contentView);
    }
  }
}
`;

const plugin=`package kz.mgtrener.familyfinance;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
  private static final String PREFS = "family_treasury_updater";
  private static final String KEY_ID = "download_id";
  private static final String KEY_BUILD = "download_build";
  private static final String APK_MIME = "application/vnd.android.package-archive";

  private DownloadManager downloadManager;
  private SharedPreferences prefs;
  private boolean receiverRegistered = false;

  private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
    @Override
    public void onReceive(Context context, Intent intent) {
      if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
      long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
      if (completedId <= 0 || completedId != prefs.getLong(KEY_ID, -1L)) return;
      if (downloadState(completedId).equals("downloaded") && canInstallPackages()) {
        launchInstaller(completedId);
      }
    }
  };

  @Override
  public void load() {
    Context context = getContext().getApplicationContext();
    downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
    prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    registerDownloadReceiver(context);
    clearInstalledDownload();
  }

  private void registerDownloadReceiver(Context context) {
    if (receiverRegistered) return;
    IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED);
    } else {
      context.registerReceiver(downloadReceiver, filter);
    }
    receiverRegistered = true;
  }

  private long installedBuild() {
    try {
      PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
      return info.versionCode;
    } catch (Exception ignored) {
      return 0L;
    }
  }

  private boolean canInstallPackages() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
  }

  private void clearDownload() {
    long id = prefs.getLong(KEY_ID, -1L);
    if (id > 0 && downloadManager != null) {
      try { downloadManager.remove(id); } catch (Exception ignored) { }
    }
    prefs.edit().remove(KEY_ID).remove(KEY_BUILD).apply();
  }

  private void clearInstalledDownload() {
    int downloadedBuild = prefs.getInt(KEY_BUILD, 0);
    if (downloadedBuild > 0 && downloadedBuild <= installedBuild()) clearDownload();
  }

  private String downloadState(long id) {
    if (id <= 0 || downloadManager == null) return "idle";
    DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
    try (Cursor cursor = downloadManager.query(query)) {
      if (cursor == null || !cursor.moveToFirst()) return "idle";
      int column = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
      if (column < 0) return "idle";
      int status = cursor.getInt(column);
      if (status == DownloadManager.STATUS_SUCCESSFUL) return "downloaded";
      if (status == DownloadManager.STATUS_FAILED) return "failed";
      if (status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PAUSED) return "downloading";
      return "idle";
    } catch (Exception ignored) {
      return "idle";
    }
  }

  private JSObject statusObject() {
    clearInstalledDownload();
    long id = prefs.getLong(KEY_ID, -1L);
    int build = prefs.getInt(KEY_BUILD, 0);
    String state = downloadState(id);
    if (state.equals("failed")) {
      clearDownload();
      id = -1L;
      build = 0;
      state = "idle";
    }
    JSObject result = new JSObject();
    result.put("state", state);
    result.put("build", build);
    result.put("installedBuild", installedBuild());
    result.put("downloadId", id);
    result.put("installAllowed", canInstallPackages());
    return result;
  }

  private void openInstallPermissionSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
  }

  private boolean launchInstaller(long id) {
    if (!canInstallPackages() || downloadManager == null) return false;
    Uri uri = downloadManager.getUriForDownloadedFile(id);
    if (uri == null) return false;
    Intent install = new Intent(Intent.ACTION_VIEW);
    install.setDataAndType(uri, APK_MIME);
    install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
    getContext().startActivity(install);
    return true;
  }

  private String cacheBustedUrl(String url, int build) {
    Uri.Builder builder = Uri.parse(url).buildUpon();
    if (build > 0) builder.appendQueryParameter("build", String.valueOf(build));
    builder.appendQueryParameter("downloadNonce", String.valueOf(System.currentTimeMillis()));
    return builder.build().toString();
  }

  private JSObject enqueue(String url, int build) {
    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(cacheBustedUrl(url, build)));
    request.setTitle("Семейная казна — обновление");
    request.setDescription(build > 0 ? "Загрузка версии 1.0." + build : "Загрузка новой версии");
    request.setMimeType(APK_MIME);
    request.setAllowedOverMetered(true);
    request.setAllowedOverRoaming(false);
    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
    long id = downloadManager.enqueue(request);
    prefs.edit().putLong(KEY_ID, id).putInt(KEY_BUILD, build).apply();
    JSObject result = statusObject();
    result.put("started", true);
    return result;
  }

  @PluginMethod
  public void getStatus(PluginCall call) {
    call.resolve(statusObject());
  }

  @PluginMethod
  public void downloadAndInstall(PluginCall call) {
    String url = call.getString("url");
    Integer requestedBuild = call.getInt("build");
    boolean automatic = Boolean.TRUE.equals(call.getBoolean("automatic", false));
    int build = requestedBuild == null ? 0 : requestedBuild;
    if (url == null || url.trim().isEmpty()) {
      call.reject("Не указан URL обновления");
      return;
    }

    clearInstalledDownload();
    int storedBuild = prefs.getInt(KEY_BUILD, 0);
    long storedId = prefs.getLong(KEY_ID, -1L);
    String storedState = downloadState(storedId);

    if (storedBuild == build && (storedState.equals("downloading") || storedState.equals("downloaded"))) {
      if (storedState.equals("downloaded")) {
        if (canInstallPackages()) launchInstaller(storedId);
        else if (!automatic) openInstallPermissionSettings();
      }
      JSObject result = statusObject();
      result.put("started", false);
      result.put("permissionRequired", !canInstallPackages());
      call.resolve(result);
      return;
    }

    if (storedId > 0) clearDownload();

    if (!canInstallPackages()) {
      if (!automatic) openInstallPermissionSettings();
      JSObject result = statusObject();
      result.put("started", false);
      result.put("permissionRequired", true);
      call.resolve(result);
      return;
    }

    call.resolve(enqueue(url, build));
  }

  @PluginMethod
  public void installPending(PluginCall call) {
    clearInstalledDownload();
    long id = prefs.getLong(KEY_ID, -1L);
    String state = downloadState(id);
    if (!state.equals("downloaded")) {
      JSObject result = statusObject();
      result.put("installedPromptOpened", false);
      call.resolve(result);
      return;
    }
    if (!canInstallPackages()) {
      openInstallPermissionSettings();
      JSObject result = statusObject();
      result.put("permissionRequired", true);
      result.put("installedPromptOpened", false);
      call.resolve(result);
      return;
    }
    JSObject result = statusObject();
    result.put("installedPromptOpened", launchInstaller(id));
    call.resolve(result);
  }
}
`;

await writeFile(mainActivityPath,mainActivity,'utf8');
await writeFile(pluginPath,plugin,'utf8');

let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')){
  manifest=manifest.replace(/<manifest([^>]*)>/,`<manifest$1>\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />`);
  await writeFile(manifestPath,manifest,'utf8');
}

console.log('Native Android updater and status-bar insets injected.');
