package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.RoomService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Stanze dell'hotel. Il movimento e la chat passano dal WebSocket, qui solo le letture. */
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping("/navigator")
    public Map<String, Object> navigator() {
        return roomService.navigator();
    }
}
