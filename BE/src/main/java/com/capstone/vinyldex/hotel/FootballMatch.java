package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * Partita di calcio in una stanza con due porte (football_goal), come il calcio di Habbo.
 *
 * Il pallone sta su una casella. Chi ci passa sopra lo calcia nella direzione in cui cammina:
 * di corsa va lontano, fermandocisi sopra fa un passaggio corto. Il pallone rotola una casella
 * alla volta, rimbalza su pareti e mobili, un avatar sulla traiettoria lo respinge (una parata)
 * e se entra in una porta dal lato del campo e' gol. Dopo il gol torna a centrocampo.
 *
 * I Blu attaccano la porta a est (x maggiore), i Rossi quella a ovest: un gol nella porta est
 * e' dei Blu, qualunque giocatore l'abbia segnato. Vince chi arriva per primo a WINNING_SCORE,
 * poi il punteggio riparte da zero.
 */
final class FootballMatch {

    static final String GOAL_TYPE = "football_goal";
    static final int WINNING_SCORE = 5;
    /** Caselle percorse dal pallone calciato di corsa e da fermi. */
    static final int RUN_POWER = 6;
    static final int TAP_POWER = 3;

    /** Direzioni come RoomInstance: 0 nord (y-1), 2 est (x+1), 4 sud (y+1), 6 ovest (x-1). */
    private static final int[][] DELTAS = {{0, -1}, {1, -1}, {1, 0}, {1, 1}, {0, 1}, {-1, 1}, {-1, 0}, {-1, -1}};

    enum Team {
        BLUE("blue", "Blu"), RED("red", "Rossi");

        private final String key;
        private final String label;

        Team(String key, String label) {
            this.key = key;
            this.label = label;
        }

        String key() {
            return key;
        }

        String label() {
            return label;
        }
    }

    /** Cosa c'e' sul campo, visto dal pallone. */
    interface Field {
        /** Casella libera per il pallone: dentro la stanza, non la porta d'ingresso, niente mobili solidi. */
        boolean ballCanEnter(int x, int y);

        /** Un avatar (diverso da chi calcia) sta su quella casella. */
        boolean hasAvatar(int x, int y);
    }

    /** Il tiro: caselle percorse dal pallone e, se e' finito in rete, chi ha segnato. */
    record Kick(List<int[]> path, Team scored) {
    }

    /** Porta: colonna x e caselle da y0 a y1 comprese. */
    private record Goal(int x, int y0, int y1) {
        boolean covers(int tx, int ty) {
            return tx == x && ty >= y0 && ty <= y1;
        }

        int centerY() {
            return (y0 + y1) / 2;
        }
    }

    private final Goal west;
    private final Goal east;
    /** Campo disegnato (caselle comprese): il pallone ne resta dentro e rimbalza sulle linee. */
    private final int minX;
    private final int minY;
    private final int maxX;
    private final int maxY;
    private final int homeX;
    private final int homeY;
    private int ballX;
    private int ballY;
    private int blue;
    private int red;
    private boolean inNet;

    private FootballMatch(Goal west, Goal east, int[] pitch) {
        this.west = west;
        this.east = east;
        this.minX = pitch[0];
        this.minY = pitch[1];
        this.maxX = pitch[2];
        this.maxY = pitch[3];
        this.homeX = (west.x() + east.x()) / 2;
        this.homeY = (west.centerY() + east.centerY()) / 2;
        this.ballX = homeX;
        this.ballY = homeY;
    }

    /**
     * La partita della stanza, con il campo come lo disegna il pavimento "pitch": due caselle dentro
     * i bordi della stanza (fuori ci sono la pista e le porte). La porta d'ingresso non conta.
     */
    static FootballMatch create(Collection<RoomItemView> items, RoomLayout layout, int doorX, int doorY) {
        int x0 = Integer.MAX_VALUE;
        int y0 = Integer.MAX_VALUE;
        int x1 = Integer.MIN_VALUE;
        int y1 = Integer.MIN_VALUE;
        for (int y = 0; y < layout.height(); y++) {
            for (int x = 0; x < layout.width(); x++) {
                if (!layout.isTile(x, y) || (x == doorX && y == doorY)) continue;
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
            }
        }
        if (x0 == Integer.MAX_VALUE) return null;
        return create(items, new int[]{x0 + 2, y0 + 2, x1 - 2, y1 - 2});
    }

    /** La partita con il campo dato (minX, minY, maxX, maxY), se ci sono due porte una di fronte all'altra. */
    static FootballMatch create(Collection<RoomItemView> items, int[] pitch) {
        List<Goal> goals = new ArrayList<>();
        for (RoomItemView item : items) {
            if (!GOAL_TYPE.equals(item.type())) continue;
            FurniCatalog.FurniDef def = item.def();
            goals.add(new Goal(item.x(), item.y(), item.y() + def.footprintY(item.rot()) - 1));
        }
        if (goals.size() != 2) return null;
        goals.sort(Comparator.comparingInt(Goal::x));
        if (goals.get(0).x() == goals.get(1).x()) return null;
        return new FootballMatch(goals.get(0), goals.get(1), pitch);
    }

