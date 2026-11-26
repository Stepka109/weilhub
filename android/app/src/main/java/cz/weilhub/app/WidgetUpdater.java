package cz.weilhub.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

/** Načtení rozvrhu a překreslení všech widgetů. */
final class WidgetUpdater {
    private WidgetUpdater() {}

    static final String ACTION_TICK = "cz.weilhub.app.TICK";
    private static final long MAX_AGE = 30 * 60 * 1000L;

    /** Stáhne rozvrh, pokud je uložený starý nebo už skončila výuka. Volat mimo hlavní vlákno. */
    static void refreshIfNeeded(Context c, boolean force) {
        if (Store.key(c) == null) return;
        String cache = Store.cache(c);
        Model.Day day = cache == null ? null : Model.parse(cache);
        boolean stale = System.currentTimeMillis() - Store.fetchedAt(c) > MAX_AGE;
        if (force || day == null || stale || Model.isOver(day)) Api.fetch(c);
    }

    static void renderAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> cls : new Class<?>[] {RozvrhWidget.class, TedWidget.class, JidelnaWidget.class}) {
            for (int id : m.getAppWidgetIds(new ComponentName(c, cls))) render(c, m, id);
        }
        schedule(c);
    }

    static void render(Context c, AppWidgetManager m, int id) {
        android.appwidget.AppWidgetProviderInfo info = m.getAppWidgetInfo(id);
        String cls = info != null && info.provider != null ? info.provider.getClassName() : "";
        boolean small = cls.endsWith("TedWidget");
        boolean canteen = cls.endsWith("JidelnaWidget");
        Bundle o = m.getAppWidgetOptions(id);
        int wDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int hDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (wDp <= 0) wDp = small ? 160 : 330;
        if (hDp <= 0) hDp = small ? 160 : 250;

        boolean linked = Store.key(c) != null;
        String cache = Store.cache(c);
        Model.Day day = cache == null ? null : Model.parse(cache);
        String error = Store.error(c);
        String message = !linked ? "Otevři aplikaci WeilHub a propoj ji se svým účtem."
                : day == null ? (error != null ? error : cache != null ? "V nejbližších dnech není výuka." : "Načítám rozvrh…") : null;
        boolean offline = error != null && day != null;

        RemoteViews v;
        if (canteen) {
            v = canteen(c, cache, message);
        } else if (small || wDp < 200) {
            v = small(c, day, message);
        } else {
            v = new RemoteViews(c.getPackageName(), R.layout.widget_list);
            // Obě varianty; telefon sám ukáže tu, která odpovídá světlému / tmavému vzhledu
            v.setImageViewBitmap(R.id.img, Renderer.list(c, day, message, offline, wDp, hDp, false));
            v.setImageViewBitmap(R.id.img_dark, Renderer.list(c, day, message, offline, wDp, hDp, true));
        }
        v.setOnClickPendingIntent(R.id.root, linked ? openWeb(c, canteen ? "/jidelna" : "/rozvrh") : openApp(c));
        m.updateAppWidget(id, v);
    }

    /** Barva textu ze zdrojů – na Androidu 12+ se přepne i se světlým / tmavým vzhledem. */
    private static void color(Context c, RemoteViews v, int id, int res) {
        if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(id, "setTextColor", res);
        else v.setTextColor(id, c.getColor(res));
    }

    private static RemoteViews small(Context c, Model.Day day, String message) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_small);
        v.setViewVisibility(R.id.bar, View.GONE);
        v.setViewVisibility(R.id.timer, View.GONE);
        v.setTextViewText(R.id.timer_label, "");
        v.setTextViewText(R.id.next, "");
        v.setTextViewText(R.id.room, "");
        v.setTextViewText(R.id.detail, "");
        color(c, v, R.id.label, R.color.teal);
        color(c, v, R.id.code, R.color.navy);
        color(c, v, R.id.room, R.color.teal);

        if (day == null) {
            v.setTextViewText(R.id.label, "WEILHUB");
            v.setTextViewText(R.id.code, message);
            v.setTextViewTextSize(R.id.code, android.util.TypedValue.COMPLEX_UNIT_SP, 15);
            return v;
        }
        v.setTextViewTextSize(R.id.code, android.util.TypedValue.COMPLEX_UNIT_SP, 28);
        Model.State st = Model.state(day);
        String rel = st.relative.isEmpty() ? day.label : st.relative;

        if (day.ovKind != null && !day.ovKind.isEmpty()) {
            boolean event = "event".equals(day.ovKind);
            v.setTextViewText(R.id.label, (rel + " · " + (event ? "akce" : "volno")).toUpperCase());
            color(c, v, R.id.label, event ? R.color.green : R.color.purple);
            v.setTextViewText(R.id.code, day.ovTitle);
            v.setTextViewTextSize(R.id.code, android.util.TypedValue.COMPLEX_UNIT_SP, 18);
            v.setTextViewText(R.id.room, day.ovRoom);
            return v;
        }
        Model.Lesson pick = st.pick;
        if (pick == null) {
            v.setTextViewText(R.id.label, "DNES");
            v.setTextViewText(R.id.code, "Dnes už žádná hodina");
            v.setTextViewTextSize(R.id.code, android.util.TypedValue.COMPLEX_UNIT_SP, 16);
            return v;
        }
        boolean isNow = !st.current.isEmpty();
        String when = isNow ? "Teď · " : st.isToday ? "Další · " : rel + " · ";
        v.setTextViewText(R.id.label, (when + pick.num() + " hodina").toUpperCase());
        if (isNow) color(c, v, R.id.label, R.color.orange);

        boolean cancelled = "cancelled".equals(pick.status);
        if (cancelled) {
            v.setTextViewText(R.id.code, pick.code.isEmpty() ? "Hodina" : pick.code);
            color(c, v, R.id.code, R.color.red);
            v.setTextViewText(R.id.room, "odpadá");
            color(c, v, R.id.room, R.color.red);
        } else {
            v.setTextViewText(R.id.code, pick.title());
            v.setTextViewText(R.id.room, pick.room);
            if ("roomchanged".equals(pick.status)) color(c, v, R.id.room, R.color.red);
            v.setTextViewText(R.id.detail, pick.sub());
        }

        // Odpočet běží v telefonu sám (Chronometer), i mezi překreslením widgetu
        int now = Model.nowMin();
        if (isNow) {
            int done = Math.round(1000f * (now - pick.startMin) / Math.max(1, pick.endMin - pick.startMin));
            v.setViewVisibility(R.id.bar, View.VISIBLE);
            v.setProgressBar(R.id.bar, 1000, Math.max(0, Math.min(1000, done)), false);
        }
        if (st.isToday) {
            long target = millisAt(isNow ? pick.endMin : pick.startMin);
            long base = SystemClock.elapsedRealtime() + (target - System.currentTimeMillis());
            v.setTextViewText(R.id.timer_label, isNow ? "konec za " : "začíná za ");
            v.setViewVisibility(R.id.timer, View.VISIBLE);
            v.setChronometer(R.id.timer, base, null, true);
            v.setChronometerCountDown(R.id.timer, true);
            color(c, v, R.id.timer, isNow ? R.color.orange : R.color.teal);
        } else {
            v.setTextViewText(R.id.timer_label, "začíná v " + pick.start);
        }
        if (isNow && st.next != null) {
            Model.Lesson n = st.next;
            v.setTextViewText(R.id.next, "Pak " + n.num() + " " + n.title() + (n.room.isEmpty() ? "" : " " + n.room));
        }
        return v;
    }

    private static final int[][] ROWS = {
        {R.id.row1, R.id.lab1, R.id.name1}, {R.id.row2, R.id.lab2, R.id.name2},
        {R.id.row3, R.id.lab3, R.id.name3}, {R.id.row4, R.id.lab4, R.id.name4},
    };

    /** Widget jídelny: polévka a jídla na výběr. */
    private static RemoteViews canteen(Context c, String cache, String message) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_canteen);
        java.util.List<Model.CanteenDay> days = cache == null ? java.util.Collections.emptyList() : Model.parseCanteen(cache);
        for (int[] r : ROWS) v.setViewVisibility(r[0], View.GONE);
        if (days.isEmpty()) {
            v.setTextViewText(R.id.c_label, "JÍDELNA");
            v.setTextViewText(R.id.c_msg, message != null ? message : "Jídelníček zatím není zveřejněný.");
            v.setViewVisibility(R.id.c_msg, View.VISIBLE);
            return v;
        }
        Model.CanteenDay day = days.get(0);
        v.setViewVisibility(R.id.c_msg, View.GONE);
        v.setTextViewText(R.id.c_label, ("Oběd · " + Model.dayLabel(day.date)).toUpperCase());
        for (int i = 0; i < ROWS.length && i < day.dishes.size(); i++) {
            Model.Dish d = day.dishes.get(i);
            boolean soup = "soup".equals(d.kind);
            v.setViewVisibility(ROWS[i][0], View.VISIBLE);
            v.setTextViewText(ROWS[i][1], soup ? "Polévka" : d.label);
            color(c, v, ROWS[i][1], soup ? R.color.orange : R.color.teal);
            v.setTextViewText(ROWS[i][2], d.name);
        }
        return v;
    }

    private static long millisAt(int minuteOfDay) {
        return LocalDate.now().atTime(LocalTime.of(minuteOfDay / 60 % 24, minuteOfDay % 60))
                .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    /** Další překreslení: na začátku nebo konci nejbližší hodiny, jinak za 30 minut. */
    static void schedule(Context c) {
        long next = System.currentTimeMillis() + MAX_AGE;
        String cache = Store.cache(c);
        Model.Day day = cache == null ? null : Model.parse(cache);
        if (day != null && LocalDate.now().toString().equals(day.date)) {
            int now = Model.nowMin();
            int best = Integer.MAX_VALUE;
            for (Model.Lesson l : day.lessons) {
                if (l.startMin > now) best = Math.min(best, l.startMin);
                if (l.endMin > now) best = Math.min(best, l.endMin);
            }
            if (best != Integer.MAX_VALUE) next = Math.min(next, millisAt(best) + 15_000);
        }
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        Intent i = new Intent(c, RozvrhWidget.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.setWindow(AlarmManager.RTC, next, 60_000, pi);
    }

    private static PendingIntent openWeb(Context c, String path) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(Store.base(c) + path)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, path.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 3, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
