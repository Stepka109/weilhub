package cz.weilhub.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * Velký widget „Rozvrh“ vykreslený do obrázku – stejný vzhled jako widget
 * na iPhonu (hlavička s logem, karty hodin v barvách rozvrhu, čárkované
 * rámečky u změn). Kreslí se v jednotkách dp.
 */
final class Renderer {
    private Renderer() {}

    static final int BG = Color.WHITE, PAGE = 0xFFF4F7F8, TEXT = 0xFF162B4F, MUTED = 0xFF5B6676, NAVY = 0xFF1B3A6B,
            TEAL = 0xFF0A7C83, TEAL_SOFT = 0xFFDBF2F1, LIME = 0xFF8DC63F, CYAN = 0xFF1FC2CA,
            CELL = 0xFFEEF4FB, CELL_BORDER = 0xFFCDD9E8, RED = 0xFFDB2D2D, GREEN = 0xFF4F9A12, PURPLE = 0xFF7C4DDC,
            ORANGE = 0xFFFF8A00, ORANGE_SOFT = 0xFFFFE6CC, NOW_BG = 0xFFFFF7EE,
            S1 = 0xFF0B7D73, S1_BG = 0xFFE2F5F2, S2 = 0xFF4B3FD1, S2_BG = 0xFFEBE8FF;

    private static final Paint FILL = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint STROKE = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final TextPaint TP = new TextPaint(Paint.ANTI_ALIAS_FLAG);

    static {
        STROKE.setStyle(Paint.Style.STROKE);
        STROKE.setStrokeCap(Paint.Cap.ROUND);
        STROKE.setStrokeJoin(Paint.Join.ROUND);
    }

    static Bitmap list(Context c, Model.Day day, String message, boolean offline, int wDp, int hDp) {
        float density = c.getResources().getDisplayMetrics().density;
        float scale = Math.min(density, 3f);
        int w = Math.max(1, Math.round(wDp * scale)), h = Math.max(1, Math.round(hDp * scale));
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        cv.scale(scale, scale);
        float W = wDp, H = hDp, p = 12;

        rect(cv, 0, 0, W, H, 22, BG);

        if (day == null) {
            logo(cv, p, p, 22);
            text(cv, "WeilHub", p + 30, p + 2, W - 60, 18, 15, true, NAVY, Paint.Align.LEFT);
            text(cv, message == null ? "Načítám rozvrh…" : message, p, H / 2 - 20, W - 2 * p, 40, 13, false, MUTED, Paint.Align.CENTER);
            return bmp;
        }
        Model.State st = Model.state(day);

        // Hlavička: logo, den, vpravo pilulky
        logo(cv, p, p - 1, 22);
        float right = W - p;
        if (offline) right = pill(cv, "offline", right, p, MUTED, PAGE) - 4;
        if ("S1".equals(day.group)) right = pill(cv, "S1", right, p, S1, S1_BG) - 4;
        if ("S2".equals(day.group)) right = pill(cv, "S2", right, p, S2, S2_BG) - 4;
        if (!day.cycleWeek.isEmpty()) right = pill(cv, "týden " + day.cycleWeek, right, p, TEAL, TEAL_SOFT) - 6;
        float tx = p + 30;
        if (!st.relative.isEmpty()) {
            text(cv, st.relative.toUpperCase(), tx, p - 2, right - tx, 13, 9.5f, true, TEAL, Paint.Align.LEFT);
            text(cv, day.label, tx, p + 9, right - tx, 17, 14, true, NAVY, Paint.Align.LEFT);
        } else {
            text(cv, day.label, tx, p + 2, right - tx, 18, 15, true, NAVY, Paint.Align.LEFT);
        }
        float sy = p + 28, third = (W - 2 * p) / 3;
        rect(cv, p, sy, third, 2, 0, LIME);
        rect(cv, p + third, sy, third, 2, 0, TEAL);
        rect(cv, p + 2 * third, sy, third, 2, 0, CYAN);
        float y = sy + 8;

        if (day.ovKind != null && !day.ovKind.isEmpty()) {
            boolean event = "event".equals(day.ovKind);
            RectF r = new RectF(p, y, W - p, H - p);
            if (event) dashed(cv, r, 12, GREEN, 2);
            else stroke(cv, r, 12, PURPLE, 2);
            text(cv, event ? "Celodenní akce" : "Volno", p, r.centerY() - 26, r.width(), 16, 12, false, MUTED, Paint.Align.CENTER);
            text(cv, day.ovTitle, p + 10, r.centerY() - 8, r.width() - 20, 22, 16, true, TEXT, Paint.Align.CENTER);
            return bmp;
        }

        float rowH = H < 200 ? 31 : 34, gap = 4;
        int fit = Math.max(1, (int) Math.floor((H - y - p + gap) / (rowH + gap)));
        List<Model.Lesson> list = new ArrayList<>(day.lessons);
        int now = Model.nowMin();
        // Když se všechno nevejde, začít probíhající nebo další hodinou
        if (st.isToday && (H < 200 || list.size() > fit)) {
            int idx = -1;
            for (int i = 0; i < list.size(); i++) if (list.get(i).endMin > now) { idx = i; break; }
            if (idx > 0) list = new ArrayList<>(list.subList(idx, list.size()));
        }
        int more = 0;
        if (list.size() > fit) {
            more = list.size() - (fit - 1);
            list = new ArrayList<>(list.subList(0, fit - 1));
        }
        for (Model.Lesson l : list) {
            row(cv, l, p, y, W - 2 * p, rowH, st.current.contains(l), now);
            y += rowH + gap;
        }
        if (more > 0) text(cv, "+ " + more + " další", p, y + 2, W - 2 * p, 16, 11, false, MUTED, Paint.Align.CENTER);
        return bmp;
    }

