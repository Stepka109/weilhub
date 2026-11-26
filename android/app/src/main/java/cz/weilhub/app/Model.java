package cz.weilhub.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/** Data widgetu z /api/widget (stejná jako pro widget na iPhonu). */
final class Model {
    private Model() {}

    static final class Lesson {
        int lesson, lessonTo, startMin, endMin;
        String start, end, status, code, name, teacher, room, detail, group, accent;

        String num() {
            return lessonTo > lesson ? lesson + ".–" + lessonTo + "." : lesson + ".";
        }

        String title() {
            if ("cancelled".equals(status)) return (code.isEmpty() ? "" : code + " ") + "odpadá";
            if ("event".equals(status)) return code.isEmpty() ? "AKT" : code;
            return code;
        }

        String sub() {
            if ("event".equals(status)) return !name.isEmpty() ? name : detail;
            return !detail.isEmpty() ? detail : teacher;
        }
    }

    static final class Day {
        String date, label, cycleWeek, group;
        String ovKind, ovTitle, ovRoom;
        final List<Lesson> lessons = new ArrayList<>();
    }

    /** Stav vůči aktuálnímu času: probíhající, další a pozdější hodiny. */
    static final class State {
        boolean isToday;
        String relative;
        final List<Lesson> current = new ArrayList<>();
        final List<Lesson> upcoming = new ArrayList<>();
        Lesson pick, next;
    }

    private static String str(JSONObject o, String k) {
        return o == null || o.isNull(k) ? "" : o.optString(k, "");
    }

    static int mins(String t) {
        try {
            String[] p = t.split(":");
            return Integer.parseInt(p[0].trim()) * 60 + Integer.parseInt(p[1].trim());
        } catch (Exception e) {
            return 0;
        }
    }

    static int nowMin() {
        LocalTime t = LocalTime.now();
        return t.getHour() * 60 + t.getMinute();
    }

    static Day parse(String body) {
        try {
            JSONObject d = new JSONObject(body).optJSONObject("day");
            if (d == null) return null;
            Day day = new Day();
            day.date = str(d, "date");
            day.label = str(d, "label");
            day.cycleWeek = str(d, "cycleWeek");
            day.group = str(d, "group");
            JSONObject ov = d.optJSONObject("dayOverride");
            if (ov != null) {
                day.ovKind = str(ov, "kind");
                day.ovTitle = str(ov, "title");
                day.ovRoom = str(ov, "room");
            }
            JSONArray ls = d.optJSONArray("lessons");
            for (int i = 0; ls != null && i < ls.length(); i++) {
                JSONObject o = ls.getJSONObject(i);
                Lesson l = new Lesson();
                l.lesson = o.optInt("lesson");
                l.lessonTo = o.optInt("lessonTo", l.lesson);
                l.start = str(o, "start");
                l.end = str(o, "end");
                l.startMin = mins(l.start);
                l.endMin = mins(l.end);
                l.status = str(o, "status");
                l.code = str(o, "code");
                l.name = str(o, "name");
                l.teacher = str(o, "teacher");
                l.room = str(o, "room");
                l.detail = str(o, "detail");
                l.group = str(o, "group");
                l.accent = str(o, "accent");
                day.lessons.add(l);
            }
            return day;
        } catch (Exception e) {
            return null;
        }
    }

    static State state(Day day) {
        State s = new State();
        LocalDate today = LocalDate.now();
        s.isToday = today.toString().equals(day.date);
        s.relative = s.isToday ? "Dnes" : today.plusDays(1).toString().equals(day.date) ? "Zítra" : "";
        int now = nowMin();
        for (Lesson l : day.lessons) {
            if (s.isToday && now >= l.startMin && now < l.endMin) s.current.add(l);
            if (!s.isToday || l.startMin > now) s.upcoming.add(l);
        }
        s.pick = !s.current.isEmpty() ? s.current.get(0) : s.upcoming.isEmpty() ? null : s.upcoming.get(0);
        List<Lesson> rest = s.current.isEmpty() && !s.upcoming.isEmpty() ? s.upcoming.subList(1, s.upcoming.size()) : s.upcoming;
        for (Lesson l : rest) {
            if (s.pick == null || l.lesson != s.pick.lesson) {
                s.next = l;
                break;
            }
        }
        return s;
    }

    static final class Dish {
        String kind, label, name;
    }

    static final class CanteenDay {
        String date;
        final List<Dish> dishes = new ArrayList<>();
    }

    /** Oběd v jídelně z odpovědi /api/widget (dnes, po obědech další dny). */
    static List<CanteenDay> parseCanteen(String body) {
        List<CanteenDay> out = new ArrayList<>();
        try {
            JSONArray days = new JSONObject(body).optJSONArray("canteen");
            for (int i = 0; days != null && i < days.length(); i++) {
                JSONObject d = days.getJSONObject(i);
                CanteenDay day = new CanteenDay();
                day.date = str(d, "date");
                JSONArray dishes = d.optJSONArray("dishes");
                for (int k = 0; dishes != null && k < dishes.length(); k++) {
                    JSONObject o = dishes.getJSONObject(k);
                    Dish dish = new Dish();
                    dish.kind = str(o, "kind");
                    dish.label = str(o, "label");
                    dish.name = str(o, "name");
                    day.dishes.add(dish);
                }
                out.add(day);
            }
        } catch (Exception ignored) {
            // bez jídelníčku
        }
        return out;
    }

    /** Dnes, Zítra nebo název dne s datem. */
    static String dayLabel(String iso) {
        try {
            LocalDate d = LocalDate.parse(iso);
            LocalDate today = LocalDate.now();
            if (d.equals(today)) return "Dnes";
            if (d.equals(today.plusDays(1))) return "Zítra";
            String[] names = {"Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"};
            return names[d.getDayOfWeek().getValue() - 1] + " " + d.getDayOfMonth() + ". " + d.getMonthValue() + ".";
        } catch (Exception e) {
            return iso;
        }
    }

    /** Výuka v uloženém dni už skončila (nebo je to starý den) – je čas načíst další. */
    static boolean isOver(Day day) {
        String today = LocalDate.now().toString();
        if (day.date.compareTo(today) < 0) return true;
        if (!day.date.equals(today)) return false;
        int last = 0;
        for (Lesson l : day.lessons) last = Math.max(last, l.endMin);
        if (day.lessons.isEmpty()) last = 15 * 60;
        return nowMin() >= last;
    }
}
