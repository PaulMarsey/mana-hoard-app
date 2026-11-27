package uk.co.manahoard.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

/**
 * Mana Hoard as a native Android app: the live shop in a full-screen WebView.
 * - Shop pages stay inside the app (no address bar). Other sites, and Stripe checkout,
 *   open in a secure Chrome tab so Google Pay works; after paying, the shop's thank-you
 *   page brings you back here via manahoard://paid.
 * - Native back button, printing (order summaries / invoices), file picking (CSV imports)
 *   and an offline screen.
 */
public class MainActivity extends Activity {
    private static final int FILE_REQUEST = 42;
    private static final int BG = 0xFF21150E, BAR = 0xFF2A1A10;
    private WebView web;
    private ImageView splash;
    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // draw edge to edge, then pad the content by the system bars ourselves (consistent on every Android version)
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BAR);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        splash = new ImageView(this);
        splash.setImageResource(R.drawable.splash);
        splash.setBackgroundColor(BG);
        splash.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        int pad = (int) (getResources().getDisplayMetrics().density * 56);
        splash.setPadding(pad, pad, pad, pad);
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        setContentView(root);

        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets s = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                l = s.left; t = s.top; r = s.right; b = s.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop(); r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // basket, manager working copy
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " ManaHoardApp/" + BuildConfig.VERSION_NAME);
        web.addJavascriptInterface(new Bridge(), "ManaHoardApp");

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) { return route(req.getUrl()); }
            @Override public void onPageFinished(WebView view, String url) { hideSplash(); }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) { view.loadUrl("file:///android_asset/offline.html"); hideSplash(); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try { startActivityForResult(params.createIntent(), FILE_REQUEST); }
                catch (ActivityNotFoundException e) { fileCallback = null; return false; }
                return true;
            }
        });
        new Handler(Looper.getMainLooper()).postDelayed(this::hideSplash, 6000);

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else open(getIntent());
    }

    /** Decide where a link goes: the shop stays in the app, everything else leaves it. */
    private boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        String path = u.getPath() == null ? "" : u.getPath();
        if (scheme.equals("https") && BuildConfig.SHOP_HOST.equals(u.getHost()) && path.startsWith(BuildConfig.SHOP_PATH)) return false;
        if (scheme.equals("file")) return false;
        if (scheme.equals("https") || scheme.equals("http")) { openTab(u); return true; }   // Stripe checkout, Scryfall, etc.
        try {
            Intent i = scheme.equals("intent") ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
            startActivity(i);                                                               // mailto:, tel:, other apps
        } catch (Exception ignored) { }
        return true;
    }

    private void openTab(Uri u) {
        try {
            CustomTabsIntent tab = new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(BAR).setNavigationBarColor(BAR).build())
                .setShowTitle(true).build();
            tab.launchUrl(this, u);
        } catch (Exception e) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
        }
    }

    /** Open the shop, a shop link, or the thank-you page after paying (manahoard://paid?session=…). */
    private void open(Intent intent) {
        Uri d = intent == null ? null : intent.getData();
        String url = BuildConfig.SHOP_URL;
        if (d != null && "manahoard".equals(d.getScheme()) && "paid".equals(d.getHost())) {
            String session = d.getQueryParameter("session");
            url = BuildConfig.SHOP_URL + "?paid=" + Uri.encode(session == null ? "1" : session) + "#thanks";
        } else if (d != null && "https".equals(d.getScheme()) && BuildConfig.SHOP_HOST.equals(d.getHost())) {
            url = d.toString();
        }
        web.loadUrl(url);
    }

    private void hideSplash() {
        if (splash == null || splash.getVisibility() != View.VISIBLE) return;
        splash.animate().alpha(0f).setDuration(280).withEndAction(() -> splash.setVisibility(View.GONE)).start();
    }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); if (intent != null && intent.getData() != null) open(intent); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    /** Small bridge the shop page can call: window.ManaHoardApp.print(title) */
    private class Bridge {
        @JavascriptInterface public boolean isApp() { return true; }
        @JavascriptInterface public void print(String title) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                String name = (title == null || title.isEmpty()) ? "Mana Hoard" : title;
                if (pm != null) pm.print(name, web.createPrintDocumentAdapter(name), new PrintAttributes.Builder().build());
            });
        }
    }
}