    private static void row(Canvas cv, Model.Lesson l, float x, float y, float w, float h, boolean isNow, int now) {
        float mid = y + h / 2;
        text(cv, l.num(), x, mid - 15, 34, 16, 13, true, isNow ? ORANGE : TEXT, Paint.Align.CENTER);
        text(cv, l.start, x, mid + 1, 34, 13, 10, false, isNow ? ORANGE : MUTED, Paint.Align.CENTER);

        float cx = x + 38, cw = w - 38;
        RectF card = new RectF(cx, y, cx + cw, y + h);
        int fill = CELL, border = CELL_BORDER;
        float lw = 1;
        boolean dashed = false, tag = false;
        String tagText = "";
        switch (l.status) {
            case "changed": fill = BG; border = RED; lw = 2; tag = true; tagText = "S"; break;
            case "roomchanged": fill = BG; border = RED; lw = 2; dashed = true; tag = true; tagText = "M"; break;
            case "cancelled": fill = BG; border = "green".equals(l.accent) ? GREEN : RED; lw = 2; dashed = true; tag = true; tagText = "O"; break;
            case "event": fill = BG; border = GREEN; lw = 2; dashed = true; tag = true; tagText = "A"; break;
            case "new": fill = BG; border = GREEN; lw = 2; tag = true; tagText = "N"; break;
            default:
                if (isNow) { fill = NOW_BG; border = ORANGE; lw = 2; }
        }
        rect(cv, card.left, card.top, card.width(), card.height(), 9, fill);
        if (dashed) dashed(cv, card, 9, border, lw);
        else stroke(cv, card, 9, border, lw);
        if (isNow && !"default".equals(l.status)) stroke(cv, new RectF(cx + 3, y + 3, cx + cw - 3, y + h - 3), 7, ORANGE, 2);
        if (tag) {
            rect(cv, cx - 1, mid - 8, 14, 16, 4, border);
            text(cv, tagText, cx - 1, mid - 7, 14, 14, 10, true, Color.WHITE, Paint.Align.CENTER);
        }

        float groupW = "S1".equals(l.group) || "S2".equals(l.group) ? 24 : 0;
        if (groupW > 0) {
            boolean s1 = "S1".equals(l.group);
            rect(cv, cx + cw - groupW - 2, mid - 6, groupW - 4, 12, 3, s1 ? S1_BG : S2_BG);
            text(cv, l.group, cx + cw - groupW - 2, mid - 6, groupW - 4, 12, 8, true, s1 ? S1 : S2, Paint.Align.CENTER);
        }
        float tx = cx + (tag ? 18 : 10), right = cx + cw - groupW - 8;
        if ("cancelled".equals(l.status)) {
            text(cv, l.title(), cx + 16, mid - 9, cw - 32 - groupW, 18, 13, true, border, Paint.Align.CENTER);
        } else {
            float roomW = 46;
            text(cv, l.title(), tx, mid - 9, 50, 18, 14, true, TEXT, Paint.Align.LEFT);
            text(cv, l.sub(), tx + 50, mid - 7, right - roomW - (tx + 50) - 4, 15, 11, false, MUTED, Paint.Align.LEFT);
            text(cv, l.room, right - roomW, mid - 8, roomW, 16, 12, true, "roomchanged".equals(l.status) ? RED : TEXT, Paint.Align.RIGHT);
        }
        // Probíhající hodina: pruh, kolik už uplynulo
        if (isNow) {
            float done = Math.max(0, Math.min(1, (now - l.startMin) / (float) Math.max(1, l.endMin - l.startMin)));
            rect(cv, cx + 10, y + h - 5, cw - 20, 2.5f, 1.25f, ORANGE_SOFT);
            if (done > 0) rect(cv, cx + 10, y + h - 5, Math.max(2.5f, (cw - 20) * done), 2.5f, 1.25f, ORANGE);
        }
    }

