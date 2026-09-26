package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.DirectMessage;
import com.capstone.vinyldex.entity.Friendship;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.DirectMessageRepository;
import com.capstone.vinyldex.repository.FriendshipRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Amici dell'hotel: richieste, lista con chi e' online e in che stanza, messaggi privati.
 *
 * Le richieste e i messaggi arrivano subito a chi e' collegato all'hotel (WebSocket) e restano nel
 * database per chi non c'e'. Solo gli amici si scrivono in privato.
 */
@Service
public class FriendService {

    /** Amici al massimo: la lista deve restare leggibile. */
    static final int MAX_FRIENDS = 100;
    static final int THREAD_SIZE = 50;

    private final FriendshipRepository friendships;
    private final DirectMessageRepository messages;
    private final UserRepository users;
    private final RoomRegistry registry;

    public FriendService(FriendshipRepository friendships, DirectMessageRepository messages, UserRepository users,
                         RoomRegistry registry) {
        this.friendships = friendships;
        this.messages = messages;
        this.users = users;
        this.registry = registry;
    }

    /** Amici (con stato e stanza), richieste ricevute e mandate, messaggi non letti. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(UUID me) {
        Map<UUID, Long> unread = new HashMap<>();
        messages.countUnread(me).forEach(row -> unread.put((UUID) row[0], (Long) row[1]));
        List<Map<String, Object>> friends = new ArrayList<>();
        List<Map<String, Object>> incoming = new ArrayList<>();
        List<Map<String, Object>> outgoing = new ArrayList<>();
        for (Friendship f : friendships.findAllOf(me)) {
            User other = users.findById(f.other(me)).orElse(null);
            if (other == null) continue;
            Map<String, Object> view = view(other);
            view.put("requestId", f.getId());
            if (Friendship.ACCEPTED.equals(f.getStatus())) {
                view.put("unread", unread.getOrDefault(other.getId(), 0L));
                friends.add(view);
            } else if (f.getFriendId().equals(me)) {
                incoming.add(view);
            } else {
                outgoing.add(view);
            }
        }
        // Prima chi e' online, poi in ordine alfabetico.
        friends.sort(Comparator.comparing((Map<String, Object> v) -> !(Boolean) v.get("online"))
                .thenComparing(v -> ((String) v.get("username")).toLowerCase()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("friends", friends);
        result.put("incoming", incoming);
        result.put("outgoing", outgoing);
        return result;
    }

    /** Richiesta di amicizia per nome utente. Se l'altro l'aveva gia' chiesta a noi, diventa amicizia. */
    @Transactional
    public Map<String, Object> request(UUID me, String username) {
        User target = username == null ? null : users.findByUsername(username.trim()).orElse(null);
        if (target == null) throw ApiException.notFound("user_not_found");
        if (target.getId().equals(me)) throw ApiException.badRequest("friend_self");
        Friendship existing = friendships.findPair(me, target.getId()).orElse(null);
        if (existing != null) {
            if (Friendship.PENDING.equals(existing.getStatus()) && existing.getFriendId().equals(me)) {
                return accept(me, existing.getId());
            }
            throw ApiException.badRequest(Friendship.ACCEPTED.equals(existing.getStatus()) ? "already_friends" : "friend_already_requested");
        }
        long count = friendships.findAllOf(me).stream().filter(f -> Friendship.ACCEPTED.equals(f.getStatus())).count();
        if (count >= MAX_FRIENDS) throw ApiException.badRequest("too_many_friends");
        friendships.save(new Friendship(me, target.getId()));
        String myName = users.findById(me).map(User::getUsername).orElse("?");
        push(target.getId(), Map.of("type", "friend_event", "kind", "request", "from", myName));
        return Map.of("status", Friendship.PENDING);
    }

    @Transactional
    public Map<String, Object> accept(UUID me, UUID requestId) {
        Friendship request = friendships.findById(requestId).orElseThrow(() -> ApiException.notFound("request_not_found"));
        if (!request.getFriendId().equals(me)) throw ApiException.notFound("request_not_found");
        request.setStatus(Friendship.ACCEPTED);
        String myName = users.findById(me).map(User::getUsername).orElse("?");
        push(request.getUserId(), Map.of("type", "friend_event", "kind", "accepted", "from", myName));
        return Map.of("status", Friendship.ACCEPTED);
    }

    /** Toglie l'amicizia (o rifiuta/annulla la richiesta) con l'altro utente. */
    @Transactional
    public void remove(UUID me, UUID otherId) {
        friendships.findPair(me, otherId).ifPresent(friendships::delete);
    }

    /** Conversazione con un amico, dal piu' vecchio al piu' recente; i messaggi ricevuti diventano letti. */
    @Transactional
    public List<Map<String, Object>> thread(UUID me, UUID friendId) {
        requireFriends(me, friendId);
        messages.markRead(me, friendId, Instant.now());
        List<DirectMessage> page = new ArrayList<>(messages.findThread(me, friendId, PageRequest.of(0, THREAD_SIZE)));
        page.sort(Comparator.comparing(DirectMessage::getCreatedAt));
        return page.stream().map(FriendService::messageView).toList();
    }

    /** Messaggio privato a un amico: arriva subito se e' online, altrimenti lo trova dopo. */
    @Transactional
    public Map<String, Object> send(UUID me, UUID friendId, String raw) {
        requireFriends(me, friendId);
        ChatFilter.Result result = new ChatFilter().check(raw);
        if (result.verdict() != ChatFilter.Verdict.OK) throw ApiException.badRequest("message_empty");
        DirectMessage message = messages.save(new DirectMessage(me, friendId, result.text()));
        if (message.getCreatedAt() == null) message.setCreatedAt(Instant.now());
        Map<String, Object> view = messageView(message);
        String myName = users.findById(me).map(User::getUsername).orElse("?");
        Map<String, Object> push = new LinkedHashMap<>(view);
        push.put("type", "dm");
        push.put("fromName", myName);
        push(friendId, push);
        return view;
    }

    /** Sono amici (richiesta accettata)? */
    public boolean areFriends(UUID me, UUID other) {
        Friendship pair = friendships.findPair(me, other).orElse(null);
        return pair != null && Friendship.ACCEPTED.equals(pair.getStatus());
    }

    private void requireFriends(UUID me, UUID other) {
        Friendship pair = friendships.findPair(me, other).orElse(null);
        if (pair == null || !Friendship.ACCEPTED.equals(pair.getStatus())) throw ApiException.badRequest("not_friends");
    }

    /** Nome, aspetto, livello e dove si trova (se e' collegato all'hotel). */
    private Map<String, Object> view(User user) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", user.getId());
        view.put("username", user.getUsername());
        view.put("look", HotelLook.orDefault(user.getHotelLook()));
        view.put("level", user.getLevel());
        HotelSession session = registry.sessionOf(user.getId());
        boolean online = session != null && session.isOpen();
        view.put("online", online);
        UUID roomId = online ? session.roomId() : null;
        RoomInstance room = registry.get(roomId);
        view.put("roomId", room == null ? null : roomId);
        view.put("roomName", room == null ? null : room.data().name());
        return view;
    }

    private static Map<String, Object> messageView(DirectMessage m) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", m.getId());
        view.put("from", m.getFromId());
        view.put("to", m.getToId());
        view.put("text", m.getText());
        view.put("at", m.getCreatedAt());
        return view;
    }

    private void push(UUID userId, Object message) {
        HotelSession session = registry.sessionOf(userId);
        if (session != null && session.isOpen()) session.send(message);
    }
}
