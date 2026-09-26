package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Mission;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.MissionRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.MissionEngine;
import com.capstone.vinyldex.service.MissionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Missioni dell'hotel: gol allo stadio e partite ai minigiochi fanno avanzare le missioni
 * hotel_goal e hotel_minigame (MissionType). Il progresso lo decide il server: i gol li vede la
 * stanza, i punteggi sono quelli gia' controllati da Minigames.
 */
@Component
public class HotelMissionListener {

    private static final Logger log = LoggerFactory.getLogger(HotelMissionListener.class);

    private final MissionEngine missionEngine;
    private final MissionRepository missionRepository;
    private final UserRepository userRepository;

    public HotelMissionListener(MissionEngine missionEngine, MissionRepository missionRepository, UserRepository userRepository) {
        this.missionEngine = missionEngine;
        this.missionRepository = missionRepository;
        this.userRepository = userRepository;
    }

    @EventListener
    @Transactional
    public void onGoal(HotelGameEvents.GoalScored event) {
        userRepository.findById(event.userId()).ifPresent(user -> missionEngine.incrementByType(user, MissionType.HOTEL_GOAL, 1));
    }

    @EventListener
    @Transactional
    public void onMinigame(HotelGameEvents.MinigamePlayed event) {
        User user = userRepository.findById(event.userId()).orElse(null);
        if (user == null) return;
        for (Mission mission : missionRepository.findByTypeAndActiveTrue(MissionType.HOTEL_MINIGAME)) {
            if (matches(mission, event.game(), event.score())) missionEngine.bump(user, mission, 1);
        }
        log.debug("Missioni hotel aggiornate per {} ({} {})", event.username(), event.game(), event.score());
    }

    /**
     * La partita vale per la missione: gioco giusto (se la missione ne indica uno; "golf" vale
     * per tutte le buche) e punteggio almeno pari a minScore.
     */
    static boolean matches(Mission mission, String game, int score) {
        Object wanted = mission.getMetadata() == null ? null : mission.getMetadata().get("game");
        if (wanted instanceof String key && !game.equals(key) && !game.startsWith(key)) return false;
        Object min = mission.getMetadata() == null ? null : mission.getMetadata().get("minScore");
        int minScore = min instanceof Number n ? n.intValue() : 0;
        return score >= minScore;
    }
}
