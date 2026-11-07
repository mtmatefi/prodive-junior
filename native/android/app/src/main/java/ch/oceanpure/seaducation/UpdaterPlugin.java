package ch.oceanpure.seaducation;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

// Seaducation self-updater: reads the release manifest, downloads the new APK and hands it to the Android installer.
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private HttpURLConnection open(String u) throws Exception {
        HttpURLConnection c = null; URL url = new URL(u);
        for (int i = 0; i < 6; i++) { // follow redirects (GitHub release downloads redirect to a CDN)
            c = (HttpURLConnection) url.openConnection(); c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "SeaducationJunior");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { url = new URL(url, c.getHeaderField("Location")); c.disconnect(); continue; }
            return c;
        }
        return c;
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        try { android.content.pm.PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode); r.put("versionName", pi.versionName);
        } catch (Exception e) { r.put("versionCode", 0); }
        call.resolve(r);
    }

    @PluginMethod
    public void check(PluginCall call) {
        String u = call.getString("url");
        new Thread(() -> {
            try { HttpURLConnection c = open(u + (u.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis());
                if (c.getResponseCode() != 200) { call.reject("http " + c.getResponseCode()); return; }
                BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8")); StringBuilder sb = new StringBuilder(); String line;
                while ((line = br.readLine()) != null) sb.append(line); br.close();
                JSObject r = new JSObject(); r.put("json", sb.toString()); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void download(PluginCall call) {
        String u = call.getString("url");
        new Thread(() -> {
            try { File f = new File(getContext().getCacheDir(), "update.apk"); if (f.exists()) f.delete();
                HttpURLConnection c = open(u); long total = c.getContentLengthLong(); InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(f);
                byte[] buf = new byte[65536]; long done = 0; int n, last = -1;
                while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); done += n; int p = total > 0 ? (int) (done * 100 / total) : -1;
                    if (p != last) { last = p; JSObject ev = new JSObject(); ev.put("percent", p); notifyListeners("progress", ev); } }
                out.close(); in.close();
                JSObject r = new JSObject(); r.put("path", f.getAbsolutePath()); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(s);
                JSObject r = new JSObject(); r.put("needsPermission", true); call.resolve(r); return;
            }
            File f = new File(getContext().getCacheDir(), "update.apk");
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW); i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i);
            JSObject r = new JSObject(); r.put("needsPermission", false); call.resolve(r);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
}
