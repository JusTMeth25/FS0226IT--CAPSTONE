package com.capstone.vinyldex.security;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;

/**
 * Legge il token (cookie di sessione del sito, oppure Bearer dell'app nativa) e popola il
 * SecurityContext.
 *
 * Col cookie il browser manda il token da solo, anche su richieste partite da un altro sito:
 * per questo le richieste che modificano dati autenticate col cookie devono avere l'header
 * X-VinylDex-Client (vedi AuthCookies), che un altro sito non puo' aggiungere. Senza, 403.
 *
 * Un token assente o non valido non interrompe la catena: la richiesta prosegue senza
 * autenticazione e sono le regole di SecurityConfig a decidere se respingerla. Serve agli
 * endpoint pubblici che mostrano dati in piu' all'utente loggato, cioe' l'equivalente di
 * optionalCurrentUser nel vecchio backend Node.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        String bearer = header != null && header.startsWith(BEARER_PREFIX) ? header.substring(BEARER_PREFIX.length()).trim() : null;
        String cookie = bearer == null ? AuthCookies.read(request) : null;
        if (cookie != null && !SAFE_METHODS.contains(request.getMethod()) && request.getHeader(AuthCookies.CLIENT_HEADER) == null) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"csrf_blocked\"}");
            return;
        }
        String token = bearer != null ? bearer : cookie;
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {

            JwtService.Access access = jwtService.extractAccess(token);
            if (access != null) {
                Optional<User> user = userRepository.findById(access.userId());
                // Un utente bannato o cancellato non viene autenticato: il token da solo non basta. Nemmeno
                // un token emesso prima dell'ultimo cambio della password.
                if (user.isPresent() && !user.get().isBanned() && user.get().acceptsTokenIssuedAt(access.issuedAt())) {
                    UserPrincipal principal = new UserPrincipal(user.get());
                    var authentication = new UsernamePasswordAuthenticationToken(
                            principal, null, principal.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
