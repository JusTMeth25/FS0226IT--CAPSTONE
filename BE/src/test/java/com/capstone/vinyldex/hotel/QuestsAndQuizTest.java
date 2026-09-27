package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Incarichi degli NPC e risposte del quiz "Indovina la carta". */
class QuestsAndQuizTest {

    private static Card card(String source, String rarity) {
        Card card = new Card();
        card.setSource(source);
        card.setRarity(rarity);
        return card;
    }

    @Test
    @DisplayName("Incarichi: tre al giorno, uguali per tutti, NPC e giochi diversi, difficolta' crescente")
    void dailyQuests() {
        LocalDate day = LocalDate.of(2026, 9, 27);
        List<NpcQuestService.Quest> quests = NpcQuestService.questsOf(day);
        assertEquals(NpcQuestService.QUESTS_PER_DAY, quests.size());
        assertEquals(quests, NpcQuestService.questsOf(day), "stesso giorno, stessi incarichi");
        assertEquals(3, quests.stream().map(NpcQuestService.Quest::npcName).collect(Collectors.toSet()).size());
        assertEquals(3, quests.stream().map(NpcQuestService.Quest::source).collect(Collectors.toSet()).size());
        assertEquals(List.of("uncommon", "rare", "epic"), quests.stream().map(NpcQuestService.Quest::minRarity).toList());
        assertEquals("card_case", quests.get(2).furni(), "la richiesta epica regala la Teca 3D");
    }

    @Test
    @DisplayName("Una carta va bene se e' del gioco giusto e almeno della rarita' chiesta")
    void fits() {
        NpcQuestService.Quest quest = new NpcQuestService.Quest(0, null, "Tito", null, "onepiece", "rare", 100, null);
        assertTrue(NpcQuestService.fits(quest, card("onepiece", "rare")));
        assertTrue(NpcQuestService.fits(quest, card("onepiece", "legendary")));
        assertFalse(NpcQuestService.fits(quest, card("onepiece", "uncommon")));
        assertFalse(NpcQuestService.fits(quest, card("pokemon", "epic")));
    }

    @Test
    @DisplayName("Quiz: vale il nome intero o la prima parte, senza accenti, maiuscole e spazi")
    void quizAnswers() {
        List<String> answers = RoomInstance.quizAnswers("Pikachu ex");
        assertTrue(answers.contains("pikachuex"));
        RoomInstance.Quiz quiz = new RoomInstance.Quiz("Vados // Aide Vados", RoomInstance.quizAnswers("Vados // Aide Vados"),
                java.util.Map.of(), 0, 1);
        assertTrue(quiz.guessed("vados"));
        assertTrue(quiz.guessed("VADOS // aide vados"));
        assertFalse(quiz.guessed("va"));
        assertTrue(new RoomInstance.Quiz("Pokémon Center", RoomInstance.quizAnswers("Pokémon Center"), java.util.Map.of(), 0, 1)
                .guessed("pokemon center"));
        assertFalse(Set.of().contains("x"));
    }
}
