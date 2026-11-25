package cz.weilhub.app;

import android.content.Context;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Stažení rozvrhu z WeilHubu (GET /api/widget s osobním klíčem). Volat mimo hlavní vlákno. */
final class Api {
    private Api() {}

    /** @return null při úspěchu, jinak česká chybová zpráva */
    static String fetch(Context c) {
        String key = Store.key(c);
        if (key == null) return "Aplikace není propojená s účtem.";
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(Store.base(c) + "/api/widget").openConnection();
            con.setConnectTimeout(8000);
            con.setReadTimeout(8000);
            con.setRequestProperty("Authorization", "Bearer " + key);
            con.setRequestProperty("Accept", "application/json");
            int code = con.getResponseCode();
            InputStream in = code >= 400 ? con.getErrorStream() : con.getInputStream();
            String body = read(in);
            JSONObject o = new JSONObject(body);
            if (!o.optBoolean("ok")) {
                String err = o.optString("error", "Rozvrh se nepodařilo načíst.");
                Store.saveError(c, err, code == 401);
                return err;
            }
            Store.saveCache(c, body);
            return null;
        } catch (Exception e) {
            String err = "Bez připojení k internetu.";
            Store.saveError(c, err, false);
            return err;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static String read(InputStream in) throws Exception {
        if (in == null) return "{}";
        try (InputStream s = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = s.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
