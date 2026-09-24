package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.function.BiPredicate;

/**
 * Percorso fra due caselle con A*, in otto direzioni come su Habbo.
 *
 * Regole:
 * - si passa solo sulle caselle della stanza non bloccate (mobili, altri avatar);
 * - fra due caselle vicine il dislivello massimo e' 1, come un gradino;
 * - in diagonale non si tagliano gli angoli: servono libere anche le due caselle di lato,
 *   altrimenti l'avatar attraverserebbe lo spigolo di un mobile.
 */
public final class Pathfinder {

    /** Limite di caselle esplorate: le stanze sono piccole, oltre qualcosa non va. */
    private static final int MAX_NODES = 4000;

    private static final int[][] DIRECTIONS = {
            {1, 0}, {-1, 0}, {0, 1}, {0, -1}, {1, 1}, {1, -1}, {-1, 1}, {-1, -1}};

    public record Step(int x, int y, int z) {
    }

    private record Node(int x, int y, double g, double f) {
    }

    private Pathfinder() {
    }

    /**
     * @param blocked caselle occupate; la partenza non viene mai considerata bloccata.
     * @return i passi dalla casella dopo la partenza fino all'arrivo compreso; vuoto se
     * l'arrivo non e' raggiungibile o coincide con la partenza.
     */
    public static List<Step> find(RoomLayout layout, int fromX, int fromY, int toX, int toY,
                                  BiPredicate<Integer, Integer> blocked) {
        if (!layout.isTile(toX, toY) || blocked.test(toX, toY)) return List.of();
        if (fromX == toX && fromY == toY) return List.of();

        int width = layout.width();
        Map<Integer, Integer> cameFrom = new HashMap<>();
        Map<Integer, Double> bestG = new HashMap<>();
        PriorityQueue<Node> open = new PriorityQueue<>((a, b) -> Double.compare(a.f(), b.f()));

        int start = fromY * width + fromX;
        bestG.put(start, 0.0);
        open.add(new Node(fromX, fromY, 0, heuristic(fromX, fromY, toX, toY)));

        int expanded = 0;
        while (!open.isEmpty() && expanded++ < MAX_NODES) {
            Node current = open.poll();
            int currentKey = current.y() * width + current.x();
            if (current.x() == toX && current.y() == toY) {
                return rebuild(layout, cameFrom, width, currentKey, start);
            }
            if (current.g() > bestG.getOrDefault(currentKey, Double.MAX_VALUE)) continue;

            for (int[] d : DIRECTIONS) {
                int nx = current.x() + d[0];
                int ny = current.y() + d[1];
                if (!canStep(layout, current.x(), current.y(), nx, ny, blocked)) continue;

                boolean diagonal = d[0] != 0 && d[1] != 0;
                if (diagonal && (!canStep(layout, current.x(), current.y(), current.x() + d[0], current.y(), blocked)
                        || !canStep(layout, current.x(), current.y(), current.x(), current.y() + d[1], blocked))) {
                    continue;
                }

                double g = current.g() + (diagonal ? 1.4142 : 1.0);
                int key = ny * width + nx;
                if (g < bestG.getOrDefault(key, Double.MAX_VALUE)) {
                    bestG.put(key, g);
                    cameFrom.put(key, currentKey);
                    open.add(new Node(nx, ny, g, g + heuristic(nx, ny, toX, toY)));
                }
            }
        }
        return List.of();
    }

    private static boolean canStep(RoomLayout layout, int fromX, int fromY, int toX, int toY,
                                   BiPredicate<Integer, Integer> blocked) {
        if (!layout.isTile(toX, toY) || blocked.test(toX, toY)) return false;
        return Math.abs(layout.heightAt(toX, toY) - layout.heightAt(fromX, fromY)) <= 1;
    }

    /** Distanza "octile": esatta per movimenti in otto direzioni con diagonale da radice di 2. */
    private static double heuristic(int x, int y, int toX, int toY) {
        int dx = Math.abs(x - toX);
        int dy = Math.abs(y - toY);
        return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
    }

    private static List<Step> rebuild(RoomLayout layout, Map<Integer, Integer> cameFrom, int width, int end, int start) {
        List<Step> steps = new ArrayList<>();
        int key = end;
        while (key != start) {
            int x = key % width;
            int y = key / width;
            steps.add(new Step(x, y, layout.heightAt(x, y)));
            key = cameFrom.get(key);
        }
        Collections.reverse(steps);
        return steps;
    }
}