    /* ------------------------------------------------------------ pomocné */

    static void logo(Canvas cv, float x, float y, float size) {
        float k = size / 40f;
        rect(cv, x, y, size, size, 12 * k, NAVY);
        Path book = new Path();
        book.moveTo(x + 8 * k, y + 11.5f * k);
        book.cubicTo(x + 11.6f * k, y + 10.9f * k, x + 14.9f * k, y + 11.9f * k, x + 17.6f * k, y + 14.1f * k);
        book.lineTo(x + 20 * k, y + 16 * k);
        book.lineTo(x + 22.4f * k, y + 14.1f * k);
        book.cubicTo(x + 25.1f * k, y + 11.9f * k, x + 28.4f * k, y + 10.9f * k, x + 32 * k, y + 11.5f * k);
        STROKE.setPathEffect(null);
        STROKE.setColor(LIME);
        STROKE.setStrokeWidth(2.2f * k);
        cv.drawPath(book, STROKE);
        Path wp = new Path();
        wp.moveTo(x + 9 * k, y + 15.5f * k);
        wp.lineTo(x + 14 * k, y + 29 * k);
        wp.lineTo(x + 20 * k, y + 18.5f * k);
        wp.lineTo(x + 26 * k, y + 29 * k);
        wp.lineTo(x + 31 * k, y + 15.5f * k);
        STROKE.setColor(CYAN);
        STROKE.setStrokeWidth(3.4f * k);
        cv.drawPath(wp, STROKE);
    }

    private static float pill(Canvas cv, String s, float right, float y, int fg, int bg) {
        TP.setTextSize(10.5f);
        TP.setTypeface(Typeface.DEFAULT_BOLD);
        float w = TP.measureText(s) + 14;
        rect(cv, right - w, y, w, 18, 9, bg);
        text(cv, s, right - w, y + 2, w, 14, 10.5f, true, fg, Paint.Align.CENTER);
        return right - w;
    }

    private static void rect(Canvas cv, float x, float y, float w, float h, float r, int color) {
        FILL.setColor(color);
        cv.drawRoundRect(new RectF(x, y, x + w, y + h), r, r, FILL);
    }

    private static void stroke(Canvas cv, RectF r, float radius, int color, float lw) {
        STROKE.setPathEffect(null);
        STROKE.setColor(color);
        STROKE.setStrokeWidth(lw);
        RectF in = new RectF(r.left + lw / 2, r.top + lw / 2, r.right - lw / 2, r.bottom - lw / 2);
        cv.drawRoundRect(in, radius, radius, STROKE);
    }

    private static void dashed(Canvas cv, RectF r, float radius, int color, float lw) {
        STROKE.setPathEffect(new DashPathEffect(new float[] {4, 3}, 0));
        STROKE.setColor(color);
        STROKE.setStrokeWidth(lw);
        RectF in = new RectF(r.left + lw / 2, r.top + lw / 2, r.right - lw / 2, r.bottom - lw / 2);
        cv.drawRoundRect(in, radius, radius, STROKE);
        STROKE.setPathEffect(null);
    }

    private static void text(Canvas cv, String s, float x, float y, float w, float h, float size, boolean bold, int color, Paint.Align align) {
        if (s == null || s.isEmpty() || w <= 4) return;
        TP.setTextSize(size);
        TP.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        TP.setColor(color);
        TP.setTextAlign(align);
        CharSequence t = TextUtils.ellipsize(s, TP, w, TextUtils.TruncateAt.END);
        float base = y + h / 2 - (TP.ascent() + TP.descent()) / 2;
        float ax = align == Paint.Align.LEFT ? x : align == Paint.Align.RIGHT ? x + w : x + w / 2;
        cv.drawText(t, 0, t.length(), ax, base, TP);
    }
}
