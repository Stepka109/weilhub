package cz.weilhub.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Uložený klíč widgetu, adresa WeilHubu a poslední stažený rozvrh. */
final class Store {
    private Store() {}

    static final String DEFAULT_BASE = "https://weilhub.vercel.app";

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("weilhub", Context.MODE_PRIVATE);
    }

    static String key(Context c) {
        return p(c).getString("key", null);
    }

    static String base(Context c) {
        return p(c).getString("base", DEFAULT_BASE);
    }

    static void link(Context c, String key) {
        p(c).edit().putString("key", key).remove("cache").remove("fetchedAt").remove("error").apply();
    }

    static void setBase(Context c, String base) {
        p(c).edit().putString("base", base.replaceAll("/+$", "")).apply();
    }

    static void unlink(Context c) {
        p(c).edit().clear().apply();
    }

    static String cache(Context c) {
        return p(c).getString("cache", null);
    }

    static long fetchedAt(Context c) {
        return p(c).getLong("fetchedAt", 0);
    }

    static String error(Context c) {
        return p(c).getString("error", null);
    }

    static void saveCache(Context c, String body) {
        p(c).edit().putString("cache", body).putLong("fetchedAt", System.currentTimeMillis()).remove("error").apply();
    }

    static void saveError(Context c, String error, boolean keyInvalid) {
        SharedPreferences.Editor e = p(c).edit().putString("error", error);
        // Zrušený klíč: starý rozvrh už neukazovat
        if (keyInvalid) e.remove("cache");
        e.apply();
    }

    /** Klíč z WeilHubu: 43 znaků base64url (jako u widgetu pro iPhone). */
    static boolean isKey(String k) {
        return k != null && k.matches("[A-Za-z0-9_-]{32,128}");
    }
}