    int ballX() {
        return ballX;
    }

    int ballY() {
        return ballY;
    }

    int score(Team team) {
        return team == Team.BLUE ? blue : red;
    }

    /** Il pallone e' in rete e aspetta di tornare a centrocampo: nessuno lo puo' calciare. */
    boolean inNet() {
        return inNet;
    }

    int midfieldX() {
        return homeX;
    }

    /** Qualcuno ha vinto la partita (e il punteggio va azzerato alla ripresa)? */
    Team winner() {
        if (blue >= WINNING_SCORE) return Team.BLUE;
        if (red >= WINNING_SCORE) return Team.RED;
        return null;
    }

    /** Pallone a centrocampo; dopo una vittoria riparte anche il punteggio. */
    void kickOff() {
        if (winner() != null) {
            blue = 0;
            red = 0;
        }
        ballX = homeX;
        ballY = homeY;
        inNet = false;
    }

    /**
     * Calcio nella direzione dir con la forza data (caselle da percorrere). Il pallone rimbalza su
     * pareti e mobili perdendo un po' di forza; contro un avatar torna indietro con meta' forza.
     */
    Kick kick(int dir, int power, Field field) {
        int[] delta = DELTAS[Math.floorMod(dir, 8)];
        int dx = delta[0];
        int dy = delta[1];
        int x = ballX;
        int y = ballY;
        List<int[]> path = new ArrayList<>();
        int left = power;
        while (left > 0) {
            Team scored = goalFor(x, y, dx, dy);
            if (scored != null) return score(path, x + dx, y + dy, scored);
            if (!canRoll(field, x, y, dx, dy)) {
                // Rimbalzo: in diagonale si inverte solo la componente che ha colpito, dritti si torna indietro.
                boolean xOpen = dx != 0 && open(field, x + dx, y);
                boolean yOpen = dy != 0 && open(field, x, y + dy);
                if (dx != 0 && dy != 0 && xOpen && !yOpen) {
                    dy = -dy;
                } else if (dx != 0 && dy != 0 && yOpen && !xOpen) {
                    dx = -dx;
                } else {
                    dx = -dx;
                    dy = -dy;
                }
                left--;
                scored = goalFor(x, y, dx, dy);
                if (scored != null) return score(path, x + dx, y + dy, scored);
                if (left <= 0 || !canRoll(field, x, y, dx, dy)) break;
            }
            // Parata: chi sta sulla strada respinge il pallone, che torna indietro con meta' forza.
            // (Fermarlo e basta lo lascerebbe incastrato fra i giocatori ammassati in un angolo.)
            if (field.hasAvatar(x + dx, y + dy)) {
                dx = -dx;
                dy = -dy;
                left /= 2;
                if (left <= 0 || !canRoll(field, x, y, dx, dy) || field.hasAvatar(x + dx, y + dy)) break;
            }
            x += dx;
            y += dy;
            path.add(new int[]{x, y});
            left--;
        }
        ballX = x;
        ballY = y;
        return new Kick(path, null);
    }

    /**
     * Casella dietro al pallone rispetto alla porta da attaccare: arrivando da li' e passando sul
     * pallone lo si calcia verso la porta. Serve ai calciatori NPC.
     */
    int[] kickSpot(Team team) {
        Goal target = team == Team.BLUE ? east : west;
        int dx = Integer.signum(target.x() - ballX);
        int dy = Integer.signum(target.centerY() - ballY);
        return new int[]{ballX - dx, ballY - dy};
    }

    /** La squadra che attacca verso est parte dalla meta' ovest del campo. */
    Team teamStartingAt(int x) {
        return x < homeX ? Team.BLUE : Team.RED;
    }

    private boolean canRoll(Field field, int x, int y, int dx, int dy) {
        if (!open(field, x + dx, y + dy)) return false;
        // In diagonale non si passa fra due ostacoli che si toccano per lo spigolo.
        return dx == 0 || dy == 0 || open(field, x + dx, y) || open(field, x, y + dy);
    }

    /** Casella dentro le linee del campo e libera: fuori dalle linee il pallone rimbalza. */
    private boolean open(Field field, int x, int y) {
        return x >= minX && x <= maxX && y >= minY && y <= maxY && field.ballCanEnter(x, y);
    }

    /** Gol solo entrando nella porta dal lato del campo: da dietro o di lato la porta e' un palo. */
    private Team goalFor(int x, int y, int dx, int dy) {
        int nx = x + dx;
        int ny = y + dy;
        if (dx > 0 && east.covers(nx, ny) && x == east.x() - 1) return Team.BLUE;
        if (dx < 0 && west.covers(nx, ny) && x == west.x() + 1) return Team.RED;
        return null;
    }

    private Kick score(List<int[]> path, int x, int y, Team team) {
        path.add(new int[]{x, y});
        ballX = x;
        ballY = y;
        inNet = true;
        if (team == Team.BLUE) blue++;
        else red++;
        return new Kick(path, team);
    }
}
