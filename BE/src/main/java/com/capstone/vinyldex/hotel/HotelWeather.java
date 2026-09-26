package com.capstone.vinyldex.hotel;

import java.time.Instant;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Stagione e meteo dell'hotel.
 *
 * La stagione e' quella vera (in Italia): da qui dipendono le decorazioni delle stanze e che tempo
 * puo' fare. Il meteo cambia ogni tre ore ed e' lo stesso per tutti: si ricava dalla fascia oraria,
 * senza servizi esterni, con le probabilita' tipiche della stagione (d'estate caldo e temporali,
 * d'inverno neve e freddo...). Nelle stanze all'aperto si vede: pioggia, neve, vento, sole.
 */
public final class HotelWeather {

    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    /** Ogni quanto cambia il tempo. */
    static final long SLOT_HOURS = 3;

    public enum Season {
        WINTER("winter", "Inverno", 5), SPRING("spring", "Primavera", 16), SUMMER("summer", "Estate", 29), AUTUMN("autumn", "Autunno", 15);

        final String key;
        final String label;
        final int baseTemperature;

        Season(String key, String label, int baseTemperature) {
            this.key = key;
            this.label = label;
            this.baseTemperature = baseTemperature;
        }
    }

    /** Condizione del cielo: chiave per il client, nome, scarto di temperatura, vento forte. */
    enum Condition {
        SUNNY("sunny", "Sole", 2, false),
        HOT("hot", "Caldo afoso", 7, false),
        CLOUDY("cloudy", "Nuvoloso", -1, false),
        RAIN("rain", "Pioggia", -3, false),
        STORM("storm", "Temporale", -2, true),
        WIND("wind", "Vento", -2, true),
        FOG("fog", "Nebbia", -1, false),
        COLD("cold", "Freddo pungente", -4, false),
        SNOW("snow", "Neve", -5, false);

        final String key;
        final String label;
        final int delta;
        final boolean windy;

        Condition(String key, String label, int delta, boolean windy) {
            this.key = key;
            this.label = label;
            this.delta = delta;
            this.windy = windy;
        }
    }

    private record Chance(Condition condition, int weight) {
    }

    private static final Map<Season, List<Chance>> CLIMATE = Map.of(
            Season.WINTER, List.of(new Chance(Condition.SNOW, 25), new Chance(Condition.COLD, 30), new Chance(Condition.CLOUDY, 20),
                    new Chance(Condition.RAIN, 15), new Chance(Condition.FOG, 10)),
            Season.SPRING, List.of(new Chance(Condition.SUNNY, 35), new Chance(Condition.CLOUDY, 20), new Chance(Condition.RAIN, 25),
                    new Chance(Condition.WIND, 15), new Chance(Condition.STORM, 5)),
            Season.SUMMER, List.of(new Chance(Condition.SUNNY, 40), new Chance(Condition.HOT, 30), new Chance(Condition.STORM, 10),
                    new Chance(Condition.WIND, 10), new Chance(Condition.CLOUDY, 10)),
            Season.AUTUMN, List.of(new Chance(Condition.RAIN, 30), new Chance(Condition.WIND, 25), new Chance(Condition.CLOUDY, 20),
                    new Chance(Condition.FOG, 15), new Chance(Condition.SUNNY, 10)));

    /**
     * @param holiday "halloween" o "christmas" nei giorni di festa (decorazioni speciali), altrimenti null
     * @param slot    fascia di tre ore: quando cambia, cambia il tempo
     */
    public record Weather(Season season, Condition condition, int temperature, int wind, String holiday, long slot) {

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("season", season.key);
            map.put("seasonLabel", season.label);
            map.put("condition", condition.key);
            map.put("label", condition.label);
            map.put("temperature", temperature);
            map.put("wind", wind);
            map.put("holiday", holiday);
            return map;
        }

        /** Due parole sul tempo per le chiacchiere degli NPC. */
        public String remark() {
            return switch (condition) {
                case SUNNY -> "Che bel sole oggi!";
                case HOT -> "Che caldo! " + temperature + " gradi, serve un gelato.";
                case CLOUDY -> "Oggi e' tutto grigio, speriamo non piova.";
                case RAIN -> "Piove! Meno male che qui dentro si sta asciutti.";
                case STORM -> "Hai sentito i tuoni? C'e' un temporale!";
                case WIND -> "Che vento, ci porta via il cappello!";
                case FOG -> "C'e' una nebbia che non si vede a un metro.";
                case COLD -> "Brr, fa freddo: " + temperature + " gradi!";
                case SNOW -> "Nevica! Chi fa un pupazzo di neve?";
            };
        }
    }

    private HotelWeather() {
    }

    public static Weather now() {
        return at(Instant.now());
    }

    static Weather at(Instant instant) {
        ZonedDateTime time = instant.atZone(ZONE);
        long slot = instant.getEpochSecond() / (SLOT_HOURS * 3600);
        Season season = seasonOf(time.toLocalDate());
        Random random = new Random(slot * 7_919 + 17);
        List<Chance> chances = CLIMATE.get(season);
        int total = chances.stream().mapToInt(Chance::weight).sum();
        int roll = random.nextInt(total);
        Condition condition = chances.get(chances.size() - 1).condition();
        for (Chance chance : chances) {
            roll -= chance.weight();
            if (roll < 0) {
                condition = chance.condition();
                break;
            }
        }
        // Di notte fa un po' piu' freddo che di giorno.
        int hour = time.getHour();
        int night = hour < 6 || hour >= 21 ? -3 : hour >= 12 && hour < 17 ? 2 : 0;
        int temperature = season.baseTemperature + condition.delta + night + random.nextInt(7) - 3;
        if (condition == Condition.SNOW) temperature = Math.min(temperature, 1);
        int wind = condition.windy ? 35 + random.nextInt(26) : 4 + random.nextInt(15);
        return new Weather(season, condition, temperature, wind, holidayOf(time.toLocalDate()), slot);
    }

    /** Stagioni meteorologiche: inverno da dicembre, primavera da marzo, estate da giugno, autunno da settembre. */
    static Season seasonOf(LocalDate date) {
        return switch (date.getMonth()) {
            case DECEMBER, JANUARY, FEBRUARY -> Season.WINTER;
            case MARCH, APRIL, MAY -> Season.SPRING;
            case JUNE, JULY, AUGUST -> Season.SUMMER;
            default -> Season.AUTUMN;
        };
    }

    /** Halloween dal 20 ottobre al 2 novembre, Natale dal 1 dicembre all'Epifania. */
    static String holidayOf(LocalDate date) {
        MonthDay day = MonthDay.from(date);
        if (!day.isBefore(MonthDay.of(10, 20)) && !day.isAfter(MonthDay.of(11, 2))) return "halloween";
        if (!day.isBefore(MonthDay.of(12, 1)) || !day.isAfter(MonthDay.of(1, 6))) return "christmas";
        return null;
    }
}
