package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Mission;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserMission;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.MissionRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserMissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

/**
 * Motore delle missioni.
 *
 * Il progresso e' sempre calcolato qui e mai accettato dal client. Le missioni giornaliere
 * si azzerano pigramente al primo evento del giorno nuovo, quindi non serve nessun job
 * schedulato: un utente che non gioca non produce scritture inutili.
 */
@Service
public class MissionEngine {

    private final MissionRepository missionRepository;
    private final UserMissionRepository userMissionRepository;
    private final UserCardRepository userCardRepository;
    private final CardRepository cardRepository;

    public MissionEngine(MissionRepository missionRepository,
                         UserMissionRepository userMissionRepository,
                         UserCardRepository userCardRepository,
                         CardRepository cardRepository) {
        this.missionRepository = missionRepository;
        this.userMissionRepository = userMissionRepository;
        this.userCardRepository = userCardRepository;
        this.cardRepository = cardRepository;
    }

    /** Vero se l'istante indicato cade in un giorno di calendario precedente a oggi. */
    private static boolean isNewDay(Instant reference) {
        if (reference == null) return true;
        ZoneId zone = ZoneId.systemDefault();
        return !LocalDate.ofInstant(reference, zone).isEqual(LocalDate.now(zone));
    }

    /**
     * Riga di avanzamento dell'utente, creata al primo accesso.
     * Una missione giornaliera gia' riscossa in un giorno passato riparte da zero.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public UserMission getOrCreate(User user, Mission mission) {
        UserMission userMission = userMissionRepository
                .findByUserIdAndMissionId(user.getId(), mission.getId())
                .orElseGet(() -> userMissionRepository.save(new UserMission(user, mission)));

        boolean expiredDaily = mission.isDaily()
                && userMission.isClaimed()
                && isNewDay(userMission.getCompletedAt() != null ? userMission.getCompletedAt() : userMission.getStartedAt());

        if (expiredDaily) {
            userMission.setProgress(0);
            userMission.setCompleted(false);
            userMission.setClaimed(false);
            userMission.setStartedAt(Instant.now());
            userMission.setCompletedAt(null);
            userMissionRepository.save(userMission);
        }

        return userMission;
    }

    /** Aggiunge progresso a una missione contatore. Una missione gia' riscossa non riaccumula. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void bump(User user, Mission mission, int amount) {
        UserMission userMission = getOrCreate(user, mission);
        if (userMission.isClaimed()) return;

        applyProgress(userMission, Math.min(userMission.getProgress() + amount, mission.getTargetValue()), mission);
    }

    /** Imposta il progresso di una missione a valore assoluto (non incrementale). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void setValue(User user, Mission mission, int value) {
        UserMission userMission = getOrCreate(user, mission);
        if (userMission.isClaimed()) return;

        applyProgress(userMission, Math.min(value, mission.getTargetValue()), mission);
    }

    private void applyProgress(UserMission userMission, int progress, Mission mission) {
        boolean completed = progress >= mission.getTargetValue();
        if (progress == userMission.getProgress() && completed == userMission.isCompleted()) {
            return;
        }

        // completedAt si scrive solo al primo completamento, cosi' resta la data reale.
        if (completed && !userMission.isCompleted()) {
            userMission.setCompletedAt(Instant.now());
        }
        userMission.setProgress(progress);
        userMission.setCompleted(completed);
        userMissionRepository.save(userMission);
    }

    /**
     * Da chiamare dopo un evento puntuale: apertura pacchetto, vendita o acquisto sul mercato.
     *
     * @param rarity valorizzato solo per le missioni di tipo collect_rarity, altrimenti null
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void incrementByType(User user, String type, int amount, String rarity) {
        List<Mission> missions = missionRepository.findByTypeAndActiveTrue(type);
        for (Mission mission : missions) {
            if (MissionType.COLLECT_RARITY.equals(type)) {
                Object expected = mission.getMetadata() == null ? null : mission.getMetadata().get("rarity");
                if (!Objects.equals(expected, rarity)) continue;
            }
            bump(user, mission, amount);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void incrementByType(User user, String type, int amount) {
        incrementByType(user, type, amount, null);
    }

    /**
     * Da chiamare dopo ogni variazione della collezione: ricalcola le missioni il cui progresso
     * e' un valore assoluto e non un contatore.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recomputeAbsolute(User user) {
        long uniqueCount = userCardRepository.countByUserId(user.getId());

        for (Mission mission : missionRepository.findByTypeAndActiveTrue(MissionType.COLLECT_CARDS_UNIQUE)) {
            setValue(user, mission, (int) uniqueCount);
        }

        List<Mission> albumMissions = missionRepository.findByTypeAndActiveTrue(MissionType.ALBUM_PERCENT);
        if (albumMissions.isEmpty()) return;

        // Il totale e' quello reale del catalogo, tutte le fonti comprese. Contare gli slot di
        // AlbumCard darebbe una percentuale sopra il 100%, perche' gli album fermi al seed non
        // includono le carte importate dalle API esterne.
        long totalActiveCards = cardRepository.countByActiveTrueAndHoloFalse();
        int percent = totalActiveCards > 0 ? Math.round((uniqueCount * 100f) / totalActiveCards) : 0;
        for (Mission mission : albumMissions) {
            setValue(user, mission, percent);
        }
    }
}
