package com.capstone.vinyldex.config;

import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelSession;
import com.capstone.vinyldex.hotel.RoomRegistry;
import com.capstone.vinyldex.security.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Un solo dispositivo alla volta al casino.
 *
 * L'hotel tiene una connessione per utente: aprirlo su un altro dispositivo chiude quella vecchia
 * (RoomRegistry.REPLACED). Le giocate del casino pero' passano dalle API REST, che di per se'
 * sanno solo chi e' l'utente: il vecchio dispositivo, gia' scollegato, poteva continuare a giocare.
 * Ogni giocata porta quindi l'id della connessione dell'hotel da cui parte (header
 * X-Hotel-Session, lo manda il server nel messaggio "hello") e deve essere quella attuale.
 */
@Component
public class HotelDeviceConfig implements WebMvcConfigurer {

    public static final String HEADER = "X-Hotel-Session";

    private final RoomRegistry registry;

    public HotelDeviceConfig(RoomRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry interceptors) {
        interceptors.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                     @NonNull Object handler) {
                if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) return true;
                checkDevice(registry.sessionOf(principal.getId()), request.getHeader(HEADER));
                return true;
            }
        }).addPathPatterns("/api/casino/**");
    }

    /**
     * Senza connessione all'hotel ci pensa il casino stesso (casino_not_here). Con una connessione
     * aperta la giocata deve arrivare da quella: altrimenti viene da un dispositivo sostituito.
     */
    static void checkDevice(HotelSession current, String header) {
        if (current == null) return;
        if (header == null || !header.equals(current.id())) {
            throw new ApiException(HttpStatus.CONFLICT, "hotel_other_device");
        }
    }
}
