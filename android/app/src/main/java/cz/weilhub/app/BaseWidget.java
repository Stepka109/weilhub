package cz.weilhub.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/** Společný základ obou widgetů: načtení dat na pozadí a překreslení. */
abstract class BaseWidget extends AppWidgetProvider {

    private void refreshAsync(Context context, boolean fetch) {
        final PendingResult result = goAsync();
        final Context c = context.getApplicationContext();
        new Thread(() -> {
            try {
                WidgetUpdater.renderAll(c);
                if (fetch) {
                    WidgetUpdater.refreshIfNeeded(c, false);
                    WidgetUpdater.renderAll(c);
                }
            } finally {
                result.finish();
            }
        }).start();
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager m, int[] ids) {
        refreshAsync(context, true);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager m, int id, Bundle options) {
        WidgetUpdater.render(context, m, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (WidgetUpdater.ACTION_TICK.equals(intent.getAction())) refreshAsync(context, true);
        else super.onReceive(context, intent);
    }
}
