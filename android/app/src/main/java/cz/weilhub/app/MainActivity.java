package cz.weilhub.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.Date;

/**
 * Úvodní obrazovka: propojení s účtem (odkazem z webu nebo vložením klíče),
 * přidání widgetů na plochu a ruční obnovení rozvrhu.
 */
public class MainActivity extends Activity {

    private LinearLayout box;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Renderer.PAGE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Renderer.PAGE);
        scroll.setFitsSystemWindows(true);
        box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(22), dp(28), dp(22), dp(28));
        scroll.addView(box);
        setContentView(scroll);
        handle(getIntent());
        build();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handle(intent);
        build();
    }

    @Override
    protected void onResume() {
        super.onResume();
        build();
    }

    /** Odkaz z webu: weilhub://pripojit?key=… */
    private void handle(Intent intent) {
        Uri u = intent == null ? null : intent.getData();
        if (u == null || !"weilhub".equals(u.getScheme()) || !"pripojit".equals(u.getHost())) return;
        String key = u.getQueryParameter("key");
        intent.setData(null);
        // Jen ve vývojové verzi: jiná adresa serveru (testování v emulátoru)
        String url = u.getQueryParameter("url");
        if (url != null && (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) Store.setBase(this, url);
        if (!Store.isKey(key)) {
            toast("Odkaz pro propojení je neplatný. Vytvoř nový na webu WeilHub.");
            return;
        }
        link(key);
    }

    private void link(String key) {
        Store.link(this, key);
        toast("Propojeno – načítám rozvrh…");
        refresh(true);
    }

    private void refresh(boolean force) {
        new Thread(() -> {
            WidgetUpdater.refreshIfNeeded(getApplicationContext(), force);
            WidgetUpdater.renderAll(getApplicationContext());
            runOnUiThread(() -> {
                String err = Store.error(this);
                if (err != null) toast(err);
                build();
            });
        }).start();
    }

    private void build() {
        box.removeAllViews();

        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.logo_mark);
        head.addView(logo, new LinearLayout.LayoutParams(dp(46), dp(46)));
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setPadding(dp(14), 0, 0, 0);
        titles.addView(text("WeilHub", 26, true, Renderer.NAVY));
        titles.addView(text("Rozvrh na plochu telefonu", 14, false, Renderer.MUTED));
        head.addView(titles);
        box.addView(head);
        space(22);

        boolean linked = Store.key(this) != null;
        LinearLayout card = card();
        if (!linked) {
            card.addView(text("Propoj aplikaci se svým účtem", 17, true, Renderer.TEXT));
            card.addView(gap(8));
            card.addView(text("1. Na webu WeilHub otevři Nastavení → Widget na telefon → Android.\n"
                    + "2. Klepni na Vytvořit widget a potom na Propojit aplikaci.\n"
                    + "3. Telefon tě vrátí sem a widget se propojí sám.", 14, false, Renderer.MUTED));
            card.addView(gap(14));
            card.addView(text("Nebo vlož klíč ručně:", 13, true, Renderer.TEXT));
            EditText input = new EditText(this);
            input.setHint("klíč widgetu");
            input.setSingleLine(true);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
            input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            card.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            card.addView(gap(8));
            card.addView(button("Propojit", true, v -> {
                String k = input.getText().toString().trim();
                if (!Store.isKey(k)) toast("Tohle nevypadá jako klíč widgetu.");
                else link(k);
            }));
            box.addView(card);
            space(14);
            box.addView(button("Otevřít WeilHub", false, v -> openWeb("/nastaveni")));
            return;
        }

        long at = Store.fetchedAt(this);
        String err = Store.error(this);
        card.addView(text("Propojeno s účtem", 17, true, Renderer.TEXT));
        card.addView(gap(4));
        card.addView(text(at > 0 ? "Rozvrh načten " + new SimpleDateFormat("H:mm", Locale.forLanguageTag("cs")).format(new Date(at)) : "Rozvrh se načítá…",
                14, false, Renderer.MUTED));
        if (err != null) {
            card.addView(gap(6));
            card.addView(text(err, 14, true, Renderer.RED));
        }
        box.addView(card);
        space(18);

        box.addView(text("Přidat na plochu", 13, true, Renderer.MUTED));
        space(8);
        box.addView(button("Velký widget · Rozvrh", true, v -> pin(RozvrhWidget.class)));
        space(8);
        box.addView(button("Malý widget · Teď a další", true, v -> pin(TedWidget.class)));
        space(6);
        box.addView(text("Widget jde přidat i ručně: podrž prst na ploše → Widgety → WeilHub.", 13, false, Renderer.MUTED));
        space(18);
        box.addView(button("Obnovit rozvrh", false, v -> refresh(true)));
        space(8);
        box.addView(button("Otevřít WeilHub", false, v -> openWeb("/rozvrh")));
        space(8);
        box.addView(button("Odpojit od účtu", false, v -> {
            Store.unlink(this);
            WidgetUpdater.renderAll(this);
            build();
        }));
    }

    private void pin(Class<?> cls) {
        AppWidgetManager m = getSystemService(AppWidgetManager.class);
        if (m != null && m.isRequestPinAppWidgetSupported()) m.requestPinAppWidget(new ComponentName(this, cls), null, null);
        else toast("Podrž prst na ploše → Widgety → WeilHub.");
    }

    private void openWeb(String path) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(Store.base(this) + path)));
    }

    /* ------------------------------------------------------------ pomocné */

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private TextView text(String s, float sp, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setLineSpacing(0, 1.15f);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private View gap(int h) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(h)));
        return v;
    }

    private void space(int h) {
        box.addView(gap(h));
    }

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.WHITE);
        bg.setCornerRadius(dp(22));
        c.setBackground(bg);
        return c;
    }

    private Button button(String label, boolean primary, View.OnClickListener onClick) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(primary ? Color.WHITE : Renderer.NAVY);
        b.setStateListAnimator(null);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(primary ? Renderer.TEAL : Color.WHITE);
        bg.setCornerRadius(dp(16));
        if (!primary) bg.setStroke(dp(1), 0xFFE0E8EC);
        b.setBackground(bg);
        b.setMinHeight(dp(50));
        b.setOnClickListener(onClick);
        b.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return b;
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_LONG).show();
    }
}
