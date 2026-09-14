package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Mission;
import com.capstone.vinyldex.entity.UserMission;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Missione con il progresso dell'utente. L'id pubblico e' il code della missione. */
public record MissionDto(
        String id,
        String title,
        String description,
        String type,
        int target,
        int rewardGold,
        @JsonProperty("rewardXP") int rewardXp,
        String pack,
        boolean isDaily,
        int progress,
        boolean completed,
        boolean claimed
) {

    public static MissionDto from(Mission mission, UserMission userMission) {
        return new MissionDto(
                mission.getCode(),
                mission.getTitle(),
                mission.getDescription(),
                mission.getType(),
                mission.getTargetValue(),
                mission.getRewardGold(),
                mission.getRewardXp(),
                mission.getRewardPack(),
                mission.isDaily(),
                userMission != null ? userMission.getProgress() : 0,
                userMission != null && userMission.isCompleted(),
                userMission != null && userMission.isClaimed());
    }
}
